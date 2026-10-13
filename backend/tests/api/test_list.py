"""GET /api/requests/: visibility, filter, paging, ordering (AC-05, AC-06, AC-07, AC-22)."""

import uuid
from datetime import timedelta

import pytest

from approvals.models import PurchaseRequest

from .conftest import BASE_TIME, World, make_request
from .helpers import LIST_ITEM_KEYS, LIST_URL, TS_RE, Api, field_codes

pytestmark = pytest.mark.django_db


def ids(response) -> list[str]:
    return [item["id"] for item in response.json()["results"]]


@pytest.fixture
def mixed(world: World) -> dict[str, PurchaseRequest]:
    """Requests across both companies and all statuses."""
    t = BASE_TIME
    return {
        "alex_p": make_request(world.alex, submitted_at=t + timedelta(minutes=1)),
        "alex_a": make_request(
            world.alex,
            status="approved",
            decided_by=world.jordan,
            submitted_at=t + timedelta(minutes=2),
        ),
        "sam_p": make_request(world.sam, submitted_at=t + timedelta(minutes=3)),
        "sam_r": make_request(
            world.sam,
            status="rejected",
            decided_by=world.jordan,
            rejection_reason="No budget.",
            submitted_at=t + timedelta(minutes=4),
        ),
        "jordan_p": make_request(world.jordan, submitted_at=t + timedelta(minutes=5)),
        "casey_p": make_request(world.casey, submitted_at=t + timedelta(minutes=6)),
        "casey_a": make_request(
            world.casey,
            status="approved",
            decided_by=world.riley,
            submitted_at=t + timedelta(minutes=7),
        ),
    }


def test_employee_sees_only_own(world: World, mixed, login_as) -> None:
    response = login_as(world.alex).get(LIST_URL)
    assert response.status_code == 200
    assert ids(response) == [str(mixed["alex_a"].id), str(mixed["alex_p"].id)]
    assert response.json()["count"] == 2


def test_manager_sees_whole_company_including_own(world: World, mixed, login_as) -> None:
    response = login_as(world.jordan).get(LIST_URL)
    expected = ["jordan_p", "sam_r", "sam_p", "alex_a", "alex_p"]
    assert ids(response) == [str(mixed[k].id) for k in expected]
    assert response.json()["count"] == 5


def test_other_company_manager_sees_only_theirs(world: World, mixed, login_as) -> None:
    response = login_as(world.riley).get(LIST_URL)
    assert ids(response) == [str(mixed["casey_a"].id), str(mixed["casey_p"].id)]
    assert response.json()["count"] == 2


def test_never_leaks_other_company_in_results_or_counts(world: World, mixed, login_as) -> None:
    foreign = {str(mixed["casey_p"].id), str(mixed["casey_a"].id)}
    for user in (world.alex, world.sam, world.jordan, world.taylor):
        api = login_as(user)
        for params in ({}, {"status": "pending"}, {"status": "approved"}, {"page": "9"}):
            data = api.get(LIST_URL, params).json()
            assert not foreign & {item["id"] for item in data["results"]}
    # Taylor has no requests of their own but sees the company's 5.
    assert login_as(world.taylor).get(LIST_URL).json()["count"] == 5
    # Employee without requests sees nothing, not company totals.
    assert login_as(world.casey).get(LIST_URL, {"status": "rejected"}).json()["count"] == 0


def test_item_shape(world: World, mixed, login_as) -> None:
    item = login_as(world.jordan).get(LIST_URL).json()["results"][0]
    assert set(item) == LIST_ITEM_KEYS
    assert item["currency"] == "USD"
    assert item["amount"] == "10.00"
    assert TS_RE.match(item["submitted_at"])
    assert item["requester"] == {"id": str(world.jordan.id), "display_name": "Jordan Lee"}


def test_envelope_keys(world: World, mixed, login_as) -> None:
    data = login_as(world.jordan).get(LIST_URL).json()
    assert set(data) == {"count", "page", "page_size", "page_count", "results"}
    assert (data["page"], data["page_size"], data["page_count"]) == (1, 20, 1)


@pytest.mark.parametrize(
    ("status", "expected"),
    [
        ("pending", ["jordan_p", "sam_p", "alex_p"]),
        ("approved", ["alex_a"]),
        ("rejected", ["sam_r"]),
    ],
)
def test_status_filter_for_manager(world: World, mixed, login_as, status, expected) -> None:
    response = login_as(world.jordan).get(LIST_URL, {"status": status})
    assert ids(response) == [str(mixed[k].id) for k in expected]
    data = response.json()
    assert data["count"] == len(expected)
    assert {item["status"] for item in data["results"]} == {status}


def test_status_filter_applies_visibility_first(world: World, mixed, login_as) -> None:
    data = login_as(world.alex).get(LIST_URL, {"status": "pending"}).json()
    assert [i["id"] for i in data["results"]] == [str(mixed["alex_p"].id)]
    assert data["count"] == 1


@pytest.mark.parametrize("value", ["", "all", "PENDING", "Pending", "done", " pending", "1"])
def test_invalid_status_is_invalid_choice(world: World, login_as, value: str) -> None:
    response = login_as(world.alex).get(LIST_URL, {"status": value})
    assert field_codes(response, "status") == ["invalid_choice"]


@pytest.mark.parametrize("value", ["0", "-1", "abc", "1.5", "", " 1", "1 ", "+1", "١", "1e1"])
def test_invalid_page_is_invalid_format(world: World, login_as, value: str) -> None:
    response = login_as(world.alex).get(LIST_URL, {"page": value})
    assert field_codes(response, "page") == ["invalid_format"]


def test_both_invalid_params_report_both(world: World, login_as) -> None:
    response = login_as(world.alex).get(LIST_URL, {"page": "0", "status": "x"})
    assert response.status_code == 400
    assert set(response.json()["error"]["fields"]) == {"status", "page"}


def test_unknown_query_params_ignored(world: World, mixed, login_as) -> None:
    api = login_as(world.alex)
    plain = api.get(LIST_URL).json()
    noisy = api.get(LIST_URL, {"foo": "bar", "company": str(world.harbor.id), "sort": "x"})
    assert noisy.status_code == 200
    assert noisy.json() == plain


def test_empty_result(world: World, login_as) -> None:
    data = login_as(world.alex).get(LIST_URL).json()
    assert data == {"count": 0, "page": 1, "page_size": 20, "page_count": 1, "results": []}


def test_empty_after_filter_and_overshoot_page(world: World, mixed, login_as) -> None:
    data = login_as(world.casey).get(LIST_URL, {"status": "rejected", "page": "5"}).json()
    assert data == {"count": 0, "page": 1, "page_size": 20, "page_count": 1, "results": []}


@pytest.fixture
def forty_five(world: World) -> list[PurchaseRequest]:
    """45 pending requests for Alex with distinct times."""
    return [
        make_request(world.alex, title=f"Req {n}", submitted_at=BASE_TIME + timedelta(minutes=n))
        for n in range(45)
    ]


def test_pagination_pages(world: World, forty_five, login_as) -> None:
    api = login_as(world.alex)
    newest_first = [str(r.id) for r in reversed(forty_five)]
    for page, size in ((1, 20), (2, 20), (3, 5)):
        data = api.get(LIST_URL, {"page": str(page)}).json()
        assert (data["count"], data["page"], data["page_size"], data["page_count"]) == (
            45,
            page,
            20,
            3,
        )
        start = (page - 1) * 20
        assert [i["id"] for i in data["results"]] == newest_first[start : start + size]


def test_page_above_last_is_clamped(world: World, forty_five, login_as) -> None:
    api = login_as(world.alex)
    last = api.get(LIST_URL, {"page": "3"}).json()
    for value in ("4", "99", "1000000000000000000000"):
        data = api.get(LIST_URL, {"page": value}).json()
        assert data["page"] == 3
        assert data == last


def test_exact_multiple_of_page_size(world: World, login_as) -> None:
    for n in range(40):
        make_request(world.alex, submitted_at=BASE_TIME + timedelta(minutes=n))
    data = login_as(world.alex).get(LIST_URL, {"page": "3"}).json()
    assert (data["count"], data["page"], data["page_count"], len(data["results"])) == (
        40,
        2,
        2,
        20,
    )


def test_counts_use_filtered_set(world: World, login_as) -> None:
    for n in range(25):
        make_request(world.alex, submitted_at=BASE_TIME + timedelta(minutes=n))
    for n in range(3):
        make_request(
            world.alex,
            status="approved",
            decided_by=world.jordan,
            submitted_at=BASE_TIME + timedelta(hours=1, minutes=n),
        )
    api = login_as(world.alex)
    approved = api.get(LIST_URL, {"status": "approved", "page": "2"}).json()
    assert (approved["count"], approved["page"], approved["page_count"]) == (3, 1, 1)
    pending = api.get(LIST_URL, {"status": "pending"}).json()
    assert (pending["count"], pending["page_count"], len(pending["results"])) == (25, 2, 20)


def test_order_by_submitted_at_desc_not_insertion(world: World, login_as) -> None:
    newest = make_request(world.alex, submitted_at=BASE_TIME + timedelta(days=2))
    oldest = make_request(world.alex, submitted_at=BASE_TIME)
    middle = make_request(world.alex, submitted_at=BASE_TIME + timedelta(days=1))
    data = login_as(world.alex).get(LIST_URL).json()
    assert [i["id"] for i in data["results"]] == [str(r.id) for r in (newest, middle, oldest)]


def test_order_sub_second_precision_is_used(world: World, login_as) -> None:
    first = make_request(world.alex, submitted_at=BASE_TIME + timedelta(milliseconds=100))
    second = make_request(world.alex, submitted_at=BASE_TIME + timedelta(milliseconds=900))
    data = login_as(world.alex).get(LIST_URL).json()
    assert [i["id"] for i in data["results"]] == [str(second.id), str(first.id)]
    assert data["results"][0]["submitted_at"] == data["results"][1]["submitted_at"]


def test_ties_break_by_id_desc_across_pages(world: World, login_as) -> None:
    rows = [make_request(world.alex, request_id=uuid.uuid4()) for _ in range(30)]
    expected = [str(r.id) for r in sorted(rows, key=lambda r: r.id, reverse=True)]
    api = login_as(world.alex)
    page1 = [i["id"] for i in api.get(LIST_URL, {"page": "1"}).json()["results"]]
    page2 = [i["id"] for i in api.get(LIST_URL, {"page": "2"}).json()["results"]]
    assert page1 + page2 == expected


def test_list_is_stable_between_calls(world: World, login_as) -> None:
    for _ in range(25):
        make_request(world.alex)
    api = login_as(world.alex)
    assert api.get(LIST_URL).json() == api.get(LIST_URL).json()


def test_amount_in_list_is_two_decimal_string(world: World, login_as) -> None:
    make_request(world.alex, amount="5")
    make_request(world.alex, amount="999999.99", submitted_at=BASE_TIME + timedelta(minutes=1))
    data = login_as(world.alex).get(LIST_URL).json()
    assert [i["amount"] for i in data["results"]] == ["999999.99", "5.00"]


def test_anonymous_gets_nothing(world: World, mixed, anon: Api) -> None:
    assert anon.get(LIST_URL).status_code == 401
