import os
import threading
import time
from collections import defaultdict, deque

import httpx
from dotenv import load_dotenv
from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from supabase import ClientOptions, create_client
try:
    from supabase_auth.errors import AuthRetryableError
except Exception:  # older package name
    try:
        from gotrue.errors import AuthRetryableError
    except Exception:
        AuthRetryableError = None

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

# CHANGED: name of the Supabase Storage bucket that holds uploaded files.
# It was used in delete_account but never defined. Set UPLOAD_BUCKET in .env to your real bucket name.
UPLOAD_BUCKET = os.environ.get("UPLOAD_BUCKET", "uploads")

# Service-role client: tables and admin calls ONLY. Never sign users in on it.
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
# Anon client: sign-up, sign-in and token checks ONLY. Never use it for tables.
# CHANGED: no automatic token refreshing. By default this shared client quietly renews the LAST user
# who signed in, which uses up that user's refresh token and logs them out later.
_auth_client = create_client(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    options=ClientOptions(auto_refresh_token=False, persist_session=False),
)

# a network problem or a Supabase outage is NOT the same as "this login is no longer valid"
_TRANSIENT = (httpx.HTTPError, OSError) + ((AuthRetryableError,) if AuthRetryableError else ())


def _is_transient(e: Exception) -> bool:
    return isinstance(e, _TRANSIENT) or (getattr(e, "status", 0) or 0) >= 500


def _mail_key(email: str) -> str:
    """Gmail ignores dots and '+tags', so a.b+1@gmail.com and ab@gmail.com are ONE mailbox."""
    local, _, domain = email.strip().lower().partition("@")
    if domain in ("gmail.com", "googlemail.com"):
        local, domain = local.split("+", 1)[0].replace(".", ""), "gmail.com"
    return f"{local}@{domain}"

router = APIRouter(prefix="/auth", tags=["auth"])


# ADDED: slows down password guessing and signup spam. Kept in memory, so it covers one
# server process (how you run it) and resets when the server restarts.
_hits: dict[str, deque] = defaultdict(deque)
_hits_lock = threading.Lock()


def _client_ip(request: Request) -> str:
    # Cloudflare sets this header itself, so a visitor cannot choose it
    return request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "unknown")


def _check(key: str, limit: int, window: int) -> None:
    """Raise 429 if `key` already has `limit` recorded hits in the last `window` seconds."""
    now = time.monotonic()
    with _hits_lock:
        q = _hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            wait = int(window - (now - q[0])) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Too many attempts. Try again in {max(1, wait // 10)} second(s).",
                headers={"Retry-After": str(wait)},
            )


def _record(key: str) -> None:
    now = time.monotonic()
    with _hits_lock:
        _hits[key].append(now)
        if len(_hits) > 20000:  # keep memory bounded
            for k in [k for k, v in _hits.items() if not v or now - v[-1] > 3600]:
                _hits.pop(k, None)


# ADDED: captcha (Cloudflare Turnstile or hCaptcha). Off until CAPTCHA_SECRET is set in .env, so nothing
# breaks before the keys and the page widget are in place.
#   CAPTCHA_PROVIDER = turnstile (default) or hcaptcha
#   CAPTCHA_SECRET   = the SECRET key (server only, never in a frontend file)
CAPTCHA_PROVIDER = os.environ.get("CAPTCHA_PROVIDER", "turnstile").lower()
CAPTCHA_SECRET = os.environ.get("CAPTCHA_SECRET", "")
_CAPTCHA_URLS = {
    "turnstile": "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    "hcaptcha": "https://api.hcaptcha.com/siteverify",
}


def _captcha_on() -> bool:
    return bool(CAPTCHA_SECRET)


def _verify_captcha(token: str | None, ip: str) -> bool:
    """True only if the captcha service confirms the token. A missing token is a fail. If the service
    cannot be reached the request is refused with 503 (fail closed), never waved through."""
    if not token:
        return False
    try:
        r = httpx.post(
            _CAPTCHA_URLS.get(CAPTCHA_PROVIDER, _CAPTCHA_URLS["turnstile"]),
            data={"secret": CAPTCHA_SECRET, "response": token, "remoteip": ip},
            timeout=5,
        )
        return bool(r.json().get("success"))
    except Exception as e:
        print(f"[auth] captcha service unreachable: {type(e).__name__}")
        raise HTTPException(status_code=503, detail="Could not check the captcha right now. Please try again.")


def _fail_count(key: str, window: int = 300) -> int:
    now = time.monotonic()
    with _hits_lock:
        return sum(1 for t in _hits.get(key, ()) if now - t <= window)


class SignupRequest(BaseModel):
    email: EmailStr
    username: str = Field(pattern=r"^[A-Za-z0-9_]{3,20}$")
    password: str = Field(min_length=20, max_length=72)
    captcha_token: str | None = Field(default=None, max_length=4096)  # ADDED


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)
    captcha_token: str | None = Field(default=None, max_length=4096)  # ADDED


class AuthResponse(BaseModel):
    token: str
    username: str
    user_id: str
    refresh_token: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=2048)


class RefreshResponse(BaseModel):
    token: str
    refresh_token: str


class SignupResponse(BaseModel):
    message: str


# ADDED: a token that was just checked is trusted for 60 seconds, so one page load is not many
# round trips to Supabase, and a short Supabase hiccup does not log anybody out.
_token_cache: dict[str, tuple[str, float]] = {}
_token_cache_lock = threading.Lock()
_TOKEN_TTL = 60


def current_user(authorization: str | None = Header(None)) -> str:
    """Verified user id from 'Authorization: Bearer <token>'. Use as a dependency."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not signed in.")
    token = authorization[7:].strip()
    now = time.monotonic()
    with _token_cache_lock:
        hit = _token_cache.get(token)
        if hit and hit[1] > now:
            return hit[0]
    try:
        res = _auth_client.auth.get_user(token)
        if res is None or res.user is None:
            raise ValueError("no user")
        uid = res.user.id
    except Exception as e:
        if _is_transient(e):
            # 503, not 401: the page keeps the login and simply tries again
            print(f"[auth] token check could not reach Supabase: {type(e).__name__}")
            raise HTTPException(status_code=503, detail="Sign-in service is busy. Please try again.")
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    with _token_cache_lock:
        if len(_token_cache) > 5000:
            for k in [k for k, v in _token_cache.items() if v[1] <= now]:
                _token_cache.pop(k, None)
            if len(_token_cache) > 5000:
                _token_cache.clear()
        _token_cache[token] = (uid, now + _TOKEN_TTL)
    return uid


def _account_state(user_id: str) -> str:
    """'verified', 'pending' (email not confirmed yet), 'gone' (no such sign-in account) or 'unknown'."""
    try:
        res = supabase.auth.admin.get_user_by_id(user_id)
        user = getattr(res, "user", None)
        if user is None:
            return "gone"
        return "verified" if getattr(user, "email_confirmed_at", None) else "pending"
    except Exception as e:
        if getattr(e, "status", None) == 404 or getattr(e, "code", "") == "user_not_found":
            return "gone"
        print(f"[auth] account state check failed: {type(e).__name__} status={getattr(e,'status',None)} code={getattr(e,'code',None)} {e}")
        return "unknown"


def resolve_username_to_email(username: str) -> str:
    result = (
        supabase.table("profiles")
        .select("email")
        .eq("username", username)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    return result.data[0]["email"]


@router.post("/signup", response_model=SignupResponse)
def signup(req: SignupRequest, request: Request):
    ip = _client_ip(request)
    ip_key = f"signup-ip:{ip}"
    email_key = f"signup-email:{_mail_key(req.email)}"
    _check(ip_key, 5, 3600)      # 5 signups per hour from one address
    _check(email_key, 3, 3600)   # 3 signups per hour for one email, so nobody can mail-bomb an inbox
    _record(ip_key)
    _record(email_key)

    # ADDED: a human check before anything else costs us work (no database calls, no email lookups)
    if _captcha_on() and not _verify_captcha(req.captcha_token, ip):
        raise HTTPException(status_code=400, detail="Please complete the captcha and try again.")

    # ADDED: the address must be able to receive mail (the domain must exist and accept it).
    # Only the confirmation link below proves the mailbox itself exists and belongs to this person.
    try:
        validate_email(req.email, check_deliverability=True)
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="That email address cannot receive mail. Check the spelling and try again.")

    # ADDED: check first whether this email already has an account, and say so clearly
    email_lc = req.email.strip().lower()

    # ADDED: emails the owner has blocked cannot sign up again (add them to the banned_emails table)
    blocked = (
        supabase.table("banned_emails")
        .select("email_key")
        .eq("email_key", _mail_key(req.email))
        .limit(1)
        .execute()
    )
    if blocked.data:
        raise HTTPException(status_code=403, detail="This email cannot be used to create an account.")

    taken = (
        supabase.table("profiles")
        .select("id")
        .in_("email", list({req.email, email_lc}))
        .limit(1)
        .execute()
    )
    if taken.data:
        state = _account_state(taken.data[0]["id"])
        if state == "gone":
            supabase.table("profiles").delete().eq("id", taken.data[0]["id"]).execute()
        elif state == "pending":
            raise HTTPException(status_code=400, detail="This email is already registered but not verified yet. Check your inbox for the verification link.")
        elif state == "unknown":
            raise HTTPException(status_code=503, detail="Could not check this account right now. Try again.")
        else:
            raise HTTPException(status_code=400, detail="An account with this email already exists. Log in instead.")

    existing = (
        supabase.table("profiles")
        .select("username")
        .eq("username", req.username)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=400, detail="Username already taken.")

    try:
        result = _auth_client.auth.sign_up(
            {
                "email": req.email,
                "password": req.password,
                "options": {
                    "data": {"username": req.username},
                    "email_redirect_to": "https://localhost:8000/login.html",
                },
            }
        )
    except Exception as e:
        print(f"[auth] signup failed: {e}")
        raise HTTPException(status_code=400, detail="Signup failed. Check your details and try again.")

    if result.user is None:
        raise HTTPException(status_code=400, detail="Signup failed. Check your details and try again.")

    # ADDED: for an email that already has an account Supabase returns a fake user with no identities.
    # Without this check a ghost profile would be created for it.
    identities = getattr(result.user, "identities", None)
    if identities is not None and len(identities) == 0:
        raise HTTPException(status_code=400, detail="This email cannot be used for a new account. Try logging in, or use another email.")

    try:
        supabase.table("profiles").insert(
            {"id": result.user.id, "username": req.username, "email": email_lc}
        ).execute()
    except Exception as e:
        error_text = str(e).lower()
        is_duplicate = "duplicate" in error_text or "unique" in error_text or "already exists" in error_text

        try:
            supabase.auth.admin.delete_user(result.user.id)
        except Exception as cleanup_error:
            print(
                f"[auth] CRITICAL: profile insert failed AND cleanup of orphaned "
                f"auth user {result.user.id} also failed: {cleanup_error}. "
                f"Manual cleanup needed."
            )

        if is_duplicate:
            raise HTTPException(status_code=400, detail="Username already taken.")
        print(f"[auth] profile insert failed: {e}")
        # the database's short error code (for example 23503) is safe to show and tells us what failed
        code = getattr(e, "code", None) or type(e).__name__
        raise HTTPException(status_code=500, detail=f"Signup failed while creating profile (error {code}). Please try again.")

    return SignupResponse(
        message="Account created. Check your email to verify before logging in."
    )


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, request: Request):
    ip = _client_ip(request)
    ip_key = f"login-ip:{ip}"
    user_key = f"login-user:{ip}:{req.username.lower()}"
    _check(ip_key, 20, 300)    # 20 failed logins per 5 minutes from one address
    _check(user_key, 5, 300)   # 5 failed logins per 5 minutes for one username from one address

    # ADDED: after 3 failed logins in 5 minutes the captcha is required. The page sees the code
    # "captcha_required" and shows the widget; normal logins never see a captcha.
    if _captcha_on() and _fail_count(user_key) >= 3:
        if not _verify_captcha(req.captcha_token, ip):
            raise HTTPException(status_code=403, detail="captcha_required")

    try:
        email = resolve_username_to_email(req.username)
    except HTTPException:
        _record(ip_key)
        _record(user_key)
        raise

    try:
        result = _auth_client.auth.sign_in_with_password(
            {"email": email, "password": req.password}
        )
    except Exception as e:
        msg = str(e).lower()
        if "confirm" in msg or "verified" in msg or "not confirmed" in msg:
            raise HTTPException(
                status_code=403,
                detail="Please verify your email before logging in.",
            )
        _record(ip_key)
        _record(user_key)
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    if result.session is None:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in.",
        )

    return AuthResponse(
        token=result.session.access_token,
        refresh_token=result.session.refresh_token,
        username=req.username,
        user_id=result.user.id,
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh(req: RefreshRequest, request: Request):
    """Trades a refresh token for a new access token, so a login lasts past the first hour."""
    key = f"refresh-ip:{_client_ip(request)}"
    _check(key, 60, 600)
    _record(key)
    try:
        result = _auth_client.auth.refresh_session(req.refresh_token)
    except Exception as e:
        if _is_transient(e):
            raise HTTPException(status_code=503, detail="Sign-in service is busy. Please try again.")
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    if result.session is None:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    return RefreshResponse(token=result.session.access_token, refresh_token=result.session.refresh_token)


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)


def _forget_tokens(uid: str) -> None:
    with _token_cache_lock:
        for k in [k for k, v in _token_cache.items() if v[0] == uid]:
            _token_cache.pop(k, None)


@router.post("/delete-account")
def delete_account(req: DeleteAccountRequest, request: Request, uid: str = Depends(current_user)):
    """Permanently deletes the signed-in user's chats, uploaded files and login."""
    key = f"delete-account:{uid}"
    _check(key, 5, 600)

    # 1. the password must be entered again, so a stolen session cannot erase an account
    email = None
    try:
        row = supabase.table("profiles").select("email").eq("id", uid).limit(1).execute()
        if row.data:
            email = row.data[0]["email"]
        else:
            res = supabase.auth.admin.get_user_by_id(uid)
            email = getattr(getattr(res, "user", None), "email", None)
    except Exception as e:
        print(f"[delete_account] could not look up the email: {type(e).__name__}: {e}")
        raise HTTPException(status_code=503, detail="Could not check your account right now. Try again.")
    if not email:
        raise HTTPException(status_code=404, detail="Account not found.")
    try:
        _auth_client.auth.sign_in_with_password({"email": email, "password": req.password})
    except Exception as e:
        if _is_transient(e):
            raise HTTPException(status_code=503, detail="Sign-in service is busy. Please try again.")
        _record(key)
        raise HTTPException(status_code=403, detail="Incorrect password.")

    # 2. uploaded files in Storage
    try:
        rows = supabase.table("user_uploads").select("storage_path").eq("user_id", uid).execute().data or []
        paths = [r["storage_path"] for r in rows if r.get("storage_path")]
        for i in range(0, len(paths), 100):
            supabase.storage.from_(UPLOAD_BUCKET).remove(paths[i:i + 100])
    except Exception as e:
        print(f"[delete_account] storage cleanup failed for {uid}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail="Could not delete your files. Nothing else was removed. Please try again.")

    # 3. rows in the database (order matters: messages, uploads, then conversations)
    for table, required in (("chat_messages", True), ("user_uploads", True), ("conversations", True), ("llm_usage", False)):
        try:
            supabase.table(table).delete().eq("user_id", uid).execute()
        except Exception as e:
            print(f"[delete_account] {table} cleanup failed for {uid}: {type(e).__name__}: {e}")
            if required:
                raise HTTPException(status_code=502, detail="Could not delete your data. Please try again.")

    # 4. the login itself (hard delete, so the email is free again). Last on purpose: if this fails
    #    the account still works and the person can simply try again.
    try:
        supabase.auth.admin.delete_user(uid)
    except Exception as e:
        print(f"[delete_account] auth user delete failed for {uid}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not remove your login. Your chats are already deleted. Please try again.")

    try:
        supabase.table("profiles").delete().eq("id", uid).execute()
    except Exception as e:
        print(f"[delete_account] profile row not removed for {uid} (signup cleans it up): {type(e).__name__}")

    _forget_tokens(uid)
    return {"message": "Account deleted."}