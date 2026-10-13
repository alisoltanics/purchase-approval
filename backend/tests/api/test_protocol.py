"""Cross-cutting API rules: no-store, JSON 404/405, anonymous access, no write verbs (AC-27)."""

import pytest

from approvals.models import PurchaseRequest

from .conftest import World
from .helpers import (
    CSRF_URL,
    LIST_URL,
    LOGIN_URL,
    LOGOUT_URL,
    ME_URL,
    MSG_METHOD,
    MSG_NOT_AUTHENTICATED,
    MSG_NOT_FOUND,
    Api,
    approve_url,
    assert_error,
    detail_url,
    reject_url,
)

pytestmark = pytest.mark.django_db

PROTECTED_READS = [ME_URL, LIST_URL]


def test_every_response_is_no_store(world: World, pending: PurchaseRequest, login_as) -> None:
    anon = Api()
    api = login_as(world.jordan)
    other = login_as(world.casey)
    responses = [
        anon.get(CSRF_URL),
        anon.get(ME_URL),
        anon.get(LIST_URL),
        anon.get("/api/does-not-exist/"),
        anon.post(LOGIN_URL, {}),
        anon.post(LOGIN_URL, {"email": world.alex.email, "password": "wrong-password-123"}),
        anon.post(LOGIN_URL, {}, csrf=False),
        anon.send("DELETE", LIST_URL),
        api.get(ME_URL),
        api.get(LIST_URL),
        api.get(LIST_URL, {"page": "abc"}),
        api.get(detail_url(pending.id)),
        api.get(detail_url("abc")),
        other.get(detail_url(pending.id)),
        api.submit(),
        api.submit(key="not-a-uuid"),
        api.post(LIST_URL, {}, csrf=False),
        api.approve(pending.id),
        api.approve(pending.id),
        api.reject(pending.id, "x"),
        api.send("PUT", detail_url(pending.id)),
        api.post(LOGOUT_URL),
    ]
    for response in responses:
        assert response["Cache-Control"] == "no-store", (response.status_code, response.content)


def test_unknown_api_paths_are_json_404(world: World, login_as) -> None:
    api = login_as(world.alex)
    for path in [
        "/api/",
        "/api/nope/",
        "/api/requests/some-id/unknown/",
        "/api/requests/some-id/approve/extra/",
        "/api/auth/",
        "/api/auth/unknown/",
    ]:
        response = api.get(path)
        assert_error(response, 404, "not_found", MSG_NOT_FOUND)
    response = api.post("/api/nope/", {})
    assert_error(response, 404, "not_found", MSG_NOT_FOUND)


def test_unknown_api_path_for_anonymous_is_json_404(anon: Api) -> None:
    assert_error(anon.get("/api/nope/"), 404, "not_found", MSG_NOT_FOUND)


@pytest.mark.parametrize("path", PROTECTED_READS)
def test_anonymous_protected_reads_are_401(anon: Api, path: str) -> None:
    assert_error(anon.get(path), 401, "not_authenticated", MSG_NOT_AUTHENTICATED)


def test_anonymous_detail_is_401_even_for_unknown_id(world: World, anon: Api, pending) -> None:
    for request_id in (pending.id, "abc", "00000000-0000-4000-8000-000000000000"):
        response = anon.get(detail_url(request_id))
        assert_error(response, 401, "not_authenticated", MSG_NOT_AUTHENTICATED)


def test_anonymous_writes_with_csrf_are_401(world: World, anon: Api, pending) -> None:
    assert_error(anon.submit(), 401, "not_authenticated", MSG_NOT_AUTHENTICATED)
    assert_error(anon.approve(pending.id), 401, "not_authenticated", MSG_NOT_AUTHENTICATED)
    assert_error(anon.reject(pending.id, "no"), 401, "not_authenticated", MSG_NOT_AUTHENTICATED)
    assert_error(anon.post(LOGOUT_URL), 401, "not_authenticated", MSG_NOT_AUTHENTICATED)
    pending.refresh_from_db()
    assert pending.status == "pending"
    assert PurchaseRequest.objects.count() == 1


@pytest.mark.parametrize(
    ("method", "path", "allowed"),
    [
        ("POST", ME_URL, {"GET"}),
        ("POST", CSRF_URL, {"GET"}),
        ("GET", LOGIN_URL, {"POST"}),
        ("GET", LOGOUT_URL, {"POST"}),
        ("DELETE", LIST_URL, {"GET", "POST"}),
        ("PUT", LIST_URL, {"GET", "POST"}),
        ("PATCH", LIST_URL, {"GET", "POST"}),
    ],
)
def test_wrong_method_is_405_with_allow(
    world: World, login_as, method: str, path: str, allowed: set[str]
) -> None:
    api = login_as(world.alex)
    response = api.send(method, path, {})
    assert_error(response, 405, "method_not_allowed", MSG_METHOD)
    advertised = {m.strip() for m in response["Allow"].split(",")}
    assert allowed <= advertised
    assert not advertised & {"PUT", "PATCH", "DELETE"}


@pytest.mark.parametrize("method", ["PUT", "PATCH", "DELETE"])
def test_no_write_verbs_on_request_routes(
    world: World, pending: PurchaseRequest, login_as, method: str
) -> None:
    """AC-27: no edit, delete or reopen path exists, for any role."""
    before = PurchaseRequest.objects.values().get(id=pending.id)
    for user in (world.alex, world.jordan):
        api = login_as(user)
        for path in (
            detail_url(pending.id),
            approve_url(pending.id),
            reject_url(pending.id),
            LIST_URL,
        ):
            response = api.send(method, path, {"title": "Hacked", "status": "pending"})
            assert_error(response, 405, "method_not_allowed", MSG_METHOD)
            assert method not in response["Allow"]
    assert PurchaseRequest.objects.values().get(id=pending.id) == before


def test_detail_and_decision_routes_reject_other_methods(
    world: World, pending: PurchaseRequest, login_as
) -> None:
    api = login_as(world.jordan)
    response = api.post(detail_url(pending.id), {})
    assert_error(response, 405, "method_not_allowed", MSG_METHOD)
    assert "GET" in response["Allow"]
    for path in (approve_url(pending.id), reject_url(pending.id)):
        response = api.get(path)
        assert_error(response, 405, "method_not_allowed", MSG_METHOD)
        assert "POST" in response["Allow"]


def test_no_write_verbs_on_auth_routes(world: World, login_as) -> None:
    api = login_as(world.alex)
    for method in ("PUT", "PATCH", "DELETE"):
        for path in (LOGIN_URL, LOGOUT_URL, ME_URL, CSRF_URL):
            response = api.send(method, path, {})
            assert_error(response, 405, "method_not_allowed", MSG_METHOD)
