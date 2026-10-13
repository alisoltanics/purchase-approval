from __future__ import annotations

import uuid
from collections.abc import Callable
from decimal import Decimal
from typing import TYPE_CHECKING, NamedTuple

from django.db import IntegrityError, transaction
from django.utils import timezone

from approvals import rules, selectors
from approvals.models import PurchaseRequest
from approvals.serializers import RequestDetailSerializer
from approvals.settings import Status
from common.errors import AlreadyDecidedError, IdempotencyConflictError

if TYPE_CHECKING:
    from accounts.models import User


class SubmitResult(NamedTuple):
    purchase_request: PurchaseRequest
    created: bool


def _find_by_key(user: User, key: uuid.UUID) -> PurchaseRequest | None:
    return (
        selectors.visible_requests(user)
        .select_related(
            "requester",
            "decided_by",
        )
        .filter(idempotency_key=key)
        .first()
    )


def _replay(existing: PurchaseRequest, data: dict[str, str]) -> SubmitResult:
    """D-15: the same key and the same normalized payload returns the stored request."""
    same_payload = (
        existing.title == data["title"]
        and existing.vendor == data["vendor"]
        and existing.description == data["description"]
        and existing.amount == Decimal(data["amount"])
    )
    if not same_payload:
        raise IdempotencyConflictError()
    return SubmitResult(existing, created=False)


def submit_request(user: User, key: uuid.UUID, data: dict[str, str]) -> SubmitResult:
    """Company, requester, status and time come from the session and the server only."""
    with transaction.atomic():
        existing = _find_by_key(user, key)
        if existing is not None:
            return _replay(existing, data)
        try:
            # Savepoint: a lost race on the unique key must not poison the outer transaction.
            with transaction.atomic():
                purchase_request = PurchaseRequest.objects.create(
                    company_id=user.company_id,
                    requester=user,
                    title=data["title"],
                    vendor=data["vendor"],
                    description=data["description"],
                    amount=Decimal(data["amount"]),
                    status=Status.PENDING,
                    submitted_at=timezone.now(),
                    idempotency_key=key,
                )
        except IntegrityError:
            existing = _find_by_key(user, key)
            if existing is None:
                raise
            return _replay(existing, data)
    return SubmitResult(purchase_request, created=True)


def _decide(
    user: User,
    raw_id: str,
    status: Status,
    read_reason: Callable[[], str] | None,
) -> PurchaseRequest:
    """Checks run in the D-18 order; the first failure is raised."""
    with transaction.atomic():
        purchase_request = selectors.get_visible_request(
            user,
            raw_id,
            lock=True,
        )
        error = rules.review_error(user, purchase_request)
        if error is not None:
            raise error
        if purchase_request.status != Status.PENDING:
            raise AlreadyDecidedError(
                RequestDetailSerializer(
                    purchase_request,
                    context={"user": user},
                ).data,
            )
        # Body validation comes last so a losing client sees the current state (D-18).
        reason = read_reason() if read_reason is not None else None
        purchase_request.status = status
        purchase_request.decided_by = user
        purchase_request.decided_at = timezone.now()
        purchase_request.rejection_reason = reason
        purchase_request.save(
            update_fields=[
                "status",
                "decided_by",
                "decided_at",
                "rejection_reason",
            ],
        )
    return purchase_request


def approve_request(user: User, raw_id: str) -> PurchaseRequest:
    return _decide(
        user,
        raw_id,
        Status.APPROVED,
        None,
    )


def reject_request(user: User, raw_id: str, read_reason: Callable[[], str]) -> PurchaseRequest:
    return _decide(
        user,
        raw_id,
        Status.REJECTED,
        read_reason,
    )
