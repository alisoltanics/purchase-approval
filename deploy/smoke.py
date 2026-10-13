"""Staging smoke journey (AC-32): employee submits, manager approves one and rejects another,
company isolation holds, and requests from earlier smoke runs are still there after a redeploy.
Standard library only. Credentials come from the environment, never from this file."""
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

BASE = os.environ["SMOKE_BASE_URL"].rstrip("/")
PASSWORD = os.environ["SMOKE_PASSWORD"]
EMPLOYEE = os.environ["SMOKE_EMPLOYEE_EMAIL"]
MANAGER = os.environ["SMOKE_MANAGER_EMAIL"]
OTHER_MANAGER = os.environ.get("SMOKE_OTHER_COMPANY_MANAGER_EMAIL", "")
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".smoke-ids")


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def csrf(self):
        for c in self.jar:
            if c.name == "csrftoken":
                return c.value
        return ""

    def call(self, method, path, body=None, headers=None):
        if method == "POST" and not self.csrf():
            self.call("GET", "/api/auth/csrf/")
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(BASE + path, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if method == "POST":
            req.add_header("X-CSRFToken", self.csrf())
            req.add_header("Referer", BASE + "/")
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with self.opener.open(req, timeout=20) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if raw else None)
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                return e.code, json.loads(raw)
            except ValueError:
                return e.code, None

    def login(self, email):
        self.call("GET", "/api/auth/csrf/")
        status, _ = self.call("POST", "/api/auth/login/", {"email": email, "password": PASSWORD})
        check(status == 200, f"login as {email} gave {status}")


def check(ok, message):
    if not ok:
        print(f"SMOKE FAIL: {message}", file=sys.stderr)
        sys.exit(1)
    print(f"ok  {message}")


def submit(client, label):
    status, body = client.call(
        "POST",
        "/api/requests/",
        {"title": f"Smoke {label}", "vendor": "Smoke Vendor", "description": "Created by deploy/smoke.py", "amount": "12.34"},
        {"Idempotency-Key": str(uuid.uuid4())},
    )
    check(status == 201 and body["status"] == "pending", f"employee submitted {label} request")
    return body["id"]


employee = Client()
employee.login(EMPLOYEE)

# Persistence across redeploys: ids saved by the previous smoke run must still exist.
if os.path.exists(STATE):
    for rid in open(STATE).read().split():
        status, _ = employee.call("GET", f"/api/requests/{rid}/")
        check(status == 200, f"request {rid} from an earlier run survived the redeploy")

approve_id = submit(employee, "approve")
reject_id = submit(employee, "reject")

status, _ = employee.call("POST", f"/api/requests/{approve_id}/approve/", {})
check(status == 403, "employee cannot approve")

manager = Client()
manager.login(MANAGER)
status, body = manager.call("POST", f"/api/requests/{approve_id}/approve/", {})
check(status == 200 and body["status"] == "approved", "manager approved")
status, body = manager.call("POST", f"/api/requests/{reject_id}/reject/", {"reason": "Smoke test rejection"})
check(status == 200 and body["status"] == "rejected", "manager rejected with a reason")

status, body = employee.call("GET", f"/api/requests/{approve_id}/")
check(status == 200 and body["status"] == "approved", "employee sees approved status")
status, body = employee.call("GET", f"/api/requests/{reject_id}/")
check(status == 200 and body["status"] == "rejected", "employee sees rejected status")

if OTHER_MANAGER:
    other = Client()
    other.login(OTHER_MANAGER)
    status, _ = other.call("GET", f"/api/requests/{approve_id}/")
    check(status == 404, "manager of another company gets 404 for the request")
    status, listing = other.call("GET", "/api/requests/")
    check(status == 200 and approve_id not in json.dumps(listing), "other company's list excludes it")
else:
    print("skip company isolation: SMOKE_OTHER_COMPANY_MANAGER_EMAIL not set")

with open(STATE, "w") as f:
    f.write(f"{approve_id}\n{reject_id}\n")
print("SMOKE OK")
