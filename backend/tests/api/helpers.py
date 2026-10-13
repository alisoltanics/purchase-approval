"""Shared helpers for the API acceptance tests (written from docs/api-contract.md only)."""

import json
import re
import threading
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from django.db import connections
from rest_framework.test import APIClient

JSON = "application/json"
TS_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

LOGIN_URL = "/api/auth/login/"
LOGOUT_URL = "/api/auth/logout/"
ME_URL = "/api/auth/me/"
CSRF_URL = "/api/auth/csrf/"
LIST_URL = "/api/requests/"

# Fixed message texts from the contract error table (section 5).
MSG_VALIDATION = "Check the highlighted fields."
MSG_NOT_AUTHENTICATED = "Sign in to continue."
MSG_INVALID_CREDENTIALS = "Email or password is incorrect."
MSG_CSRF = "Your session could not be verified. Reload the page and try again."
MSG_NOT_PERMITTED = "You do not have permission to decide requests."
MSG_OWN_REQUEST = "Another manager must review your request."
MSG_UNAVAILABLE = "Request unavailable. It may not exist or you may not have access."
MSG_NOT_FOUND = "Not found."
MSG_METHOD = "Method not allowed."
MSG_ALREADY_DECIDED = "This request has already been decided."
MSG_IDEMPOTENCY = "This submission key was already used with different values."

USER_KEYS = {"id", "email", "display_name", "role", "company"}
LIST_ITEM_KEYS = {
    "id",
    "title",
    "vendor",
    "amount",
    "currency",
    "status",
    "submitted_at",
    "requester",
}
DETAIL_KEYS = LIST_ITEM_KEYS | {
    "description",
    "decided_by",
    "decided_at",
    "rejection_reason",
    "can_decide",
    "events",
}
EVENT_KEYS = {"type", "actor", "created_at", "reason"}


def detail_url(request_id: object) -> str:
    return f"/api/requests/{request_id}/"


def approve_url(request_id: object) -> str:
    return f"/api/requests/{request_id}/approve/"


def reject_url(request_id: object) -> str:
    return f"/api/requests/{request_id}/reject/"


def new_key() -> str:
    return str(uuid.uuid4())


def valid_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "title": "Standing desk",
        "vendor": "Ergo Supply",
        "description": "Needed for the new hire.",
        "amount": "649.00",
    }
    payload.update(overrides)
    return payload


class Api:
    """A browser-like client: cookie jar, CSRF checks enforced, token read fresh each time."""

    def __init__(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True, raise_request_exception=False)

    def csrf_token(self) -> str:
        morsel = self.client.cookies.get("csrftoken")
        if morsel is None:
            response = self.client.get(CSRF_URL)
            assert response.status_code == 204, f"GET {CSRF_URL} gave {response.status_code}"
            assert "csrftoken" in self.client.cookies, "csrf endpoint did not set csrftoken"
            morsel = self.client.cookies["csrftoken"]
        return morsel.value

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return self.client.get(path, params or {})

    def send(
        self,
        method: str,
        path: str,
        body: Any = None,
        *,
        raw: bytes | str | None = None,
        content_type: str = JSON,
        csrf: bool = True,
        idem: str | None = None,
        token: str | None = None,
    ) -> Any:
        extra: dict[str, str] = {}
        if token is not None:
            extra["HTTP_X_CSRFTOKEN"] = token
        elif csrf:
            extra["HTTP_X_CSRFTOKEN"] = self.csrf_token()
        if idem is not None:
            extra["HTTP_IDEMPOTENCY_KEY"] = idem
        if raw is None:
            raw = b"" if body is None else json.dumps(body)
        return self.client.generic(method, path, raw, content_type=content_type, **extra)

    def post(self, path: str, body: Any = None, **kwargs: Any) -> Any:
        return self.send("POST", path, body, **kwargs)

    def login(self, email: str, password: str, **kwargs: Any) -> Any:
        return self.post(LOGIN_URL, {"email": email, "password": password}, **kwargs)

    def submit(
        self, payload: dict[str, Any] | None = None, key: str | None = None, **kwargs: Any
    ) -> Any:
        body = valid_payload() if payload is None else payload
        return self.post(LIST_URL, body, idem=new_key() if key is None else key, **kwargs)

    def approve(self, request_id: object, body: Any = None, **kwargs: Any) -> Any:
        return self.post(approve_url(request_id), body, **kwargs)

    def reject(self, request_id: object, reason: Any, **kwargs: Any) -> Any:
        return self.post(reject_url(request_id), {"reason": reason}, **kwargs)


def error_of(response: Any) -> dict[str, Any]:
    payload = response.json()
    assert set(payload) == {"error"}, payload
    return payload["error"]


def assert_error(
    response: Any, status: int, code: str, message: str, *, extra_keys: set[str] | None = None
) -> dict[str, Any]:
    assert response.status_code == status, response.content
    assert response["Content-Type"].startswith(JSON)
    error = error_of(response)
    assert error["code"] == code
    assert error["message"] == message
    assert set(error) == {"code", "message"} | (extra_keys or set())
    return error


def field_codes(response: Any, field: str) -> list[str]:
    error = assert_error(response, 400, "validation_error", MSG_VALIDATION, extra_keys={"fields"})
    assert field in error["fields"], error["fields"]
    entries = error["fields"][field]
    assert entries, error["fields"]
    for entry in entries:
        assert set(entry) == {"code", "message"}
        assert entry["message"]
    return [entry["code"] for entry in entries]


def assert_unavailable(response: Any) -> None:
    assert_error(response, 404, "request_unavailable", MSG_UNAVAILABLE)


def assert_detail_shape(data: dict[str, Any]) -> None:
    assert set(data) == DETAIL_KEYS, set(data) ^ DETAIL_KEYS
    assert set(data["requester"]) == {"id", "display_name"}
    assert isinstance(data["amount"], str)
    assert re.fullmatch(r"\d{1,6}\.\d{2}", data["amount"])
    assert data["currency"] == "USD"
    assert TS_RE.match(data["submitted_at"])
    assert isinstance(data["can_decide"], bool)
    for event in data["events"]:
        assert set(event) == EVENT_KEYS
        assert set(event["actor"]) == {"id", "display_name"}
        assert TS_RE.match(event["created_at"])


def run_parallel(calls: list[Callable[[], Any]]) -> list[Any]:
    """Run the callables at the same moment in separate threads (own DB connections)."""
    barrier = threading.Barrier(len(calls))

    def worker(call: Callable[[], Any]) -> Any:
        try:
            barrier.wait(timeout=30)
            return call()
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=len(calls)) as pool:
        futures = [pool.submit(worker, call) for call in calls]
        return [future.result(timeout=120) for future in futures]
