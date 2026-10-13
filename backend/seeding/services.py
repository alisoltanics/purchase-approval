from collections.abc import Sequence
from dataclasses import dataclass

from django.conf import settings
from django.db import transaction

from accounts.models import Company, User
from approvals.models import PurchaseRequest
from seeding import data

MIN_PASSWORD_LENGTH = 12


class SeedError(Exception):
    """A refusal the command shows to the operator. Never carries the password."""


@dataclass(frozen=True)
class SeedSummary:
    companies: int
    users: int
    requests: int


def require_password() -> str:
    password = settings.SEED_DEMO_PASSWORD
    if len(password) < MIN_PASSWORD_LENGTH:
        raise SeedError(
            f"SEED_DEMO_PASSWORD must be set and at least {MIN_PASSWORD_LENGTH} characters long.",
        )
    return password


def _ensure_companies(specs: Sequence[data.CompanySpec]) -> int:
    wanted = [spec.id for spec in specs]
    existing = set(Company.objects.filter(id__in=wanted).values_list("id", flat=True))
    missing = [spec for spec in specs if spec.id not in existing]
    Company.objects.bulk_create(
        [
            Company(
                id=spec.id,
                name=spec.name,
            )
            for spec in missing
        ],
    )
    return len(missing)


def _ensure_users(specs: Sequence[data.UserSpec], password: str) -> int:
    created = 0
    for spec in specs:
        if User.objects.filter(id=spec.id).exists():
            continue
        if User.objects.filter(email=spec.email).exists():
            raise SeedError(f"{spec.email} already exists with a different id.")
        User.objects.create_user(
            spec.email,
            password,
            id=spec.id,
            display_name=spec.display_name,
            company_id=spec.company_id,
            role=spec.role,
        )
        created += 1
    return created


def _ensure_requests(specs: Sequence[data.RequestSpec]) -> int:
    wanted = [spec.id for spec in specs]
    existing = set(PurchaseRequest.objects.filter(id__in=wanted).values_list("id", flat=True))
    missing = [spec for spec in specs if spec.id not in existing]
    PurchaseRequest.objects.bulk_create(
        [
            PurchaseRequest(
                id=spec.id,
                company_id=spec.company_id,
                requester_id=spec.requester_id,
                title=spec.title,
                vendor=spec.vendor,
                description=spec.description,
                amount=spec.amount,
                status=spec.status,
                submitted_at=spec.submitted_at,
                decided_by_id=spec.decided_by_id,
                decided_at=spec.decided_at,
                rejection_reason=spec.rejection_reason,
                # Not part of the spec and not visible in the API; the id is unique per request.
                idempotency_key=spec.id,
            )
            for spec in missing
        ],
    )
    return len(missing)


def seed_demo(password: str) -> SeedSummary:
    """Idempotent (D-45): creates what is missing by id and never changes what exists."""
    with transaction.atomic():
        return SeedSummary(
            companies=_ensure_companies(data.DEMO_COMPANIES),
            users=_ensure_users(data.DEMO_USERS, password),
            requests=_ensure_requests(data.DEMO_REQUESTS),
        )


def demo_data_exists() -> bool:
    demo_ids = [spec.id for spec in data.DEMO_USERS]
    return User.objects.filter(id__in=demo_ids).count() == len(demo_ids)


def seed_test_fixtures(password: str) -> SeedSummary:
    with transaction.atomic():
        return SeedSummary(
            companies=_ensure_companies(data.FIXTURE_COMPANIES),
            users=_ensure_users(data.FIXTURE_USERS, password),
            requests=_ensure_requests(data.build_fixture_requests()),
        )


def reset_application_data() -> None:
    """Requests first, then users, then companies: the foreign keys are PROTECT."""
    with transaction.atomic():
        PurchaseRequest.objects.all().delete()
        User.objects.all().delete()
        Company.objects.all().delete()
