from collections.abc import Mapping
from typing import Any, Final

from rest_framework import serializers

from accounts.serializers import UserRefSerializer
from approvals import rules, selectors
from approvals.models import PurchaseRequest
from approvals.settings import Status
from common.serializers import PageQuerySerializer, ValidatedSerializer
from common.validators import (
    validate_amount,
    validate_description,
    validate_reason,
    validate_title,
    validate_vendor,
)

# D-23: ISO 8601 UTC with a Z, whole seconds.
TIMESTAMP_FORMAT: Final = "%Y-%m-%dT%H:%M:%SZ"


class RequestListItemSerializer(serializers.ModelSerializer):
    requester = UserRefSerializer(read_only=True)
    submitted_at = serializers.DateTimeField(
        format=TIMESTAMP_FORMAT,
        read_only=True,
    )

    class Meta:
        model = PurchaseRequest
        fields = [
            "id",
            "title",
            "vendor",
            "amount",
            "currency",
            "status",
            "submitted_at",
            "requester",
        ]


class EventSerializer(serializers.Serializer):
    type = serializers.CharField()
    actor = UserRefSerializer()
    created_at = serializers.DateTimeField(format=TIMESTAMP_FORMAT)
    reason = serializers.CharField(allow_null=True)


class RequestDetailSerializer(RequestListItemSerializer):
    """Needs context["user"]: can_decide is relative to the caller."""

    decided_by = UserRefSerializer(read_only=True)
    decided_at = serializers.DateTimeField(
        format=TIMESTAMP_FORMAT,
        read_only=True,
    )
    can_decide = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()

    class Meta(RequestListItemSerializer.Meta):
        fields = [
            *RequestListItemSerializer.Meta.fields,
            "description",
            "decided_by",
            "decided_at",
            "rejection_reason",
            "can_decide",
            "events",
        ]

    def get_can_decide(self, obj: PurchaseRequest) -> bool:
        return rules.can_decide(self.context["user"], obj)

    def get_events(self, obj: PurchaseRequest) -> list[dict[str, Any]]:
        return EventSerializer(
            selectors.build_events(obj),
            many=True,
        ).data


class RequestSummarySerializer(serializers.Serializer):
    all = serializers.IntegerField()
    pending = serializers.IntegerField()
    approved = serializers.IntegerField()
    rejected = serializers.IntegerField()


class RequestListQuerySerializer(PageQuerySerializer):
    status = serializers.CharField(required=False)

    def collect(self, data: Mapping[str, Any]) -> tuple[dict[str, Any], dict[str, list[str]]]:
        values, failures = super().collect(data)
        values["status"] = None
        if "status" in data:
            if data["status"] in Status.values:
                values["status"] = data["status"]
            else:
                failures["status"] = ["invalid_choice"]
        return values, failures


class SubmitRequestSerializer(ValidatedSerializer):
    title = serializers.CharField()
    vendor = serializers.CharField()
    description = serializers.CharField()
    amount = serializers.CharField()

    field_validators = {
        "title": validate_title,
        "vendor": validate_vendor,
        "description": validate_description,
        "amount": validate_amount,
    }


class RejectRequestSerializer(ValidatedSerializer):
    reason = serializers.CharField()

    field_validators = {
        "reason": validate_reason,
    }
