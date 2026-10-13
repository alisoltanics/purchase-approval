"""Who may decide a request. Used by the decision endpoints and by can_decide in responses."""

from __future__ import annotations

from typing import TYPE_CHECKING

from accounts.settings import Role
from approvals.settings import Status
from common.errors import ApplicationError, NotPermittedError, OwnRequestError

if TYPE_CHECKING:
    from accounts.models import User
    from approvals.models import PurchaseRequest


def review_error(user: User, purchase_request: PurchaseRequest) -> ApplicationError | None:
    """D-18 steps 4 and 5: the role first, then the requester."""
    if user.role != Role.MANAGER:
        return NotPermittedError()
    if purchase_request.requester_id == user.id:
        return OwnRequestError()
    return None


def can_decide(user: User, purchase_request: PurchaseRequest) -> bool:
    return review_error(user, purchase_request) is None and (
        purchase_request.status == Status.PENDING
    )
