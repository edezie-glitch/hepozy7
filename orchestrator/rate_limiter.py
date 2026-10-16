"""
Keeps Hepozy under Groq's free-tier tokens-per-minute (TPM) limit.

Algorithm: TOKEN BUCKET, one bucket per Groq model.
- The bucket holds up to GROQ_TPM_LIMIT tokens and refills continuously
  (GROQ_TPM_LIMIT / 60 tokens every second), the way Groq's own limit works.
- A request reserves (prompt + answer size) tokens BEFORE it is sent.
  Not enough tokens: wait a few seconds if the wait is short, otherwise the caller
  sends the request to Gemini right away instead of waiting.
- When the answer comes back, the reservation is corrected to the real usage.

Fair share: a user who already used GROQ_USER_TPM real tokens on Groq in the last
60 seconds is sent to Gemini, so one person cannot drain the shared budget.

Limits: this is in memory, so it works for ONE server process. With several uvicorn
workers each one would have its own bucket and the limit would not be shared.
"""

import os
import threading
import time
from collections import deque

# Free-tier TPM for the whole account, per model. Check your Groq console "Limits" page.
GROQ_TPM_LIMIT = int(os.environ.get("GROQ_TPM_LIMIT", "8000"))
# What one user may spend on Groq per minute before being sent to Gemini.
GROQ_USER_TPM = int(os.environ.get("GROQ_USER_TPM", "3000"))
# Longest a request may wait for Groq tokens before going to Gemini instead.
GROQ_MAX_WAIT_SECONDS = float(os.environ.get("GROQ_MAX_WAIT_SECONDS", "6"))
# Time that must stay free for the Gemini fallback after waiting.
_KEEP_FOR_FALLBACK = 30.0


class TokenBucket:
    def __init__(self, capacity: int, per_minute: int | None = None):
        self.capacity = float(capacity)
        self.rate = float(per_minute or capacity) / 60.0   # tokens per second
        self.tokens = float(capacity)
        self._stamp = time.monotonic()
        self._lock = threading.Lock()

    def _refill(self) -> None:          # caller holds the lock
        now = time.monotonic()
        self.tokens = min(self.capacity, self.tokens + (now - self._stamp) * self.rate)
        self._stamp = now

    def try_take(self, n: float) -> float:
        """0.0 if n tokens were taken. Otherwise how many seconds until they would be
        available (infinity if n is bigger than the whole bucket: it can never fit)."""
        n = float(n)
        if n > self.capacity:
            return float("inf")
        with self._lock:
            self._refill()
            if self.tokens >= n:
                self.tokens -= n
                return 0.0
            return (n - self.tokens) / self.rate

    def give_back(self, n: float) -> None:
        with self._lock:
            self._refill()
            self.tokens = min(self.capacity, self.tokens + float(n))

    def charge(self, n: float) -> None:
        """Spend more than was reserved. The bucket may go negative, which means a debt
        that the next refills pay off before anything else is allowed through."""
        with self._lock:
            self._refill()
            self.tokens -= float(n)

    def drain(self) -> None:
        with self._lock:
            self._refill()
            self.tokens = 0.0


class _UserSpend:
    """Real tokens each user spent on Groq in the last `window` seconds."""

    def __init__(self, window: float = 60.0):
        self.window = window
        self._rows: dict[str, deque] = {}
        self._lock = threading.Lock()

    def _prune(self, user_id: str, now: float) -> deque:   # caller holds the lock
        rows = self._rows.get(user_id)
        if rows is None:
            return deque()
        while rows and now - rows[0][0] > self.window:
            rows.popleft()
        if not rows:
            self._rows.pop(user_id, None)
            return deque()
        return rows

    def used(self, user_id: str) -> int:
        with self._lock:
            return sum(n for _, n in self._prune(user_id, time.monotonic()))

    def add(self, user_id: str, tokens: int) -> None:
        now = time.monotonic()
        with self._lock:
            self._prune(user_id, now)
            self._rows.setdefault(user_id, deque()).append((now, int(tokens)))


_buckets: dict[str, TokenBucket] = {}
_buckets_lock = threading.Lock()
_spend = _UserSpend()


def _bucket(model: str) -> TokenBucket:
    with _buckets_lock:
        b = _buckets.get(model)
        if b is None:
            b = _buckets[model] = TokenBucket(GROQ_TPM_LIMIT)
        return b


def groq_reserve(model: str, user_id: str | None, tokens: int, time_left: float) -> tuple[bool, str]:
    """(True, "") when Groq may be called now and `tokens` are held.
    (False, reason) when the request should go to Gemini instead."""
    if user_id and _spend.used(user_id) >= GROQ_USER_TPM:
        return False, "this user already used their Groq share this minute"

    bucket = _bucket(model)
    wait = bucket.try_take(tokens)
    if wait == 0.0:
        return True, ""
    if wait == float("inf"):
        return False, "bigger than Groq's whole per-minute limit"

    allowed = min(GROQ_MAX_WAIT_SECONDS, max(0.0, time_left - _KEEP_FOR_FALLBACK))
    if wait > allowed:
        return False, f"Groq budget is used up (would wait {wait:.0f}s)"

    time.sleep(wait + 0.05)
    if bucket.try_take(tokens) == 0.0:
        return True, ""
    return False, "another request took the tokens first"


def groq_settle(model: str, user_id: str | None, reserved: int, actual: int) -> None:
    """The call succeeded: replace the reservation with what Groq really counted."""
    b = _bucket(model)
    if reserved > actual:
        b.give_back(reserved - actual)
    elif actual > reserved:
        b.charge(actual - reserved)
    if user_id:
        _spend.add(user_id, actual)


def groq_failed(model: str, reserved: int, reason: str) -> None:
    """The call did not produce an answer."""
    if reason == "HTTP 429":
        _bucket(model).drain()          # Groq says we are over: stop sending for a while
    elif reason != "timed out":
        _bucket(model).give_back(reserved)   # nothing was spent; a timeout MAY have been, so keep it charged