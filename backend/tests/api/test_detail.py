"""GET /api/requests/{id}/ (AC-14, AC-19, AC-22, AC-23)."""

import uuid
from datetime import timedelta

import pytest

from approvals.models import PurchaseRequest

from .conftest import BASE_TIME, World, make_request
from .helpers import (
    MSG_UNAVAILABLE,
    TS_RE,
    assert_detail_shape,
    assert_unavailable,
    detail_url,
)

pytestmark = pytest.mark.django_db


def ref(user) -> dict[str, str]:
    return {"id": str(user.id), "display_name": user.display_name}


def test_detail_pending_all_fields(world: World, login_as) -> None:
    row = make_request(
        world.alex,
        title="Desk",
        vendor="Ergo",
        description="Line 1\nLine 2",
        amount="4200",
        submitted_at=BASE_TIME + timedelta(seconds=5, microseconds=999999),
    )
    response = login_as(world.alex).get(detail_url(row.id))
    assert response.status_code == 200
    data = response.json()
    assert_detail_shape(data)
    assert data["id"] == str(row.id)
    assert data["title"] == "Desk"
    assert data["vendor"] == "Ergo"
    assert data["description"] == "Line 1\nLine 2"
    assert data["amount"] == "4200.00"
    assert data["currency"] == "USD"
    assert data["status"] == "pending"
    # Truncated, not rounded, to whole seconds.
    assert data["submitted_at"] == "2026-10-01T09:00:05Z"
    assert data["requester"] == ref(world.alex)
    assert data["decided_by"] is None
    assert data["decided_at"] is None
    assert data["rejection_reason"] is None
    assert data["can_decide"] is False
    assert data["events"] == [
        {
            "type": "submitted",
            "actor": ref(world.alex),
            "created_at": "2026-10-01T09:00:05Z",
            "reason": None,
        }
    ]


def test_detail_approved_has_two_events(world: World, login_as) -> None:
    row = make_request(
        world.alex,
        status="approved",
        decided_by=world.jordan,
        submitted_at=BASE_TIME,
        decided_at=BASE_TIME + timedelta(days=1, seconds=7),
    )
    for user in (world.alex, world.jordan, world.taylor):
        data = login_as(user).get(detail_url(row.id)).json()
        assert data["status"] == "approved"
        assert data["decided_by"] == ref(world.jordan)
        assert data["decided_at"] == "2026-10-02T09:00:07Z"
        assert data["rejection_reason"] is None
        assert data["can_decide"] is False
        assert data["events"] == [
            {
                "type": "submitted",
                "actor": ref(world.alex),
                "created_at": "2026-10-01T09:00:00Z",
                "reason": None,
            },
            {
                "type": "approved",
                "actor": ref(world.jordan),
                "created_at": "2026-10-02T09:00:07Z",
                "reason": None,
            },
        ]


def test_requester_sees_rejection_reason_and_actor(world: World, login_as) -> None:
    row = make_request(
        world.sam,
        status="rejected",
        decided_by=world.taylor,
        rejection_reason="Over budget.\nTry next quarter.",
    )
    data = login_as(world.sam).get(detail_url(row.id)).json()
    assert data["status"] == "rejected"
    assert data["rejection_reason"] == "Over budget.\nTry next quarter."
    assert data["decided_by"] == ref(world.taylor)
    assert TS_RE.match(data["decided_at"])
    assert [e["type"] for e in data["events"]] == ["submitted", "rejected"]
    assert data["events"][1]["actor"] == ref(world.taylor)
    assert data["events"][1]["reason"] == "Over budget.\nTry next quarter."
    assert data["events"][1]["created_at"] == data["decided_at"]


def test_events_order_with_equal_timestamps(world: World, login_as) -> None:
    row = make_request(world.alex, status="approved", decided_by=world.jordan, decided_at=BASE_TIME)
    data = login_as(world.alex).get(detail_url(row.id)).json()
    assert data["submitted_at"] == data["decided_at"]
    assert [e["type"] for e in data["events"]] == ["submitted", "approved"]


@pytest.mark.parametrize(
    ("viewer", "status", "expected"),
    [
        ("jordan", "pending", True),
        ("taylor", "pending", True),
        ("jordan", "approved", False),
        ("jordan", "rejected", False),
        ("alex", "pending", False),
    ],
)
def test_can_decide_on_others_request(
    world: World, login_as, viewer: str, status: str, expected: bool
) -> None:
    kwargs = {}
    if status != "pending":
        kwargs = {"decided_by": world.taylor, "rejection_reason": "No."}
    row = make_request(world.alex, status=status, **kwargs)
    viewer_user = getattr(world, viewer)
    data = login_as(viewer_user).get(detail_url(row.id)).json()
    assert data["can_decide"] is expected


def test_can_decide_false_for_own_request_as_manager(world: World, login_as) -> None:
    row = make_request(world.jordan)
    assert login_as(world.jordan).get(detail_url(row.id)).json()["can_decide"] is False


def test_can_decide_false_for_decider_afterwards(world: World, login_as) -> None:
    row = make_request(world.alex, status="approved", decided_by=world.jordan)
    assert login_as(world.jordan).get(detail_url(row.id)).json()["can_decide"] is False


def test_manager_can_open_any_company_request(world: World, login_as) -> None:
    row = make_request(world.sam)
    assert login_as(world.jordan).get(detail_url(row.id)).status_code == 200


def test_text_is_returned_exactly_as_stored(world: World, login_as) -> None:
    text = "<img src=x onerror=alert(1)> &amp; é \U0001f600"
    row = make_request(world.alex, title=text, vendor=text, description=text)
    data = login_as(world.alex).get(detail_url(row.id)).json()
    assert (data["title"], data["vendor"], data["description"]) == (text, text, text)


@pytest.fixture
def unavailable_baseline(world: World, login_as) -> tuple:
    """The response every inaccessible id must equal byte for byte."""
    api = login_as(world.alex)
    response = api.get(detail_url(uuid.uuid4()))
    assert_unavailable(response)
    return response.status_code, response.content


def test_nonexistent_id_body(world: World, login_as) -> None:
    response = login_as(world.alex).get(detail_url(uuid.uuid4()))
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "request_unavailable", "message": MSG_UNAVAILABLE}}


@pytest.mark.parametrize(
    "bad_id",
    [
        "abc",
        "123",
        "not-a-uuid",
        "00000000-0000-0000-0000-000000000000",
        "86935E09-143B-482A-BF3C-F7400BC4B6DE",
        "86935e09143b482abf3cf7400bc4b6de",
        "%20",
        "1" * 200,
        "..%2F..",
        "'; DROP TABLE x;--",
        "éé",
    ],
)
def test_malformed_or_unknown_ids_get_identical_404(
    world: World, login_as, unavailable_baseline, bad_id: str
) -> None:
    for user in (world.alex, world.jordan):
        response = login_as(user).get(f"/api/requests/{bad_id}/")
        assert (response.status_code, response.content) == unavailable_baseline


def test_other_company_request_is_identical_404(
    world: World, login_as, unavailable_baseline
) -> None:
    row = make_request(world.casey)
    for user in (world.alex, world.jordan, world.taylor):
        response = login_as(user).get(detail_url(row.id))
        assert (response.status_code, response.content) == unavailable_baseline
    foreign = make_request(world.alex)
    for user in (world.casey, world.riley):
        response = login_as(user).get(detail_url(foreign.id))
        assert (response.status_code, response.content) == unavailable_baseline


def test_employee_opening_colleagues_request_is_identical_404(
    world: World, login_as, unavailable_baseline
) -> None:
    row = make_request(world.sam)
    response = login_as(world.alex).get(detail_url(row.id))
    assert (response.status_code, response.content) == unavailable_baseline
    # The owner and a manager still can.
    assert login_as(world.sam).get(detail_url(row.id)).status_code == 200
    assert login_as(world.jordan).get(detail_url(row.id)).status_code == 200


def test_manager_requester_is_not_visible_to_employee(world: World, login_as, unavailable_baseline):
    row = make_request(world.jordan)
    response = login_as(world.alex).get(detail_url(row.id))
    assert (response.status_code, response.content) == unavailable_baseline


def test_404_does_not_leak_request_data(world: World, login_as) -> None:
    row = make_request(world.casey, title="Secret Title", vendor="Secret Vendor")
    response = login_as(world.alex).get(detail_url(row.id))
    for token in (b"Secret", str(row.id).encode(), b"Casey", b"Harbor"):
        assert token not in response.content


def test_get_does_not_modify(world: World, login_as) -> None:
    row = make_request(world.alex)
    before = PurchaseRequest.objects.values().get(id=row.id)
    login_as(world.jordan).get(detail_url(row.id))
    assert PurchaseRequest.objects.values().get(id=row.id) == before
