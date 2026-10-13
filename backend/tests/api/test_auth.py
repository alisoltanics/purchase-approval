"""Authentication, session and CSRF behavior (AC-01, AC-02, AC-04)."""

import pytest

from accounts.models import User

from .conftest import PASSWORD, World, make_user
from .helpers import (
    CSRF_URL,
    LIST_URL,
    LOGIN_URL,
    LOGOUT_URL,
    ME_URL,
    MSG_CSRF,
    MSG_INVALID_CREDENTIALS,
    MSG_NOT_AUTHENTICATED,
    USER_KEYS,
    Api,
    assert_error,
    field_codes,
)

pytestmark = pytest.mark.django_db


def assert_user_body(data: dict, user: User) -> None:
    assert set(data) == USER_KEYS
    assert data["id"] == str(user.id)
    assert data["email"] == user.email
    assert data["display_name"] == user.display_name
    assert data["role"] == user.role
    assert data["company"] == {"id": str(user.company_id), "name": user.company.name}


def test_csrf_endpoint_sets_cookie(anon: Api) -> None:
    response = anon.get(CSRF_URL)
    assert response.status_code == 204
    assert anon.client.cookies["csrftoken"].value


def test_login_success_returns_user(world: World, anon: Api) -> None:
    response = anon.login(world.jordan.email, PASSWORD)
    assert response.status_code == 200
    assert_user_body(response.json(), world.jordan)
    assert "sessionid" in response.cookies
    assert response.cookies["sessionid"]["httponly"]


@pytest.mark.parametrize("who", ["alex", "jordan", "casey", "riley"])
def test_login_each_role_and_company(world: World, anon: Api, who: str) -> None:
    user = getattr(world, who)
    response = anon.login(user.email, PASSWORD)
    assert response.status_code == 200
    assert_user_body(response.json(), user)


def test_password_never_appears_in_any_response(world: World, anon: Api) -> None:
    wrong = "wrong-password-123"
    responses = [
        anon.login(world.alex.email, PASSWORD),
        anon.get(ME_URL),
        Api().login(world.alex.email, wrong),
        Api().login("nobody@northstar.example", wrong),
        Api().post(LOGIN_URL, {"email": "", "password": wrong}),
    ]
    for response in responses:
        for secret in (PASSWORD.encode(), wrong.encode(), b"pbkdf2", b"argon2"):
            assert secret not in response.content


def test_wrong_password_unknown_email_and_inactive_are_identical(world: World) -> None:
    make_user(world.north, "gone@northstar.example", "Gone Person", is_active=False)
    responses = [
        Api().login(world.alex.email, "wrong-password-123"),
        Api().login("nobody@northstar.example", "wrong-password-123"),
        Api().login("gone@northstar.example", PASSWORD),
    ]
    for response in responses:
        assert_error(response, 401, "invalid_credentials", MSG_INVALID_CREDENTIALS)
    assert len({r.content for r in responses}) == 1
    assert len({r.status_code for r in responses}) == 1


def test_failed_login_creates_no_session(world: World, anon: Api) -> None:
    anon.login(world.alex.email, "wrong-password-123")
    assert anon.get(ME_URL).status_code == 401


@pytest.mark.parametrize(
    ("body", "field", "code"),
    [
        ({"password": PASSWORD}, "email", "required"),
        ({"email": "", "password": PASSWORD}, "email", "required"),
        ({"email": "   ", "password": PASSWORD}, "email", "required"),
        ({"email": None, "password": PASSWORD}, "email", "required"),
        ({"email": 5, "password": PASSWORD}, "email", "invalid_format"),
        ({"email": "alex@northstar.example"}, "password", "required"),
        ({"email": "alex@northstar.example", "password": ""}, "password", "required"),
        ({"email": "alex@northstar.example", "password": None}, "password", "required"),
        ({"email": "alex@northstar.example", "password": 12345}, "password", "invalid_format"),
    ],
)
def test_login_missing_or_empty_fields(
    world: World, anon: Api, body: dict, field: str, code: str
) -> None:
    response = anon.post(LOGIN_URL, body)
    assert field_codes(response, field)[0] == code
    assert anon.get(ME_URL).status_code == 401


def test_login_both_fields_missing_reports_both(world: World, anon: Api) -> None:
    response = anon.post(LOGIN_URL, {})
    assert field_codes(response, "email") == ["required"]
    assert set(response.json()["error"]["fields"]) == {"email", "password"}


def test_login_malformed_json_is_body_error(anon: Api) -> None:
    response = anon.post(LOGIN_URL, raw="{not json")
    assert field_codes(response, "_body") == ["invalid_format"]


def test_login_email_case_insensitive_and_trimmed(world: World, anon: Api) -> None:
    response = anon.login("  ALEX@Northstar.EXAMPLE \t", PASSWORD)
    assert response.status_code == 200
    assert response.json()["email"] == "alex@northstar.example"


def test_login_password_is_not_trimmed(world: World, anon: Api) -> None:
    response = anon.login(world.alex.email, f" {PASSWORD} ")
    assert_error(response, 401, "invalid_credentials", MSG_INVALID_CREDENTIALS)


def test_login_password_with_spaces_is_kept(world: World) -> None:
    make_user(world.north, "pad@northstar.example", "Pad User", password="  spaced pass 12  ")
    ok = Api().login("pad@northstar.example", "  spaced pass 12  ")
    assert ok.status_code == 200
    bad = Api().login("pad@northstar.example", "spaced pass 12")
    assert bad.status_code == 401


def test_me_returns_user(world: World, login_as) -> None:
    api = login_as(world.riley)
    response = api.get(ME_URL)
    assert response.status_code == 200
    assert_user_body(response.json(), world.riley)


def test_me_anonymous_is_401_not_403(anon: Api) -> None:
    response = anon.get(ME_URL)
    assert_error(response, 401, "not_authenticated", MSG_NOT_AUTHENTICATED)


def test_logout_destroys_session(world: World, login_as) -> None:
    api = login_as(world.alex)
    old_session = api.client.cookies["sessionid"].value
    response = api.post(LOGOUT_URL)
    assert response.status_code == 204
    assert api.get(ME_URL).status_code == 401
    assert api.get(LIST_URL).status_code == 401
    # The old session id must be dead on the server, not just removed from the cookie jar.
    replay = Api()
    replay.client.cookies["sessionid"] = old_session
    assert_error(replay.get(ME_URL), 401, "not_authenticated", MSG_NOT_AUTHENTICATED)


def test_logout_anonymous_is_401(world: World, anon: Api) -> None:
    response = anon.post(LOGOUT_URL)
    assert_error(response, 401, "not_authenticated", MSG_NOT_AUTHENTICATED)


def test_login_while_signed_in_replaces_session(world: World, login_as) -> None:
    api = login_as(world.alex)
    old_session = api.client.cookies["sessionid"].value
    response = api.login(world.jordan.email, PASSWORD)
    assert response.status_code == 200
    assert api.client.cookies["sessionid"].value != old_session
    assert api.get(ME_URL).json()["id"] == str(world.jordan.id)
    stale = Api()
    stale.client.cookies["sessionid"] = old_session
    assert stale.get(ME_URL).status_code == 401


def test_login_without_csrf_token_is_403(world: World, anon: Api) -> None:
    response = anon.login(world.alex.email, PASSWORD, csrf=False)
    assert_error(response, 403, "csrf_failed", MSG_CSRF)
    assert anon.get(ME_URL).status_code == 401


def test_login_with_wrong_csrf_token_is_403(world: World, anon: Api) -> None:
    anon.get(CSRF_URL)
    response = anon.login(world.alex.email, PASSWORD, token="not-the-token")
    assert_error(response, 403, "csrf_failed", MSG_CSRF)


def test_logout_without_csrf_token_is_403_and_keeps_session(world: World, login_as) -> None:
    api = login_as(world.alex)
    response = api.post(LOGOUT_URL, csrf=False)
    assert_error(response, 403, "csrf_failed", MSG_CSRF)
    assert api.get(ME_URL).status_code == 200


def test_csrf_token_rotates_at_login(world: World, anon: Api) -> None:
    before = anon.csrf_token()
    anon.login(world.alex.email, PASSWORD)
    after = anon.client.cookies["csrftoken"].value
    assert after != before
    # The pre-login token no longer works for an unsafe request.
    response = anon.post(LOGOUT_URL, token=before)
    assert_error(response, 403, "csrf_failed", MSG_CSRF)


def test_csrf_failure_reports_before_credentials(world: World, anon: Api) -> None:
    response = anon.post(LOGIN_URL, {}, csrf=False)
    assert_error(response, 403, "csrf_failed", MSG_CSRF)
