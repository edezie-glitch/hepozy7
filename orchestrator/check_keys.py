import os, requests
from dotenv import load_dotenv
load_dotenv()
url = os.environ["SUPABASE_URL"].rstrip("/")
for name in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"):
    k = os.environ[name]
    print(name, "| starts:", k[:10], "| length:", len(k), "| last char:", repr(k[-1]))
    for mode in ("apikey only", "apikey + bearer"):
        h = {"apikey": k}
        if mode != "apikey only":
            h["Authorization"] = "Bearer " + k
        r = requests.get(url + "/rest/v1/profiles?select=id&limit=1", headers=h, timeout=15)
        print("   ", mode, "->", r.status_code)