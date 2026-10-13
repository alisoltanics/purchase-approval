from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING

from django.db.models import QuerySet

from accounts.settings import Role
from approvals.identifiers import parse_uuid
from approvals.models import PurchaseRequest
from approvals.settings import Status
from common.errors import RequestUnavailableError

if TYPE_CHECKING:
    from accounts.models import User


@dataclass(frozen=True)
class ActivityEvent:
    type: str
    actor: User
    created_at: datetime
    reason: str | None


def visible_requests(user: User) -> QuerySet[PurchaseRequest]:
    """The only base queryset for reads and decisions (plan 4.1)."""
    queryset = PurchaseRequest.objects.filter(company_id=user.company_id)
    if user.role != Role.MANAGER:
        queryset = queryset.filter(requester_id=user.id)
    return queryset


def get_visible_request(user: User, raw_id: str, *, lock: bool = False) -> PurchaseRequest:
    """A malformed id and a missing or inaccessible one fail identically (D-10)."""
    request_id = parse_uuid(raw_id)
    if request_id is None:
        raise RequestUnavailableError()
    queryset = visible_requests(user).select_related("requester")
    if lock:
        # decided_by is not joined here: a caller that waited on the lock would get the joined
        # columns from before the winner's update (null) next to the new decided_by_id.
        queryset = queryset.select_for_update(of=("self",))
    else:
        queryset = queryset.select_related("decided_by")
    purchase_request = queryset.filter(id=request_id).first()
    if purchase_request is None:
        raise RequestUnavailableError()
    return purchase_request


def list_queryset(user: User, status: str | None) -> QuerySet[PurchaseRequest]:
    """Visibility first, then the status filter, then the order of D-13."""
    queryset = visible_requests(user)
    if status is not None:
        queryset = queryset.filter(status=status)
    return queryset.select_related("requester").order_by(
        "-submitted_at",
        "-id",
    )


def build_events(purchase_request: PurchaseRequest) -> list[ActivityEvent]:
    """The history is derived from the row (D-55): submission first, then the decision."""
    events = [
        ActivityEvent(
            type="submitted",
            actor=purchase_request.requester,
            created_at=purchase_request.submitted_at,
            reason=None,
        ),
    ]
    if purchase_request.status != Status.PENDING:
        events.append(
            ActivityEvent(
                type=purchase_request.status,
                actor=purchase_request.decided_by,
                created_at=purchase_request.decided_at,
                reason=purchase_request.rejection_reason,
            ),
        )
    return events
