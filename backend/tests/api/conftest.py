"""Fixtures and factory functions for the API acceptance tests."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from accounts.models import Company, User
from approvals.models import PurchaseRequest

from .helpers import Api

PASSWORD = "correct-horse-battery"
BASE_TIME = datetime(2026, 10, 1, 9, 0, 0, tzinfo=UTC)


def make_company(name: str) -> Company:
    return Company.objects.create(name=name)


def make_user(
    company: Company,
    email: str,
    display_name: str,
    role: str = "employee",
    *,
    password: str = PASSWORD,
    is_active: bool = True,
) -> User:
    user = User.objects.create_user(
        email, password, display_name=display_name, company=company, role=role
    )
    if not is_active:
        user.is_active = False
        user.save()
    return user


def make_request(
    requester: User,
    *,
    title: str = "Test purchase",
    vendor: str = "Test Vendor",
    description: str = "Test description.",
    amount: str = "10.00",
    status: str = "pending",
    submitted_at: datetime | None = None,
    decided_by: User | None = None,
    decided_at: datetime | None = None,
    rejection_reason: str | None = None,
    request_id: uuid.UUID | None = None,
    idempotency_key: uuid.UUID | None = None,
) -> PurchaseRequest:
    fields: dict[str, object] = {}
    if request_id is not None:
        fields["id"] = request_id
    if status != "pending":
        assert decided_by is not None
        fields["decided_by"] = decided_by
        fields["decided_at"] = decided_at or (submitted_at or BASE_TIME) + timedelta(hours=1)
        fields["rejection_reason"] = rejection_reason if status == "rejected" else None
    return PurchaseRequest.objects.create(
        company=requester.company,
        requester=requester,
        title=title,
        vendor=vendor,
        description=description,
        amount=Decimal(amount),
        currency="USD",
        status=status,
        submitted_at=submitted_at or BASE_TIME,
        idempotency_key=idempotency_key or uuid.uuid4(),
        **fields,
    )


@dataclass
class World:
    """Two companies. Northstar: alex, sam (employees), jordan, taylor (managers). Harbor: casey,
    riley."""

    north: Company
    harbor: Company
    alex: User
    sam: User
    jordan: User
    taylor: User
    casey: User
    riley: User


@pytest.fixture(autouse=True)
def fast_password_hasher(settings) -> None:
    """Keep the suite quick: the hashing algorithm is not under test here."""
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture
def world(db: None) -> World:
    north = make_company("Northstar Labs")
    harbor = make_company("Harbor Works")
    return World(
        north=north,
        harbor=harbor,
        alex=make_user(north, "alex@northstar.example", "Alex Morgan"),
        sam=make_user(north, "sam@northstar.example", "Sam Rivera"),
        jordan=make_user(north, "jordan@northstar.example", "Jordan Lee", "manager"),
        taylor=make_user(north, "taylor@northstar.example", "Taylor Chen", "manager"),
        casey=make_user(harbor, "casey@harbor.example", "Casey Patel"),
        riley=make_user(harbor, "riley@harbor.example", "Riley Brooks", "manager"),
    )


@pytest.fixture
def anon() -> Api:
    return Api()


@pytest.fixture
def login_as() -> Callable[[User], Api]:
    """Sign in through the real login endpoint and return the signed-in client."""

    def _login(user: User) -> Api:
        api = Api()
        response = api.login(user.email, PASSWORD)
        assert response.status_code == 200, response.content
        return api

    return _login


@pytest.fixture
def pending(world: World) -> PurchaseRequest:
    """A pending request from Alex in Northstar."""
    return make_request(world.alex, title="Alex pending")


@pytest.fixture
def force_as() -> Callable[[User], Api]:
    """Session via force_login, for tests that are not about authentication (fast)."""

    def _force(user: User) -> Api:
        api = Api()
        api.client.force_login(user)
        return api

    return _force
