"""Approve and reject (AC-15..AC-21, AC-24, AC-25, AC-26, AC-29), in contract 3.5 order."""

import uuid

import pytest
from django.db import connection

from approvals.models import PurchaseRequest

from .conftest import PASSWORD, World, make_request
from .helpers import (
    MSG_ALREADY_DECIDED,
    MSG_CSRF,
    MSG_NOT_AUTHENTICATED,
    MSG_NOT_PERMITTED,
    MSG_OWN_REQUEST,
    TS_RE,
    Api,
    approve_url,
    assert_detail_shape,
    assert_error,
    assert_unavailable,
    detail_url,
    field_codes,
    reject_url,
    run_parallel,
)

pytestmark = pytest.mark.django_db


def snapshot(row: PurchaseRequest) -> dict:
    return PurchaseRequest.objects.values().get(id=row.id)


def ref(user) -> dict[str, str]:
    return {"id": str(user.id), "display_name": user.display_name}


def assert_untouched(row: PurchaseRequest, before: dict) -> None:
    assert snapshot(row) == before


# ---- success -------------------------------------------------------------------------------


def test_approve_success(world: World, pending: PurchaseRequest, login_as) -> None:
    response = login_as(world.jordan).approve(pending.id)
    assert response.status_code == 200
    data = response.json()
    assert_detail_shape(data)
    assert data["id"] == str(pending.id)
    assert data["status"] == "approved"
    assert data["decided_by"] == ref(world.jordan)
    assert TS_RE.match(data["decided_at"])
    assert data["rejection_reason"] is None
    assert data["can_decide"] is False
    assert [e["type"] for e in data["events"]] == ["submitted", "approved"]
    assert data["events"][0]["actor"] == ref(world.alex)
    assert data["events"][1] == {
        "type": "approved",
        "actor": ref(world.jordan),
        "created_at": data["decided_at"],
        "reason": None,
    }
    # Input fields are unchanged.
    assert data["title"] == pending.title
    assert data["amount"] == "10.00"
    row = PurchaseRequest.objects.get(id=pending.id)
    assert row.status == "approved"
    assert row.decided_by_id == world.jordan.id
    assert row.decided_at is not None
    assert row.rejection_reason is None
    assert row.requester_id == world.alex.id


def test_reject_success(world: World, pending: PurchaseRequest, login_as) -> None:
    response = login_as(world.taylor).reject(pending.id, "  Over budget.\r\nTry later.  ")
    assert response.status_code == 200
    data = response.json()
    assert_detail_shape(data)
    assert data["status"] == "rejected"
    assert data["decided_by"] == ref(world.taylor)
    assert data["rejection_reason"] == "Over budget.\nTry later."
    assert data["can_decide"] is False
    assert [e["type"] for e in data["events"]] == ["submitted", "rejected"]
    assert data["events"][1] == {
        "type": "rejected",
        "actor": ref(world.taylor),
        "created_at": data["decided_at"],
        "reason": "Over budget.\nTry later.",
    }
    row = PurchaseRequest.objects.get(id=pending.id)
    assert (row.status, row.decided_by_id) == ("rejected", world.taylor.id)
    assert row.rejection_reason == "Over budget.\nTry later."


def test_requester_sees_decision_afterwards(world: World, pending, login_as) -> None:
    """AC-19: status, actor, time and reason survive a fresh login."""
    login_as(world.jordan).reject(pending.id, "Not needed.")
    data = login_as(world.alex).get(detail_url(pending.id)).json()
    assert data["status"] == "rejected"
    assert data["decided_by"] == ref(world.jordan)
    assert TS_RE.match(data["decided_at"])
    assert data["rejection_reason"] == "Not needed."
    assert data["events"][-1]["reason"] == "Not needed."


def test_decision_shows_in_list_filters(world: World, pending, login_as) -> None:
    login_as(world.jordan).approve(pending.id)
    api = login_as(world.alex)
    assert api.get("/api/requests/", {"status": "pending"}).json()["count"] == 0
    assert api.get("/api/requests/", {"status": "approved"}).json()["count"] == 1


def test_decided_at_matches_event_and_is_single_timestamp(world: World, pending, login_as) -> None:
    data = login_as(world.jordan).approve(pending.id).json()
    assert data["events"][1]["created_at"] == data["decided_at"]
    assert data["decided_at"] >= data["submitted_at"]


@pytest.mark.parametrize(
    "body",
    [None, {}, {"reason": "ignored"}, {"status": "rejected", "decided_by": "x"}, [1, 2], "text"],
)
def test_approve_ignores_body(world: World, login_as, body) -> None:
    row = make_request(world.alex)
    response = login_as(world.jordan).approve(row.id, body)
    assert response.status_code == 200
    assert response.json()["status"] == "approved"
    assert response.json()["rejection_reason"] is None
    assert PurchaseRequest.objects.get(id=row.id).rejection_reason is None


def test_approve_ignores_malformed_body_and_content_type(world: World, login_as) -> None:
    api = login_as(world.jordan)
    first = make_request(world.alex)
    second = make_request(world.alex)
    assert api.post(approve_url(first.id), raw="{not json").status_code == 200
    assert api.post(approve_url(second.id), raw="x", content_type="text/plain").status_code == 200


def test_forged_fields_in_decision_bodies_are_ignored(world: World, login_as) -> None:
    row = make_request(world.alex)
    api = login_as(world.jordan)
    body = {
        "reason": "Fine.",
        "status": "approved",
        "decided_by": str(world.taylor.id),
        "decided_at": "2020-01-01T00:00:00Z",
        "company": str(world.harbor.id),
        "requester": str(world.jordan.id),
        "role": "employee",
        "title": "Hacked",
        "amount": "1.00",
        "id": str(uuid.uuid4()),
    }
    response = api.post(reject_url(row.id), body)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "rejected"
    assert data["decided_by"] == ref(world.jordan)
    assert not data["decided_at"].startswith("2020")
    assert data["id"] == str(row.id)
    assert data["title"] == row.title
    assert data["amount"] == "10.00"
    stored = PurchaseRequest.objects.get(id=row.id)
    assert stored.decided_by_id == world.jordan.id
    assert stored.requester_id == world.alex.id
    assert stored.company_id == world.north.id
    assert stored.decided_at.year != 2020


def test_employee_cannot_use_forged_role(world: World, login_as) -> None:
    row = make_request(world.sam)
    api = login_as(world.alex)
    response = api.reject(row.id, "x")
    assert_unavailable(response)
    own = make_request(world.alex)
    forged = api.post(approve_url(own.id), {"role": "manager"})
    assert_error(forged, 403, "not_permitted", MSG_NOT_PERMITTED)
    assert PurchaseRequest.objects.get(id=own.id).status == "pending"


# ---- check order (D-18) ----------------------------------------------------------------------


def test_1_anonymous_is_401(world: World, pending, anon: Api) -> None:
    before = snapshot(pending)
    for response in (anon.approve(pending.id), anon.reject(pending.id, "")):
        assert_error(response, 401, "not_authenticated", MSG_NOT_AUTHENTICATED)
    assert_untouched(pending, before)


def test_1_anonymous_without_csrf_is_still_checked_for_session_first(world, pending, anon) -> None:
    response = anon.approve(pending.id, csrf=False)
    assert_error(response, 401, "not_authenticated", MSG_NOT_AUTHENTICATED)


def test_2_csrf_is_403(world: World, pending, login_as) -> None:
    before = snapshot(pending)
    api = login_as(world.jordan)
    assert_error(api.approve(pending.id, csrf=False), 403, "csrf_failed", MSG_CSRF)
    assert_error(api.reject(pending.id, "ok", csrf=False), 403, "csrf_failed", MSG_CSRF)
    assert_error(api.approve(pending.id, token="bad-token"), 403, "csrf_failed", MSG_CSRF)
    assert_untouched(pending, before)


def test_2_csrf_beats_visibility(world: World, login_as) -> None:
    api = login_as(world.alex)
    response = api.approve(uuid.uuid4(), csrf=False)
    assert_error(response, 403, "csrf_failed", MSG_CSRF)


def test_3_not_visible_is_404_before_everything_else(world: World, login_as) -> None:
    api = login_as(world.alex)
    baseline = api.approve(uuid.uuid4())
    assert_unavailable(baseline)
    colleague = make_request(world.sam)
    foreign = make_request(world.casey)
    decided_colleague = make_request(world.sam, status="approved", decided_by=world.jordan)
    for row in (colleague, foreign, decided_colleague):
        for response in (api.approve(row.id), api.reject(row.id, ""), api.reject(row.id, "ok")):
            assert (response.status_code, response.content) == (
                baseline.status_code,
                baseline.content,
            )
    for bad in ("abc", "123"):
        response = api.post(approve_url(bad))
        assert (response.status_code, response.content) == (baseline.status_code, baseline.content)


def test_3_other_company_manager_gets_404_and_nothing_changes(world: World, login_as) -> None:
    row = make_request(world.alex)
    before = snapshot(row)
    api = login_as(world.riley)
    assert_unavailable(api.approve(row.id))
    assert_unavailable(api.reject(row.id, "no"))
    assert_untouched(row, before)
    decided = make_request(world.alex, status="approved", decided_by=world.jordan)
    assert_unavailable(api.approve(decided.id))


def test_4_employee_deciding_own_request_is_not_permitted(world: World, login_as) -> None:
    row = make_request(world.alex)
    before = snapshot(row)
    api = login_as(world.alex)
    assert_error(api.approve(row.id), 403, "not_permitted", MSG_NOT_PERMITTED)
    assert_error(api.reject(row.id, "x"), 403, "not_permitted", MSG_NOT_PERMITTED)
    assert_error(api.reject(row.id, ""), 403, "not_permitted", MSG_NOT_PERMITTED)
    assert_untouched(row, before)


def test_4_employee_own_decided_request_is_still_not_permitted(world: World, login_as) -> None:
    row = make_request(world.alex, status="approved", decided_by=world.jordan)
    assert_error(login_as(world.alex).approve(row.id), 403, "not_permitted", MSG_NOT_PERMITTED)


def test_5_manager_deciding_own_request(world: World, login_as) -> None:
    row = make_request(world.jordan)
    before = snapshot(row)
    api = login_as(world.jordan)
    assert_error(api.approve(row.id), 403, "own_request", MSG_OWN_REQUEST)
    assert_error(api.reject(row.id, "x"), 403, "own_request", MSG_OWN_REQUEST)
    assert_error(api.reject(row.id, ""), 403, "own_request", MSG_OWN_REQUEST)
    assert_untouched(row, before)


def test_5_own_request_can_be_decided_by_another_manager(world: World, login_as) -> None:
    row = make_request(world.jordan)
    assert login_as(world.jordan).approve(row.id).status_code == 403
    response = login_as(world.taylor).approve(row.id)
    assert response.status_code == 200
    assert response.json()["decided_by"] == ref(world.taylor)


def test_5_own_request_checked_before_status(world: World, login_as) -> None:
    row = make_request(world.taylor, status="approved", decided_by=world.jordan)
    assert_error(login_as(world.taylor).approve(row.id), 403, "own_request", MSG_OWN_REQUEST)


@pytest.mark.parametrize("first", ["approved", "rejected"])
@pytest.mark.parametrize("action", ["approve", "reject"])
def test_6_non_pending_is_409_with_current_state(
    world: World, login_as, first: str, action: str
) -> None:
    row = make_request(
        world.alex,
        status=first,
        decided_by=world.jordan,
        rejection_reason="Earlier reason.",
    )
    before = snapshot(row)
    api = login_as(world.taylor)
    response = api.approve(row.id) if action == "approve" else api.reject(row.id, "Late.")
    error = assert_error(
        response, 409, "already_decided", MSG_ALREADY_DECIDED, extra_keys={"request"}
    )
    current = error["request"]
    assert_detail_shape(current)
    assert current["id"] == str(row.id)
    assert current["status"] == first
    assert current["decided_by"] == ref(world.jordan)
    assert current["can_decide"] is False
    assert len(current["events"]) == 2
    assert current["events"][1]["type"] == first
    assert current == login_as(world.taylor).get(detail_url(row.id)).json()
    assert_untouched(row, before)


def test_6_same_manager_repeating_gets_409_not_success(world: World, pending, login_as) -> None:
    api = login_as(world.jordan)
    first = api.approve(pending.id)
    assert first.status_code == 200
    stored = snapshot(pending)
    for response in (api.approve(pending.id), api.reject(pending.id, "Changed my mind.")):
        error = assert_error(
            response, 409, "already_decided", MSG_ALREADY_DECIDED, extra_keys={"request"}
        )
        assert error["request"]["status"] == "approved"
        assert error["request"]["decided_at"] == first.json()["decided_at"]
        assert len(error["request"]["events"]) == 2
    assert snapshot(pending) == stored


def test_6_reject_then_approve_keeps_rejection(world: World, pending, login_as) -> None:
    login_as(world.jordan).reject(pending.id, "Nope.")
    response = login_as(world.taylor).approve(pending.id)
    assert response.status_code == 409
    row = PurchaseRequest.objects.get(id=pending.id)
    assert (row.status, row.rejection_reason, row.decided_by_id) == (
        "rejected",
        "Nope.",
        world.jordan.id,
    )


@pytest.mark.parametrize("reason", ["", "   ", "\n\t ", "x" * 1001, None, 5, ["a"]])
def test_6_conflict_is_reported_before_body_validation(world: World, login_as, reason) -> None:
    row = make_request(world.alex, status="approved", decided_by=world.jordan)
    response = login_as(world.taylor).reject(row.id, reason)
    assert_error(response, 409, "already_decided", MSG_ALREADY_DECIDED, extra_keys={"request"})


# ---- reject body validation (AC-17) ----------------------------------------------------------


@pytest.mark.parametrize(
    ("reason", "code"),
    [
        ("", "required"),
        ("   ", "required"),
        ("\n\t 　", "required"),
        (None, "required"),
        ("x" * 1001, "too_long"),
        ("\U0001f600" * 1001, "too_long"),
        (5, "invalid_format"),
        (["a"], "invalid_format"),
        ({"a": 1}, "invalid_format"),
        ("bad\x00char", "invalid_characters"),
        ("bad\ttab", "invalid_characters"),
    ],
)
def test_7_invalid_reason_rejected_and_nothing_stored(
    world: World, pending, login_as, reason, code: str
) -> None:
    before = snapshot(pending)
    response = login_as(world.jordan).reject(pending.id, reason)
    assert field_codes(response, "reason")[0] == code
    assert_untouched(pending, before)
    row = PurchaseRequest.objects.get(id=pending.id)
    assert (row.status, row.decided_by_id, row.decided_at, row.rejection_reason) == (
        "pending",
        None,
        None,
        None,
    )


def test_7_missing_reason_field(world: World, pending, login_as) -> None:
    api = login_as(world.jordan)
    for body in ({}, {"other": "x"}):
        assert field_codes(api.post(reject_url(pending.id), body), "reason") == ["required"]
    assert PurchaseRequest.objects.get(id=pending.id).status == "pending"


def test_7_malformed_or_wrong_content_type_body(world: World, pending, login_as) -> None:
    api = login_as(world.jordan)
    for kwargs in (
        {"raw": "{not json"},
        {"raw": "[]"},
        {"raw": '{"reason": "x"}', "content_type": "text/plain"},
    ):
        response = api.post(reject_url(pending.id), **kwargs)
        assert field_codes(response, "_body") == ["invalid_format"]
    assert PurchaseRequest.objects.get(id=pending.id).status == "pending"


def test_7_reason_boundary_1000_accepted(world: World, pending, login_as) -> None:
    reason = "x" * 1000
    response = login_as(world.jordan).reject(pending.id, reason)
    assert response.status_code == 200
    assert response.json()["rejection_reason"] == reason
    assert PurchaseRequest.objects.get(id=pending.id).rejection_reason == reason


def test_7_reason_length_counted_after_trim(world: World, pending, login_as) -> None:
    response = login_as(world.jordan).reject(pending.id, "  " + "y" * 1000 + "\n ")
    assert response.status_code == 200
    assert response.json()["rejection_reason"] == "y" * 1000


def test_7_reason_may_be_multiline(world: World, pending, login_as) -> None:
    response = login_as(world.jordan).reject(pending.id, "a\r\nb\rc\n\nd")
    assert response.json()["rejection_reason"] == "a\nb\nc\n\nd"


def test_7_reason_is_text_not_markup(world: World, pending, login_as) -> None:
    reason = "<script>alert(1)</script> & <b>"
    assert login_as(world.jordan).reject(pending.id, reason).json()["rejection_reason"] == reason


def test_failed_validation_then_valid_retry_succeeds(world: World, pending, login_as) -> None:
    api = login_as(world.jordan)
    assert api.reject(pending.id, "   ").status_code == 400
    assert api.reject(pending.id, "Valid now.").status_code == 200
    assert len(api.get(detail_url(pending.id)).json()["events"]) == 2


# ---- competing decisions (AC-26) -------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("pair", ["approve_reject", "approve_approve", "reject_reject"])
def test_two_managers_deciding_concurrently(world: World, pair: str) -> None:
    row = make_request(world.alex)
    clients = []
    for manager in (world.jordan, world.taylor):
        api = Api()
        assert api.login(manager.email, PASSWORD).status_code == 200
        clients.append(api)
    first, second = pair.split("_")

    def act(api: Api, kind: str):
        if kind == "approve":
            return api.approve(row.id)
        return api.reject(row.id, f"reason from {kind}")

    results = run_parallel([lambda: act(clients[0], first), lambda: act(clients[1], second)])
    statuses = sorted(r.status_code for r in results)
    assert statuses == [200, 409], [r.content for r in results]
    winner_index = 0 if results[0].status_code == 200 else 1
    loser = results[1 - winner_index]
    winner = results[winner_index]
    winner_user = (world.jordan, world.taylor)[winner_index]
    winner_kind = (first, second)[winner_index]
    assert loser.json()["error"]["code"] == "already_decided"
    assert loser.json()["error"]["request"]["decided_by"] == ref(winner_user)
    assert loser.json()["error"]["request"]["status"] == winner.json()["status"]
    stored = PurchaseRequest.objects.get(id=row.id)
    assert stored.decided_by_id == winner_user.id
    assert stored.status == ("approved" if winner_kind == "approve" else "rejected")
    if winner_kind == "approve":
        assert stored.rejection_reason is None
    else:
        assert stored.rejection_reason == "reason from reject"
    final = clients[0].get(detail_url(row.id)).json()
    assert [e["type"] for e in final["events"]] == ["submitted", stored.status]
    assert final["decided_at"] == winner.json()["decided_at"]


@pytest.mark.django_db(transaction=True)
def test_many_concurrent_decisions_single_winner(world: World) -> None:
    row = make_request(world.alex)
    clients = []
    for manager in (world.jordan, world.taylor, world.jordan, world.taylor):
        api = Api()
        assert api.login(manager.email, PASSWORD).status_code == 200
        clients.append(api)
    results = run_parallel([lambda api=api: api.approve(row.id) for api in clients])
    assert sorted(r.status_code for r in results) == [200, 409, 409, 409]


# ---- AC-29: failure while saving ---------------------------------------------------------------

TRIGGER_FN = "test_block_write"


def install_failing_trigger(event: str) -> None:
    table = PurchaseRequest._meta.db_table
    with connection.cursor() as cursor:
        cursor.execute(
            f"CREATE FUNCTION {TRIGGER_FN}() RETURNS trigger AS $$ BEGIN "
            "RAISE EXCEPTION 'simulated write failure'; END; $$ LANGUAGE plpgsql"
        )
        cursor.execute(
            f'CREATE TRIGGER {TRIGGER_FN}_trg BEFORE {event} ON "{table}" '
            f"FOR EACH ROW EXECUTE FUNCTION {TRIGGER_FN}()"
        )


def remove_failing_trigger() -> None:
    table = PurchaseRequest._meta.db_table
    with connection.cursor() as cursor:
        cursor.execute(f'DROP TRIGGER IF EXISTS {TRIGGER_FN}_trg ON "{table}"')
        cursor.execute(f"DROP FUNCTION IF EXISTS {TRIGGER_FN}()")


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("action", ["approve", "reject"])
def test_failed_decision_save_leaves_request_pending(world: World, login_as, action: str) -> None:
    row = make_request(world.alex)
    api = login_as(world.jordan)
    install_failing_trigger("UPDATE")
    try:
        response = api.approve(row.id) if action == "approve" else api.reject(row.id, "Because.")
    finally:
        remove_failing_trigger()
    assert_error(response, 500, "server_error", "Something went wrong. Try again.")
    stored = PurchaseRequest.objects.get(id=row.id)
    assert (stored.status, stored.decided_by_id, stored.decided_at, stored.rejection_reason) == (
        "pending",
        None,
        None,
        None,
    )
    # After the fault is gone the same request can be decided normally.
    assert api.approve(row.id).status_code == 200


@pytest.mark.django_db(transaction=True)
def test_failed_submit_save_creates_no_request(world: World, login_as) -> None:
    api = login_as(world.alex)
    key = uuid.uuid4()
    install_failing_trigger("INSERT")
    try:
        response = api.submit(key=str(key))
    finally:
        remove_failing_trigger()
    assert_error(response, 500, "server_error", "Something went wrong. Try again.")
    assert PurchaseRequest.objects.count() == 0
    # Retrying with the same key after recovery creates exactly one request.
    retry = api.submit(key=str(key))
    assert retry.status_code == 201
    assert PurchaseRequest.objects.count() == 1
