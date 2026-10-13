"""POST /api/requests/ (AC-09, AC-10, AC-11, AC-12, AC-24, AC-29)."""

import json
import re
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from approvals.models import PurchaseRequest

from .conftest import PASSWORD, World, make_request
from .helpers import (
    DETAIL_KEYS,
    LIST_URL,
    MSG_CSRF,
    MSG_IDEMPOTENCY,
    MSG_NOT_AUTHENTICATED,
    TS_RE,
    Api,
    assert_detail_shape,
    assert_error,
    detail_url,
    field_codes,
    new_key,
    run_parallel,
    valid_payload,
)

pytestmark = pytest.mark.django_db

_CANDIDATES = [Path("/testdata/validation-cases.json")] + [
    parent / "testdata" / "validation-cases.json" for parent in Path(__file__).resolve().parents
]
CASES_FILE = next(path for path in _CANDIDATES if path.exists())
GROUPS = json.loads(CASES_FILE.read_text(encoding="utf-8"))["groups"]


def case_params(group: str, valid: bool) -> list[Any]:
    cases = [c for c in GROUPS[group]["cases"] if c["valid"] is valid]
    return [pytest.param(c, id=c["id"]) for c in cases]


def body_for(field: str, case: dict[str, Any]) -> dict[str, Any]:
    body = valid_payload()
    if case.get("missing"):
        del body[field]
    else:
        body[field] = case["input"]
    return body


def test_submit_creates_pending_request(world: World, login_as) -> None:
    api = login_as(world.alex)
    key = new_key()
    response = api.submit(valid_payload(amount="25.5"), key=key)
    assert response.status_code == 201
    data = response.json()
    assert_detail_shape(data)
    assert set(data) == DETAIL_KEYS
    assert uuid.UUID(data["id"]).version == 4
    assert data["id"] == data["id"].lower()
    assert data["title"] == "Standing desk"
    assert data["vendor"] == "Ergo Supply"
    assert data["description"] == "Needed for the new hire."
    assert data["amount"] == "25.50"
    assert data["currency"] == "USD"
    assert data["status"] == "pending"
    assert TS_RE.match(data["submitted_at"])
    assert data["requester"] == {"id": str(world.alex.id), "display_name": "Alex Morgan"}
    assert data["decided_by"] is None
    assert data["decided_at"] is None
    assert data["rejection_reason"] is None
    assert data["can_decide"] is False
    assert data["events"] == [
        {
            "type": "submitted",
            "actor": {"id": str(world.alex.id), "display_name": "Alex Morgan"},
            "created_at": data["submitted_at"],
            "reason": None,
        }
    ]
    row = PurchaseRequest.objects.get()
    assert str(row.id) == data["id"]
    assert row.company_id == world.north.id
    assert row.requester_id == world.alex.id
    assert row.status == "pending"
    assert row.amount == Decimal("25.50")
    assert row.currency == "USD"
    assert row.decided_by_id is None
    assert row.decided_at is None
    assert row.rejection_reason is None
    assert str(row.idempotency_key) == key


def test_submit_is_readable_afterwards(world: World, login_as) -> None:
    api = login_as(world.alex)
    created = api.submit().json()
    assert api.get(detail_url(created["id"])).json() == created
    listed = api.get(LIST_URL).json()
    assert [item["id"] for item in listed["results"]] == [created["id"]]


def test_manager_can_submit_and_cannot_decide_own(world: World, login_as) -> None:
    api = login_as(world.jordan)
    data = api.submit().json()
    assert data["status"] == "pending"
    assert data["requester"]["id"] == str(world.jordan.id)
    assert data["can_decide"] is False
    assert PurchaseRequest.objects.get().company_id == world.north.id


def test_submit_company_comes_from_session(world: World, login_as) -> None:
    api = login_as(world.casey)
    data = api.submit().json()
    row = PurchaseRequest.objects.get(id=data["id"])
    assert row.company_id == world.harbor.id
    # A Northstar manager must not see it.
    assert login_as(world.jordan).get(detail_url(data["id"])).status_code == 404


def test_submit_ignores_forged_fields(world: World, login_as) -> None:
    api = login_as(world.alex)
    forged_id = str(uuid.uuid4())
    body = valid_payload(
        company=str(world.harbor.id),
        company_id=str(world.harbor.id),
        requester=str(world.jordan.id),
        requester_id=str(world.jordan.id),
        role="manager",
        status="approved",
        decided_by=str(world.jordan.id),
        decided_at="2020-01-01T00:00:00Z",
        submitted_at="2020-01-01T00:00:00Z",
        rejection_reason="forged",
        currency="EUR",
        id=forged_id,
        can_decide=True,
        unknown_field=[1, 2],
    )
    response = api.submit(body)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] != forged_id
    assert data["status"] == "pending"
    assert data["currency"] == "USD"
    assert data["requester"]["id"] == str(world.alex.id)
    assert data["decided_by"] is None
    assert data["decided_at"] is None
    assert data["rejection_reason"] is None
    assert data["submitted_at"].startswith("20") and not data["submitted_at"].startswith("2020")
    row = PurchaseRequest.objects.get()
    assert row.company_id == world.north.id
    assert row.requester_id == world.alex.id
    assert row.status == "pending"
    assert row.decided_by_id is None
    assert row.rejection_reason is None
    assert row.submitted_at.year != 2020
    # The user's own role is unchanged.
    assert api.get("/api/auth/me/").json()["role"] == "employee"


def test_submit_requires_idempotency_key(world: World, login_as) -> None:
    api = login_as(world.alex)
    response = api.post(LIST_URL, valid_payload())
    assert field_codes(response, "idempotency_key") == ["required"]
    assert PurchaseRequest.objects.count() == 0


@pytest.mark.parametrize(
    "key", ["not-a-uuid", "123", "", " ", "0000", str(uuid.uuid4()) + "x", "g" * 36]
)
def test_submit_rejects_bad_idempotency_key(world: World, login_as, key: str) -> None:
    api = login_as(world.alex)
    response = api.submit(key=key)
    codes = field_codes(response, "idempotency_key")
    assert codes[0] in {"required", "invalid_format"}
    if key.strip():
        assert codes == ["invalid_format"]
    assert PurchaseRequest.objects.count() == 0


def test_submit_accepts_uppercase_key_and_stores_lowercase(world: World, login_as) -> None:
    api = login_as(world.alex)
    key = str(uuid.uuid4()).upper()
    assert api.submit(key=key).status_code == 201
    assert str(PurchaseRequest.objects.get().idempotency_key) == key.lower()
    replay = api.submit(key=key.lower())
    assert replay.status_code == 200
    assert PurchaseRequest.objects.count() == 1


def test_submit_accepts_any_uuid_version(world: World, login_as) -> None:
    api = login_as(world.alex)
    assert api.submit(key=str(uuid.uuid1())).status_code == 201


def test_idempotency_key_checked_before_fields(world: World, login_as) -> None:
    api = login_as(world.alex)
    response = api.post(LIST_URL, {"title": ""})
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert "idempotency_key" in error["fields"]


def test_replay_same_key_same_payload_returns_existing(world: World, login_as) -> None:
    api = login_as(world.alex)
    key = new_key()
    first = api.submit(key=key)
    second = api.submit(key=key)
    third = api.submit(key=key)
    assert first.status_code == 201
    assert second.status_code == 200
    assert third.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert second.json() == first.json()
    assert PurchaseRequest.objects.count() == 1


def test_replay_matches_on_normalized_payload(world: World, login_as) -> None:
    api = login_as(world.alex)
    key = new_key()
    first = api.submit(valid_payload(title="Desk", description="a\nb", amount="25"), key=key)
    second = api.submit(
        valid_payload(title="  Desk\t", description="  a\r\nb  ", amount=" 25.00 "), key=key
    )
    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert PurchaseRequest.objects.count() == 1


@pytest.mark.parametrize(
    "change",
    [
        {"title": "Other title"},
        {"vendor": "Other vendor"},
        {"description": "Other description."},
        {"amount": "649.01"},
    ],
)
def test_same_key_different_payload_is_conflict(world: World, login_as, change) -> None:
    api = login_as(world.alex)
    key = new_key()
    first = api.submit(key=key)
    conflict = api.submit(valid_payload(**change), key=key)
    assert_error(conflict, 409, "idempotency_conflict", MSG_IDEMPOTENCY)
    assert PurchaseRequest.objects.count() == 1
    row = PurchaseRequest.objects.get()
    assert str(row.id) == first.json()["id"]
    assert row.title == "Standing desk"
    assert row.amount == Decimal("649.00")


def test_replay_of_decided_request_returns_current_state(world: World, login_as) -> None:
    api = login_as(world.alex)
    key = new_key()
    created = api.submit(key=key).json()
    assert login_as(world.jordan).approve(created["id"]).status_code == 200
    replay = api.submit(key=key)
    assert replay.status_code == 200
    assert replay.json()["id"] == created["id"]
    assert replay.json()["status"] == "approved"
    assert len(replay.json()["events"]) == 2


def test_invalid_payload_with_used_key_is_validation_error(world: World, login_as) -> None:
    api = login_as(world.alex)
    key = new_key()
    api.submit(key=key)
    response = api.submit(valid_payload(title=""), key=key)
    assert field_codes(response, "title") == ["required"]
    assert PurchaseRequest.objects.count() == 1


def test_same_key_from_another_user_is_independent(world: World, login_as) -> None:
    key = new_key()
    first = login_as(world.alex).submit(key=key)
    second = login_as(world.sam).submit(key=key)
    third = login_as(world.casey).submit(valid_payload(title="Different"), key=key)
    assert (first.status_code, second.status_code, third.status_code) == (201, 201, 201)
    ids = {first.json()["id"], second.json()["id"], third.json()["id"]}
    assert len(ids) == 3
    assert PurchaseRequest.objects.count() == 3


def test_key_used_by_other_user_does_not_conflict_on_payload(world: World, login_as) -> None:
    key = new_key()
    login_as(world.alex).submit(valid_payload(title="One"), key=key)
    response = login_as(world.sam).submit(valid_payload(title="Two"), key=key)
    assert response.status_code == 201


@pytest.mark.django_db(transaction=True)
def test_concurrent_same_key_creates_exactly_one_row(world: World) -> None:
    key = new_key()
    clients = []
    for _ in range(6):
        api = Api()
        assert api.login(world.alex.email, PASSWORD).status_code == 200
        clients.append(api)
    results = run_parallel([lambda api=api: api.submit(key=key) for api in clients])
    statuses = sorted(r.status_code for r in results)
    assert statuses == [200] * 5 + [201], [r.content for r in results]
    assert len({r.json()["id"] for r in results}) == 1
    assert PurchaseRequest.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_same_key_different_payload_one_row(world: World) -> None:
    key = new_key()
    clients = []
    for _ in range(2):
        api = Api()
        assert api.login(world.alex.email, PASSWORD).status_code == 200
        clients.append(api)
    payloads = [valid_payload(title="First"), valid_payload(title="Second")]
    results = run_parallel(
        [
            lambda api=api, p=p: api.submit(p, key=key)
            for api, p in zip(clients, payloads, strict=True)
        ]
    )
    assert sorted(r.status_code for r in results) == [201, 409]
    assert PurchaseRequest.objects.count() == 1


# ---- boundaries (AC-10, AC-11) -------------------------------------------------------------


@pytest.mark.parametrize(
    ("field", "length"),
    [("title", 120), ("vendor", 120), ("description", 2000)],
)
def test_text_at_maximum_length_is_accepted(world: World, login_as, field, length) -> None:
    text = "x" * length
    response = login_as(world.alex).submit(valid_payload(**{field: text}))
    assert response.status_code == 201
    assert response.json()[field] == text
    assert getattr(PurchaseRequest.objects.get(), field) == text


@pytest.mark.parametrize(
    ("field", "length"),
    [("title", 121), ("vendor", 121), ("description", 2001)],
)
def test_text_over_maximum_length_is_too_long(world: World, login_as, field, length) -> None:
    response = login_as(world.alex).submit(valid_payload(**{field: "x" * length}))
    assert field_codes(response, field) == ["too_long"]
    assert PurchaseRequest.objects.count() == 0


def test_length_counts_code_points_not_utf16(world: World, login_as) -> None:
    api = login_as(world.alex)
    assert api.submit(valid_payload(title="\U0001f600" * 120)).status_code == 201
    response = api.submit(valid_payload(title="\U0001f600" * 121))
    assert field_codes(response, "title") == ["too_long"]


def test_length_is_measured_after_trimming(world: World, login_as) -> None:
    api = login_as(world.alex)
    assert api.submit(valid_payload(title="  " + "x" * 120 + " \t")).status_code == 201
    assert PurchaseRequest.objects.get().title == "x" * 120


def test_stored_values_are_trimmed_and_normalized(world: World, login_as) -> None:
    body = valid_payload(
        title="  　Desk  ",
        vendor="\tAcme Corp \n",
        description="\n  line one\r\nline two\rline three   ",
        amount=" 12.5\t",
    )
    response = login_as(world.alex).submit(body)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Desk"
    assert data["vendor"] == "Acme Corp"
    assert data["description"] == "line one\nline two\nline three"
    assert data["amount"] == "12.50"
    row = PurchaseRequest.objects.get()
    assert (row.title, row.vendor) == ("Desk", "Acme Corp")
    assert row.description == "line one\nline two\nline three"
    assert row.amount == Decimal("12.50")


def test_text_is_stored_as_text_not_interpreted(world: World, login_as) -> None:
    payload = valid_payload(title="<script>alert(1)</script>", description="<b>x</b> & 'q' \"d\"")
    data = login_as(world.alex).submit(payload).json()
    assert data["title"] == "<script>alert(1)</script>"
    assert data["description"] == "<b>x</b> & 'q' \"d\""


@pytest.mark.parametrize(
    ("raw", "stored"),
    [
        ("0.01", "0.01"),
        ("999999.99", "999999.99"),
        ("1", "1.00"),
        ("25.5", "25.50"),
        ("025", "25.00"),
        ("000001", "1.00"),
        ("0.1", "0.10"),
        ("100000", "100000.00"),
    ],
)
def test_amount_accepted_and_normalized(world: World, login_as, raw: str, stored: str) -> None:
    response = login_as(world.alex).submit(valid_payload(amount=raw))
    assert response.status_code == 201
    assert response.json()["amount"] == stored
    assert re.search(rf'"amount":\s*"{re.escape(stored)}"', response.content.decode())
    assert PurchaseRequest.objects.get().amount == Decimal(stored)


@pytest.mark.parametrize(
    ("raw", "code"),
    [
        ("0", "out_of_range"),
        ("0.00", "out_of_range"),
        ("1000000", "out_of_range"),
        ("1000000.00", "out_of_range"),
        ("999999.995", "too_many_decimals"),
        ("25.999", "too_many_decimals"),
        ("0.001", "too_many_decimals"),
        ("1000000.001", "too_many_decimals"),
        ("-5", "invalid_format"),
        ("+5", "invalid_format"),
        (".5", "invalid_format"),
        ("25.", "invalid_format"),
        ("1e3", "invalid_format"),
        ("1,000", "invalid_format"),
        ("$5", "invalid_format"),
        ("USD 5", "invalid_format"),
        ("25,50", "invalid_format"),
        ("abc", "invalid_format"),
        ("５", "invalid_format"),
        ("", "required"),
        ("   ", "required"),
        (5, "invalid_format"),
        (5.5, "invalid_format"),
        (True, "invalid_format"),
        ([], "invalid_format"),
        ({}, "invalid_format"),
        (None, "required"),
    ],
)
def test_amount_rejected(world: World, login_as, raw, code: str) -> None:
    response = login_as(world.alex).submit(valid_payload(amount=raw))
    assert field_codes(response, "amount")[0] == code
    assert PurchaseRequest.objects.count() == 0


def test_amount_missing(world: World, login_as) -> None:
    body = valid_payload()
    del body["amount"]
    response = login_as(world.alex).submit(body)
    assert field_codes(response, "amount") == ["required"]


def test_amount_is_never_a_json_number(world: World, login_as) -> None:
    api = login_as(world.alex)
    created = api.submit(valid_payload(amount="25")).json()
    assert created["amount"] == "25.00" and isinstance(created["amount"], str)
    assert isinstance(api.get(detail_url(created["id"])).json()["amount"], str)
    listed = api.get(LIST_URL).json()["results"][0]
    assert listed["amount"] == "25.00" and isinstance(listed["amount"], str)


@pytest.mark.parametrize("field", ["title", "vendor", "description", "amount"])
def test_each_field_is_required(world: World, login_as, field: str) -> None:
    body = valid_payload()
    del body[field]
    assert field_codes(login_as(world.alex).submit(body), field) == ["required"]


def test_all_invalid_fields_reported_together(world: World, login_as) -> None:
    response = login_as(world.alex).submit(
        {"title": "", "vendor": "", "description": "", "amount": "0"}
    )
    assert response.status_code == 400
    assert set(response.json()["error"]["fields"]) == {"title", "vendor", "description", "amount"}
    assert PurchaseRequest.objects.count() == 0


@pytest.mark.parametrize("value", ["a\nb", "a\rb", "a\tb", "a\x00b", "a\x7fb", "a b"])
def test_single_line_fields_reject_line_breaks_and_controls(world: World, login_as, value) -> None:
    for field in ("title", "vendor"):
        response = login_as(world.alex).submit(valid_payload(**{field: value}))
        assert field_codes(response, field) == ["invalid_characters"]
    assert PurchaseRequest.objects.count() == 0


def test_description_keeps_inner_newlines(world: World, login_as) -> None:
    data = login_as(world.alex).submit(valid_payload(description="a\n\nb\nc")).json()
    assert data["description"] == "a\n\nb\nc"


@pytest.mark.parametrize("value", ["a\tb", "a\x00b", "a\x7fb"])
def test_description_rejects_other_controls(world: World, login_as, value: str) -> None:
    response = login_as(world.alex).submit(valid_payload(description=value))
    assert field_codes(response, "description") == ["invalid_characters"]


@pytest.mark.parametrize("field", ["title", "vendor", "description", "amount"])
@pytest.mark.parametrize("value", [5, True, [], {}, 1.5])
def test_non_string_values_are_invalid_format(world: World, login_as, field, value) -> None:
    response = login_as(world.alex).submit(valid_payload(**{field: value}))
    assert field_codes(response, field) == ["invalid_format"]


# ---- shared fixture, through the real endpoint ---------------------------------------------


@pytest.fixture
def fixture_client(world: World, force_as) -> Api:
    return force_as(world.alex)


@pytest.mark.parametrize("field", ["title", "vendor", "description"])
def test_shared_cases_valid_text(world: World, fixture_client: Api, field: str) -> None:
    for param in case_params(field, True):
        case = param.values[0]
        response = fixture_client.submit(body_for(field, case))
        assert response.status_code == 201, (case["id"], response.content)
        assert response.json()[field] == case["normalized"], case["id"]
        assert (
            getattr(PurchaseRequest.objects.get(id=response.json()["id"]), field)
            == (case["normalized"])
        ), case["id"]


@pytest.mark.parametrize("field", ["title", "vendor", "description"])
def test_shared_cases_invalid_text(world: World, fixture_client: Api, field: str) -> None:
    for param in case_params(field, False):
        case = param.values[0]
        response = fixture_client.submit(body_for(field, case))
        assert response.status_code == 400, (case["id"], response.content)
        assert field_codes(response, field)[0] == case["code"], case["id"]
    assert PurchaseRequest.objects.count() == 0


def test_shared_cases_valid_amount(world: World, fixture_client: Api) -> None:
    for param in case_params("amount", True):
        case = param.values[0]
        response = fixture_client.submit(body_for("amount", case))
        assert response.status_code == 201, (case["id"], response.content)
        assert response.json()["amount"] == case["normalized"], case["id"]


def test_shared_cases_invalid_amount(world: World, fixture_client: Api) -> None:
    for param in case_params("amount", False):
        case = param.values[0]
        response = fixture_client.submit(body_for("amount", case))
        assert response.status_code == 400, (case["id"], response.content)
        assert field_codes(response, "amount")[0] == case["code"], case["id"]
    assert PurchaseRequest.objects.count() == 0


# ---- body / protocol problems --------------------------------------------------------------


def test_malformed_json_is_body_error(world: World, login_as) -> None:
    api = login_as(world.alex)
    for raw in ("{not json", "{", '{"title": '):
        response = api.post(LIST_URL, raw=raw, idem=new_key())
        assert field_codes(response, "_body") == ["invalid_format"], raw
    assert PurchaseRequest.objects.count() == 0


@pytest.mark.parametrize("raw", ["[]", '"text"', "5", "null", "true"])
def test_non_object_json_is_body_error(world: World, login_as, raw: str) -> None:
    response = login_as(world.alex).post(LIST_URL, raw=raw, idem=new_key())
    assert field_codes(response, "_body") == ["invalid_format"]


@pytest.mark.parametrize("content_type", ["text/plain", "application/x-www-form-urlencoded"])
def test_wrong_content_type_is_body_error(world: World, login_as, content_type: str) -> None:
    api = login_as(world.alex)
    raw = "title=a&vendor=b&description=c&amount=1"
    if content_type == "text/plain":
        raw = json.dumps(valid_payload())
    response = api.post(LIST_URL, raw=raw, content_type=content_type, idem=new_key())
    assert field_codes(response, "_body") == ["invalid_format"]
    assert PurchaseRequest.objects.count() == 0


def test_submit_without_csrf_is_403(world: World, login_as) -> None:
    api = login_as(world.alex)
    response = api.submit(csrf=False)
    assert_error(response, 403, "csrf_failed", MSG_CSRF)
    assert PurchaseRequest.objects.count() == 0


def test_csrf_checked_before_idempotency_key(world: World, login_as) -> None:
    api = login_as(world.alex)
    response = api.post(LIST_URL, valid_payload(), csrf=False)
    assert_error(response, 403, "csrf_failed", MSG_CSRF)


def test_anonymous_submit_is_401_before_csrf(world: World, anon: Api) -> None:
    response = anon.submit(csrf=False)
    assert_error(response, 401, "not_authenticated", MSG_NOT_AUTHENTICATED)
    assert_error(anon.submit(), 401, "not_authenticated", MSG_NOT_AUTHENTICATED)
    assert PurchaseRequest.objects.count() == 0


def test_submit_does_not_touch_other_requests(world: World, login_as) -> None:
    existing = make_request(world.alex, title="Existing")
    login_as(world.alex).submit()
    existing.refresh_from_db()
    assert existing.title == "Existing"
    assert PurchaseRequest.objects.count() == 2
