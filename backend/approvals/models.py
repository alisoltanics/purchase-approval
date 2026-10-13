import uuid

from django.conf import settings
from django.db import models
from django.db.models import F, Q

from approvals.settings import Status
from common.db import between_length


class PurchaseRequest(models.Model):
    # The id is the public reference (D-03).
    id = models.UUIDField(
        primary_key=True, default=uuid.uuid4, editable=False, verbose_name="reference"
    )
    company = models.ForeignKey(
        "accounts.Company", on_delete=models.PROTECT, related_name="+", verbose_name="company"
    )
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
        verbose_name="requester",
    )
    title = models.CharField(max_length=120, verbose_name="title")
    vendor = models.CharField(max_length=120, verbose_name="vendor")
    description = models.TextField(verbose_name="description")
    amount = models.DecimalField(max_digits=8, decimal_places=2, verbose_name="amount")
    currency = models.CharField(max_length=3, default="USD", verbose_name="currency")
    status = models.CharField(
        max_length=8, choices=Status.choices, default=Status.PENDING, verbose_name="status"
    )
    submitted_at = models.DateTimeField(verbose_name="submitted at")
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="decided by",
    )
    decided_at = models.DateTimeField(null=True, blank=True, verbose_name="decided at")
    rejection_reason = models.TextField(null=True, blank=True, verbose_name="rejection reason")
    idempotency_key = models.UUIDField(verbose_name="idempotency key")

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gte="0.01", amount__lte="999999.99"), name="pr_amount_range"
            ),
            models.CheckConstraint(condition=Q(currency="USD"), name="pr_currency_usd"),
            models.CheckConstraint(
                condition=Q(status__in=["pending", "approved", "rejected"]),
                name="pr_status_valid",
            ),
            models.CheckConstraint(
                condition=between_length("title", 1, 120), name="pr_title_length"
            ),
            models.CheckConstraint(
                condition=between_length("vendor", 1, 120),
                name="pr_vendor_length",
            ),
            models.CheckConstraint(
                condition=between_length("description", 1, 2000),
                name="pr_description_length",
            ),
            models.CheckConstraint(
                condition=Q(rejection_reason__isnull=True)
                | between_length("rejection_reason", 1, 1000),
                name="pr_reason_length",
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        status="pending",
                        decided_by__isnull=True,
                        decided_at__isnull=True,
                        rejection_reason__isnull=True,
                    )
                    | Q(
                        status="approved",
                        decided_by__isnull=False,
                        decided_at__isnull=False,
                        rejection_reason__isnull=True,
                    )
                    | Q(
                        status="rejected",
                        decided_by__isnull=False,
                        decided_at__isnull=False,
                        rejection_reason__isnull=False,
                    )
                ),
                name="pr_decision_fields_match_status",
            ),
            models.CheckConstraint(
                condition=Q(decided_by__isnull=True) | ~Q(decided_by=F("requester")),
                name="pr_decider_not_requester",
            ),
            models.UniqueConstraint(
                fields=["requester", "idempotency_key"], name="pr_requester_idempotency_unique"
            ),
        ]
        indexes = [
            models.Index(
                F("company"),
                F("status"),
                F("submitted_at").desc(),
                F("id").desc(),
                name="pr_company_status_list_idx",
            ),
            models.Index(
                F("requester"),
                F("submitted_at").desc(),
                F("id").desc(),
                name="pr_requester_list_idx",
            ),
        ]
