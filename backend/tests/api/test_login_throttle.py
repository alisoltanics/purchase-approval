"""Sign-in throttling (D-24): failed attempts per normalized email and per client IP."""

import pytest
from django.test import RequestFactory

from accounts import throttling

from .conftest import PASSWORD, World
from .helpers import MSG_INVALID_CREDENTIALS, Api

WRONG = "wrong-password-123"


def api_from(ip: str) -> Api:
    api = Api()
    api.client.defaults["REMOTE_ADDR"] = ip
    return api


def fail(api: Api, email: str, times: int) -> None:
    for _ in range(times):
        assert api.login(email, WRONG).status_code == 401


def assert_throttled(response) -> None:
    assert response.status_code == 429
    assert response.json() == {"error": {"code": "throttled", "message": "Request was throttled."}}
    assert 0 < int(response["Retry-After"]) <= throttling.WINDOW_SECONDS
    assert response["Cache-Control"] == "no-store"


def test_email_is_locked_after_max_failures_even_with_the_right_password(world: World) -> None:
    api = api_from("10.0.0.1")
    fail(api, world.alex.email, throttling.MAX_FAILURES_PER_EMAIL)
    response = api.login(world.alex.email, PASSWORD)
    assert_throttled(response)
    assert "sessionid" not in api.client.cookies


def test_email_lock_does_not_depend_on_the_ip_or_on_case_and_spaces(world: World) -> None:
    for n in range(throttling.MAX_FAILURES_PER_EMAIL):
        email = f"  {world.alex.email.upper()} " if n % 2 else world.alex.email
        fail(api_from(f"10.0.1.{n}"), email, 1)
    assert_throttled(api_from("10.0.2.1").login(world.alex.email, PASSWORD))


def test_one_attempt_below_the_limit_still_signs_in(world: World) -> None:
    api = api_from("10.0.0.1")
    fail(api, world.alex.email, throttling.MAX_FAILURES_PER_EMAIL - 1)
    assert api.login(world.alex.email, PASSWORD).status_code == 200


def test_unknown_email_is_throttled_the_same_way(world: World) -> None:
    api = api_from("10.0.0.1")
    fail(api, "nobody@northstar.example", throttling.MAX_FAILURES_PER_EMAIL)
    assert_throttled(api.login("nobody@northstar.example", WRONG))


def test_other_emails_are_not_affected_by_one_locked_email(world: World) -> None:
    fail(api_from("10.0.0.1"), world.alex.email, throttling.MAX_FAILURES_PER_EMAIL)
    assert api_from("10.0.0.2").login(world.jordan.email, PASSWORD).status_code == 200


def test_successful_sign_in_clears_the_email_counter(world: World) -> None:
    api = api_from("10.0.0.1")
    fail(api, world.alex.email, throttling.MAX_FAILURES_PER_EMAIL - 1)
    assert api.login(world.alex.email, PASSWORD).status_code == 200
    other = api_from("10.0.0.1")
    fail(other, world.alex.email, throttling.MAX_FAILURES_PER_EMAIL - 1)
    response = other.login(world.alex.email, WRONG)
    assert response.status_code == 401
    assert response.json()["error"]["message"] == MSG_INVALID_CREDENTIALS


def test_lock_ends_when_the_window_passes(world: World, monkeypatch) -> None:
    clock = 1_000_000.0
    monkeypatch.setattr(throttling, "now", lambda: clock)
    api = api_from("10.0.0.1")
    fail(api, world.alex.email, throttling.MAX_FAILURES_PER_EMAIL)
    assert_throttled(api.login(world.alex.email, PASSWORD))
    clock += throttling.WINDOW_SECONDS
    assert api.login(world.alex.email, PASSWORD).status_code == 200


def test_retry_after_counts_down_from_the_first_failure(world: World, monkeypatch) -> None:
    clock = 1_000_000.0
    monkeypatch.setattr(throttling, "now", lambda: clock)
    api = api_from("10.0.0.1")
    fail(api, world.alex.email, throttling.MAX_FAILURES_PER_EMAIL)
    clock += 100.5
    response = api.login(world.alex.email, PASSWORD)
    assert response["Retry-After"] == str(throttling.WINDOW_SECONDS - 100)


def test_ip_is_locked_after_max_failures_across_many_emails(world: World) -> None:
    api = api_from("10.9.9.9")
    for n in range(throttling.MAX_FAILURES_PER_IP):
        fail(api, f"spray{n}@northstar.example", 1)
    assert_throttled(api.login(world.alex.email, PASSWORD))
    assert api_from("10.9.9.10").login(world.alex.email, PASSWORD).status_code == 200


def test_validation_errors_are_not_counted(world: World) -> None:
    api = api_from("10.0.0.1")
    for _ in range(throttling.MAX_FAILURES_PER_EMAIL):
        assert api.login(world.alex.email, "").status_code == 400
    assert api.login(world.alex.email, PASSWORD).status_code == 200


@pytest.mark.parametrize(
    ("proxies", "forwarded", "expected"),
    [
        (0, "1.1.1.1", "10.0.0.1"),
        (1, "1.1.1.1", "1.1.1.1"),
        (1, "6.6.6.6, 1.1.1.1", "1.1.1.1"),
        (2, "6.6.6.6, 1.1.1.1, 2.2.2.2", "1.1.1.1"),
        (1, "", "10.0.0.1"),
        (2, "1.1.1.1", "10.0.0.1"),
    ],
)
def test_client_ip_trusts_only_the_configured_proxy_hops(settings, proxies, forwarded, expected):
    settings.TRUSTED_PROXY_COUNT = proxies
    request = RequestFactory().post("/", REMOTE_ADDR="10.0.0.1", HTTP_X_FORWARDED_FOR=forwarded)
    assert throttling.client_ip(request) == expected
