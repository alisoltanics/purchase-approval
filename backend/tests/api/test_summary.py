"""GET /api/requests/summary/: counts behind the list's status tabs (owner amendment, T10)."""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from .conftest import World, make_request, make_user
from .helpers import (
    LIST_URL,
    MSG_METHOD,
    MSG_NOT_AUTHENTICATED,
    Api,
    assert_error,
)

pytestmark = pytest.mark.django_db

SUMMARY_URL = "/api/requests/summary/"


@pytest.fixture
def mixed(world: World) -> None:
    make_request(world.alex)
    make_request(world.alex)
    make_request(world.sam)
    make_request(
        world.alex,
        status="approved",
        decided_by=world.jordan,
    )
    make_request(
        world.sam,
        status="rejected",
        decided_by=world.jordan,
        rejection_reason="No budget.",
    )
    make_request(world.jordan)
    make_request(world.casey)
    make_request(
        world.casey,
        status="approved",
        decided_by=world.riley,
    )


def test_shape_and_manager_counts(world: World, mixed, login_as) -> None:
    response = login_as(world.jordan).get(SUMMARY_URL)
    assert response.status_code == 200
    assert response.json() == {
        "all": 6,
        "pending": 4,
        "approved": 1,
        "rejected": 1,
    }


def test_employee_counts_only_own_requests(world: World, mixed, login_as) -> None:
    assert login_as(world.alex).get(SUMMARY_URL).json() == {
        "all": 3,
        "pending": 2,
        "approved": 1,
        "rejected": 0,
    }
    assert login_as(world.sam).get(SUMMARY_URL).json() == {
        "all": 2,
        "pending": 1,
        "approved": 0,
        "rejected": 1,
    }


def test_other_company_is_never_counted(world: World, mixed, login_as) -> None:
    assert login_as(world.riley).get(SUMMARY_URL).json() == {
        "all": 2,
        "pending": 1,
        "approved": 1,
        "rejected": 0,
    }


def test_user_without_requests_gets_zeros(world: World, mixed, login_as) -> None:
    newcomer = make_user(
        world.north,
        "newcomer@northstar.example",
        "New Person",
    )
    assert login_as(newcomer).get(SUMMARY_URL).json() == {
        "all": 0,
        "pending": 0,
        "approved": 0,
        "rejected": 0,
    }


def test_second_manager_sees_the_same_company_counts(world: World, mixed, login_as) -> None:
    taylor = login_as(world.taylor).get(SUMMARY_URL).json()
    jordan = login_as(world.jordan).get(SUMMARY_URL).json()
    assert taylor == jordan


def test_all_is_the_sum_of_the_statuses(world: World, mixed, login_as) -> None:
    for user in (world.alex, world.sam, world.jordan, world.casey, world.riley):
        counts = login_as(user).get(SUMMARY_URL).json()
        assert counts["all"] == counts["pending"] + counts["approved"] + counts["rejected"]


def test_counts_equal_the_list_totals(world: World, mixed, login_as) -> None:
    for user in (world.alex, world.jordan, world.casey):
        api = login_as(user)
        counts = api.get(SUMMARY_URL).json()
        assert api.get(LIST_URL).json()["count"] == counts["all"]
        for status in ("pending", "approved", "rejected"):
            listed = api.get(LIST_URL, {"status": status}).json()["count"]
            assert listed == counts[status]


def test_counts_follow_a_decision(world: World, login_as) -> None:
    row = make_request(world.alex)
    manager = login_as(world.jordan)
    assert manager.get(SUMMARY_URL).json()["pending"] == 1
    assert manager.approve(row.id).status_code == 200
    assert manager.get(SUMMARY_URL).json() == {
        "all": 1,
        "pending": 0,
        "approved": 1,
        "rejected": 0,
    }


def test_filter_and_page_parameters_are_ignored(world: World, mixed, login_as) -> None:
    api = login_as(world.jordan)
    plain = api.get(SUMMARY_URL).json()
    assert api.get(SUMMARY_URL, {"status": "approved", "page": "9"}).json() == plain


def test_is_not_mistaken_for_a_request_id(world: World, login_as) -> None:
    response = login_as(world.alex).get(SUMMARY_URL)
    assert response.status_code == 200
    assert "error" not in response.json()


def test_anonymous_is_401(world: World, anon: Api) -> None:
    assert_error(anon.get(SUMMARY_URL), 401, "not_authenticated", MSG_NOT_AUTHENTICATED)


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
def test_only_get_exists(world: World, login_as, method: str) -> None:
    response = login_as(world.alex).send(method, SUMMARY_URL, {})
    assert_error(response, 405, "method_not_allowed", MSG_METHOD)
    advertised = {m.strip() for m in response["Allow"].split(",")}
    assert "GET" in advertised
    assert not advertised & {"PUT", "PATCH", "DELETE", "POST"}


def test_no_store_header(world: World, login_as) -> None:
    assert login_as(world.alex).get(SUMMARY_URL)["Cache-Control"] == "no-store"


def test_one_query_however_many_requests(world: World, login_as) -> None:
    api = login_as(world.jordan)
    make_request(world.alex)
    with CaptureQueriesContext(connection) as small:
        api.get(SUMMARY_URL)
    for _ in range(15):
        make_request(world.alex)
    with CaptureQueriesContext(connection) as large:
        api.get(SUMMARY_URL)
    assert len(small) == len(large)
