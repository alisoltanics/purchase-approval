import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from django.db import IntegrityError, connection, transaction

from accounts.models import Company, User
from accounts.settings import Role
from approvals.models import PurchaseRequest

T0 = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)

pytestmark = pytest.mark.django_db


@pytest.fixture
def north():
    return Company.objects.create(name="North")


@pytest.fixture
def harbor():
    return Company.objects.create(name="Harbor")


def make_user(company, email, role=Role.EMPLOYEE):
    return User.objects.create_user(
        email, "pw-not-used-12", display_name="X", company=company, role=role
    )


@pytest.fixture
def employee(north):
    return make_user(north, "emp@n.example")


@pytest.fixture
def manager(north):
    return make_user(north, "mgr@n.example", Role.MANAGER)


def pending(employee, **overrides):
    values = dict(
        company=employee.company,
        requester=employee,
        title="Desk",
        vendor="Vendor",
        description="Because",
        amount=Decimal("10.00"),
        submitted_at=T0,
        idempotency_key=uuid.uuid4(),
    )
    values.update(overrides)
    return PurchaseRequest(**values)


def assert_rejected(obj, constraint):
    with pytest.raises(IntegrityError) as exc, transaction.atomic():
        obj.save() if obj.pk and not obj._state.adding else obj.save(force_insert=True)
    assert constraint in str(exc.value)


def test_valid_pending_request_is_stored_with_defaults(employee):
    request = pending(employee)
    request.save()
    request.refresh_from_db()
    assert request.status == "pending"
    assert request.currency == "USD"
    assert request.amount == Decimal("10.00")
    assert isinstance(request.id, uuid.UUID) and request.id.version == 4


@pytest.mark.parametrize("amount", ["0.00", "0.001", "1000000.00", "-1.00"])
def test_amount_outside_range_is_rejected(employee, amount):
    with pytest.raises((IntegrityError, Exception)):
        with transaction.atomic():
            pending(employee, amount=Decimal(amount)).save()


@pytest.mark.parametrize("amount", ["0.01", "999999.99"])
def test_amount_bounds_are_accepted(employee, amount):
    pending(employee, amount=Decimal(amount)).save()


def test_amount_keeps_exactly_two_decimals(employee):
    request = pending(employee, amount=Decimal("1250.50"))
    request.save()
    with connection.cursor() as cursor:
        cursor.execute("SELECT amount::text FROM approvals_purchaserequest")
        assert cursor.fetchone()[0] == "1250.50"


def test_currency_must_be_usd(employee):
    assert_rejected(pending(employee, currency="EUR"), "pr_currency_usd")


@pytest.mark.parametrize(
    ("field", "value", "constraint"),
    [
        ("title", "", "pr_title_length"),
        ("vendor", "", "pr_vendor_length"),
        ("description", "", "pr_description_length"),
        ("description", "d" * 2001, "pr_description_length"),
    ],
)
def test_text_lengths_are_enforced(employee, field, value, constraint):
    assert_rejected(pending(employee, **{field: value}), constraint)


def test_title_length_counts_code_points_not_bytes(employee):
    pending(employee, title="\U0001f600" * 120).save()


def test_status_must_be_known(employee):
    # An unknown status also breaks the decision-fields check, and Postgres reports only one
    # violation, so assert the rejection and that the status constraint exists.
    with pytest.raises(IntegrityError), transaction.atomic():
        pending(employee, status="done").save(force_insert=True)
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_constraint WHERE conname = 'pr_status_valid'")
        assert cursor.fetchone() is not None


def decide(request, manager, status, reason=None):
    request.status = status
    request.decided_by = manager
    request.decided_at = T0 + timedelta(hours=1)
    request.rejection_reason = reason


def test_approved_requires_decider_and_time_and_no_reason(employee, manager):
    request = pending(employee)
    decide(request, manager, "approved")
    request.save()

    bad = pending(employee, status="approved")
    assert_rejected(bad, "pr_decision_fields_match_status")

    with_reason = pending(employee)
    decide(with_reason, manager, "approved", reason="no")
    assert_rejected(with_reason, "pr_decision_fields_match_status")


def test_rejected_requires_reason(employee, manager):
    ok = pending(employee)
    decide(ok, manager, "rejected", reason="Too expensive")
    ok.save()

    missing = pending(employee)
    decide(missing, manager, "rejected")
    assert_rejected(missing, "pr_decision_fields_match_status")

    blank = pending(employee)
    decide(blank, manager, "rejected", reason="")
    assert_rejected(blank, "pr_reason_length")


def test_pending_must_not_carry_decision_fields(employee, manager):
    request = pending(employee, decided_by=manager)
    assert_rejected(request, "pr_decision_fields_match_status")
    assert_rejected(pending(employee, decided_at=T0), "pr_decision_fields_match_status")
    assert_rejected(pending(employee, rejection_reason="x"), "pr_decision_fields_match_status")


def test_decider_cannot_be_requester(north):
    manager = make_user(north, "self@n.example", Role.MANAGER)
    request = pending(manager)
    decide(request, manager, "approved")
    assert_rejected(request, "pr_decider_not_requester")


def test_requester_must_belong_to_request_company(employee, harbor):
    assert_rejected(pending(employee, company=harbor), "pr_requester_same_company_fk")


def test_decider_must_belong_to_request_company(employee, harbor):
    outsider = make_user(harbor, "mgr@h.example", Role.MANAGER)
    request = pending(employee)
    decide(request, outsider, "approved")
    assert_rejected(request, "pr_decider_same_company_fk")


def test_same_requester_and_key_is_rejected_but_other_requester_may_reuse_it(north, employee):
    key = uuid.uuid4()
    pending(employee, idempotency_key=key).save()
    assert_rejected(pending(employee, idempotency_key=key), "pr_requester_idempotency_unique")
    other = make_user(north, "other@n.example")
    pending(other, idempotency_key=key).save()


def test_email_is_unique_and_lowercase(north):
    make_user(north, "dup@n.example")
    with pytest.raises(IntegrityError), transaction.atomic():
        make_user(north, "dup@n.example")
    with pytest.raises(IntegrityError) as exc, transaction.atomic():
        User(email="Mixed@N.example", display_name="X", company=north, role="employee").save(
            force_insert=True
        )
    assert "user_email_is_lowercase" in str(exc.value)


def test_user_role_and_display_name_are_checked(north):
    for kwargs, name in [
        ({"role": "admin", "display_name": "X"}, "user_role_valid"),
        ({"role": "employee", "display_name": ""}, "user_display_name_length"),
    ]:
        with pytest.raises(IntegrityError) as exc, transaction.atomic():
            User(email="z@n.example", company=north, **kwargs).save(force_insert=True)
        assert name in str(exc.value)


def test_company_name_is_unique(north):
    with pytest.raises(IntegrityError), transaction.atomic():
        Company.objects.create(name="North")


def test_list_indexes_exist():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT indexname, indexdef FROM pg_indexes "
            "WHERE tablename = 'approvals_purchaserequest'"
        )
        indexes = dict(cursor.fetchall())
    assert "DESC" in indexes["pr_company_status_list_idx"]
    assert "DESC" in indexes["pr_requester_list_idx"]
