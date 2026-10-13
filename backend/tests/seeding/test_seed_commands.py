"""seed_demo and seed_test_fixtures against docs/seed-spec.md."""

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from io import StringIO

import pytest
from django.contrib.auth import authenticate
from django.core.management import call_command
from django.core.management.base import CommandError

from accounts.models import Company, User
from approvals import selectors
from approvals.models import PurchaseRequest
from approvals.settings import Status
from seeding import data

pytestmark = pytest.mark.django_db

PASSWORD = "demo-password-123"


@pytest.fixture(autouse=True)
def seed_settings(settings) -> None:
    settings.SEED_DEMO_PASSWORD = PASSWORD
    settings.ALLOW_SEED_RESET = False
    settings.DJANGO_ENV = "test"
    # Hashing six to ten accounts with the real hasher is needlessly slow here.
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


def run(command: str, *args: str) -> str:
    out = StringIO()
    call_command(
        command,
        *args,
        stdout=out,
    )
    return out.getvalue()


def counts() -> tuple[int, int, int]:
    return (
        Company.objects.count(),
        User.objects.count(),
        PurchaseRequest.objects.count(),
    )


def table(model) -> list[dict]:
    return list(model.objects.order_by("pk").values())


def test_seed_demo_creates_the_prd_data() -> None:
    output = run("seed_demo")
    assert counts() == (2, 6, 8)
    assert "Created 2 companies, 6 users and 8 requests." in output
    assert PASSWORD not in output


def test_seed_demo_accounts_match_the_spec() -> None:
    run("seed_demo")
    jordan = User.objects.get(email="jordan@northstar.example")
    assert jordan.id == uuid.UUID("3f78235c-d9b2-4dac-8767-79f4bbe833c2")
    assert (jordan.display_name, jordan.role) == ("Jordan Lee", "manager")
    assert jordan.company.name == "Northstar Labs"
    assert jordan.company_id == uuid.UUID("587682aa-b865-4a50-9035-4b5551defd6b")
    roles = dict(User.objects.values_list("email", "role"))
    assert roles == {
        "alex@northstar.example": "employee",
        "sam@northstar.example": "employee",
        "jordan@northstar.example": "manager",
        "taylor@northstar.example": "manager",
        "casey@harbor.example": "employee",
        "riley@harbor.example": "manager",
    }


def test_every_account_signs_in_with_the_seed_password() -> None:
    run("seed_demo")
    for spec in data.DEMO_USERS:
        assert authenticate(username=spec.email, password=PASSWORD) is not None
        assert authenticate(username=spec.email, password="wrong-password-123") is None


def test_seed_demo_requests_match_the_spec() -> None:
    run("seed_demo")
    n1 = PurchaseRequest.objects.get(id="86935e09-143b-482a-bf3c-f7400bc4b6de")
    assert n1.description == (
        "Two sit-stand desks, 160 cm wide.\n"
        "Needed for the new design hires starting next week.\n"
        "Delivery to the 3rd floor."
    )
    assert n1.amount == Decimal("649.00")
    assert n1.submitted_at == datetime(2026, 10, 1, 9, 15, tzinfo=UTC)
    assert (n1.status, n1.decided_by_id, n1.decided_at) == ("pending", None, None)

    n2 = PurchaseRequest.objects.get(id="c24bfa1c-bfe6-4a3e-aa16-94a938408533")
    assert n2.amount == Decimal("4200.00")

    n6 = PurchaseRequest.objects.get(id="35aba7f5-7773-4599-a72d-5403282a3f07")
    assert n6.status == "rejected"
    assert n6.rejection_reason == "Budget for office equipment is exhausted this quarter."
    assert n6.decided_by.email == "jordan@northstar.example"
    assert n6.decided_at == datetime(2026, 9, 27, 9, 45, tzinfo=UTC)

    h2 = PurchaseRequest.objects.get(id="58cbac00-1ad9-4906-9d31-ce978c20a514")
    assert (h2.status, h2.decided_by.email) == ("approved", "riley@harbor.example")
    assert h2.company.name == "Harbor Works"


def test_seed_demo_status_mix_per_company() -> None:
    run("seed_demo")
    northstar = PurchaseRequest.objects.filter(company__name="Northstar Labs")
    assert sorted(northstar.values_list("status", flat=True)) == [
        "approved",
        "pending",
        "pending",
        "pending",
        "pending",
        "rejected",
    ]
    harbor = PurchaseRequest.objects.filter(company__name="Harbor Works")
    assert sorted(harbor.values_list("status", flat=True)) == ["approved", "pending"]


def test_decided_rows_follow_the_decision_rules() -> None:
    run("seed_demo")
    for row in PurchaseRequest.objects.exclude(status=Status.PENDING):
        assert row.decided_at > row.submitted_at
        assert row.decided_by.role == "manager"
        assert row.decided_by.company_id == row.company_id
        assert row.decided_by_id != row.requester_id


def test_seed_demo_twice_is_idempotent() -> None:
    run("seed_demo")
    before = (
        table(Company),
        table(User),
        table(PurchaseRequest),
    )
    output = run("seed_demo")
    assert "Created 0 companies, 0 users and 0 requests." in output
    assert counts() == (2, 6, 8)
    assert (
        table(Company),
        table(User),
        table(PurchaseRequest),
    ) == before


def test_seed_demo_never_changes_existing_rows() -> None:
    run("seed_demo")
    PurchaseRequest.objects.filter(id=data.DEMO_REQUESTS[0].id).update(title="Edited by hand")
    user = User.objects.get(id=data.ALEX.id)
    user.set_password("another-password-1")
    user.save()
    run("seed_demo")
    assert PurchaseRequest.objects.get(id=data.DEMO_REQUESTS[0].id).title == "Edited by hand"
    assert authenticate(username=data.ALEX.email, password="another-password-1") is not None


def test_seed_demo_creates_only_missing_rows() -> None:
    run("seed_demo")
    PurchaseRequest.objects.filter(id=data.DEMO_REQUESTS[2].id).delete()
    output = run("seed_demo")
    assert "Created 0 companies, 0 users and 1 requests." in output
    assert counts() == (2, 6, 8)


def test_seed_demo_refuses_an_email_with_a_different_id() -> None:
    company = Company.objects.create(
        id=data.NORTHSTAR.id,
        name=data.NORTHSTAR.name,
    )
    User.objects.create_user(
        data.ALEX.email,
        PASSWORD,
        display_name="Someone Else",
        company=company,
        role="employee",
    )
    with pytest.raises(CommandError, match="different id"):
        run("seed_demo")
    assert counts() == (1, 1, 0)


@pytest.mark.parametrize("password", ["", "short-pass", "x" * 11])
def test_password_must_be_set_and_long_enough(settings, password: str) -> None:
    settings.SEED_DEMO_PASSWORD = password
    with pytest.raises(CommandError) as error:
        run("seed_demo")
    assert "at least 12" in str(error.value)
    if password:
        assert password not in str(error.value)
    assert counts() == (0, 0, 0)


def test_password_of_exactly_twelve_characters_is_accepted(settings) -> None:
    settings.SEED_DEMO_PASSWORD = "x" * 12
    run("seed_demo")
    assert counts() == (2, 6, 8)


@pytest.mark.parametrize(
    ("args", "allowed"),
    [
        (["--reset"], True),
        (["--reset"], False),
        (["--reset", "--yes-i-am-sure"], False),
    ],
)
def test_reset_needs_both_confirmation_and_the_environment_flag(
    settings,
    args: list[str],
    allowed: bool,
) -> None:
    run("seed_demo")
    PurchaseRequest.objects.filter(id=data.DEMO_REQUESTS[0].id).update(title="Edited by hand")
    settings.ALLOW_SEED_RESET = allowed
    with pytest.raises(CommandError, match="ALLOW_SEED_RESET"):
        run("seed_demo", *args)
    assert PurchaseRequest.objects.get(id=data.DEMO_REQUESTS[0].id).title == "Edited by hand"


def test_reset_removes_everything_and_reseeds(settings) -> None:
    run("seed_demo")
    run("seed_test_fixtures")
    PurchaseRequest.objects.filter(id=data.DEMO_REQUESTS[0].id).update(title="Edited by hand")
    settings.ALLOW_SEED_RESET = True
    output = run("seed_demo", "--reset", "--yes-i-am-sure")
    assert "Removed all application data." in output
    assert counts() == (2, 6, 8)
    first = data.DEMO_REQUESTS[0]
    assert PurchaseRequest.objects.get(id=first.id).title == first.title
    assert not Company.objects.filter(name="Fixture Co").exists()


def test_reset_still_needs_a_valid_password(settings) -> None:
    run("seed_demo")
    settings.ALLOW_SEED_RESET = True
    settings.SEED_DEMO_PASSWORD = ""
    with pytest.raises(CommandError):
        run("seed_demo", "--reset", "--yes-i-am-sure")
    assert counts() == (2, 6, 8)


# ---- seed_test_fixtures --------------------------------------------------------------------


@pytest.mark.parametrize("environment", ["staging", "", "prod"])
def test_fixtures_are_refused_outside_dev_and_test(settings, environment: str) -> None:
    run("seed_demo")
    settings.DJANGO_ENV = environment
    with pytest.raises(CommandError, match="dev or test"):
        run("seed_test_fixtures")
    assert counts() == (2, 6, 8)


@pytest.mark.parametrize("environment", ["dev", "test"])
def test_fixtures_run_in_dev_and_test(settings, environment: str) -> None:
    run("seed_demo")
    settings.DJANGO_ENV = environment
    run("seed_test_fixtures")
    assert PurchaseRequest.objects.filter(company__name="Fixture Co").count() == 45


def test_fixtures_need_the_demo_data() -> None:
    with pytest.raises(CommandError, match="seed_demo"):
        run("seed_test_fixtures")
    assert counts() == (0, 0, 0)


def test_fixtures_need_the_password(settings) -> None:
    run("seed_demo")
    settings.SEED_DEMO_PASSWORD = "short"
    with pytest.raises(CommandError, match="at least 12"):
        run("seed_test_fixtures")
    assert counts() == (2, 6, 8)


def test_fixtures_are_idempotent_and_leave_the_demo_data_alone() -> None:
    run("seed_demo")
    demo_requests = PurchaseRequest.objects.exclude(company__name="Fixture Co")
    demo_before = list(demo_requests.order_by("pk").values())
    output = run("seed_test_fixtures")
    assert "Created 1 companies, 4 users and 45 requests." in output
    assert counts() == (3, 10, 53)
    again = run("seed_test_fixtures")
    assert "Created 0 companies, 0 users and 0 requests." in again
    assert counts() == (3, 10, 53)
    assert list(demo_requests.order_by("pk").values()) == demo_before


def test_fixture_users_sign_in_with_the_seed_password() -> None:
    run("seed_demo")
    run("seed_test_fixtures")
    for spec in data.FIXTURE_USERS:
        assert authenticate(username=spec.email, password=PASSWORD) is not None


@pytest.fixture
def fixtures_loaded() -> None:
    run("seed_demo")
    run("seed_test_fixtures")


def visible_count(email: str) -> int:
    return selectors.visible_requests(User.objects.get(email=email)).count()


def test_fixture_visibility_counts(fixtures_loaded) -> None:
    assert visible_count("mia@fixture.example") == 0
    assert visible_count("eli@fixture.example") == 3
    assert visible_count("noa@fixture.example") == 25
    assert visible_count("ola@fixture.example") == 45


def test_eli_has_only_pending_requests(fixtures_loaded) -> None:
    eli = User.objects.get(email="eli@fixture.example")
    mine = selectors.visible_requests(eli)
    assert set(mine.values_list("status", flat=True)) == {"pending"}
    assert mine.filter(status="approved").count() == 0
    assert mine.filter(status="rejected").count() == 0


def test_pagination_scenarios_span_the_expected_pages(fixtures_loaded) -> None:
    ola = User.objects.get(email="ola@fixture.example")
    noa = User.objects.get(email="noa@fixture.example")
    assert -(-selectors.visible_requests(ola).count() // 20) == 3
    assert -(-selectors.visible_requests(noa).count() // 20) == 2


def fixture_requests() -> list[PurchaseRequest]:
    return list(PurchaseRequest.objects.filter(company__name="Fixture Co"))


def test_fixture_texts_amounts_and_ids(fixtures_loaded) -> None:
    by_title = {row.title: row for row in fixture_requests()}
    assert set(by_title) == {f"Fixture request {n}" for n in range(1, 46)}
    for n in range(1, 46):
        row = by_title[f"Fixture request {n}"]
        assert row.id == uuid.uuid5(data.FIXTURE_CO.id, f"request-{n}")
        assert row.description == f"Fixture request {n}."
        assert row.vendor == f"Fixture Vendor {n % 7}"
        assert row.currency == "USD"
        assert row.amount == Decimal(f"{n}.50" if n % 5 == 0 else f"{n}.00")


def test_fixture_requesters_and_statuses(fixtures_loaded) -> None:
    by_n = {int(row.title.rsplit(" ", 1)[1]): row for row in fixture_requests()}
    for n in range(1, 4):
        assert by_n[n].requester.email == "eli@fixture.example"
        assert by_n[n].status == "pending"
    for n in range(4, 29):
        row = by_n[n]
        assert row.requester.email == "noa@fixture.example"
        assert row.status == {0: "pending", 1: "approved", 2: "rejected"}[n % 3]
        if row.status == "pending":
            assert (row.decided_by_id, row.decided_at, row.rejection_reason) == (None, None, None)
        else:
            assert row.decided_by.email == "ola@fixture.example"
            assert row.decided_at == row.submitted_at + timedelta(hours=1)
        expected_reason = f"Fixture rejection {n}." if row.status == "rejected" else None
        assert row.rejection_reason == expected_reason
    for n in range(29, 46):
        assert by_n[n].requester.email == "ola@fixture.example"
        assert by_n[n].status == "pending"


def test_fixture_timestamps_tie_in_groups_of_four(fixtures_loaded) -> None:
    by_n = {int(row.title.rsplit(" ", 1)[1]): row for row in fixture_requests()}
    base = datetime(2026, 9, 1, 8, 0, tzinfo=UTC)
    for n in range(1, 46):
        assert by_n[n].submitted_at == base + timedelta(minutes=n // 4)
    group = {by_n[n].submitted_at for n in (4, 5, 6, 7)}
    assert len(group) == 1
    assert by_n[7].submitted_at != by_n[8].submitted_at


def test_tied_timestamps_are_listed_by_id_descending(fixtures_loaded) -> None:
    ola = User.objects.get(email="ola@fixture.example")
    page = selectors.list_queryset(ola, None)
    ordered = [(row.submitted_at, row.id) for row in page]
    assert ordered == sorted(ordered, reverse=True)
    assert len({stamp for stamp, _ in ordered}) < len(ordered)
