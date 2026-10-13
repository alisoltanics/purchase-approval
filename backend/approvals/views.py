from typing import Any

from rest_framework import generics, mixins, status
from rest_framework.request import Request
from rest_framework.response import Response

from approvals import selectors, services
from approvals.identifiers import parse_idempotency_key
from approvals.mixins import RequestDetailContextMixin
from approvals.models import PurchaseRequest
from approvals.serializers import (
    RejectRequestSerializer,
    RequestDetailSerializer,
    RequestListItemSerializer,
    RequestListQuerySerializer,
    SubmitRequestSerializer,
)


class RequestListCreateAPIView(
    RequestDetailContextMixin,
    mixins.ListModelMixin,
    generics.GenericAPIView,
):
    """GET lists; POST submits through the idempotent service, so CreateModelMixin does not fit
    (the response is a different serializer, and a replay answers 200 instead of 201)."""

    serializer_class = RequestListItemSerializer

    def get_queryset(self):
        return selectors.list_queryset(
            self.request.user,
            self.query["status"],
        )

    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        # Every query problem is reported together, before anything is queried.
        query = RequestListQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        self.query = query.validated_data
        return super().list(request, *args, **kwargs)

    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return self.list(request, *args, **kwargs)

    def post(self, request: Request) -> Response:
        key = parse_idempotency_key(request.headers.get("Idempotency-Key"))
        body = SubmitRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        result = services.submit_request(
            request.user,
            key,
            body.validated_data,
        )
        return Response(
            RequestDetailSerializer(
                result.purchase_request,
                context=self.get_serializer_context(),
            ).data,
            status=status.HTTP_201_CREATED if result.created else status.HTTP_200_OK,
        )


class RequestDetailAPIView(
    RequestDetailContextMixin,
    generics.RetrieveAPIView,
):
    serializer_class = RequestDetailSerializer

    def get_object(self) -> PurchaseRequest:
        return selectors.get_visible_request(
            self.request.user,
            self.kwargs["request_id"],
        )


class RequestApproveAPIView(
    RequestDetailContextMixin,
    generics.GenericAPIView,
):
    """A state transition, not CRUD: no generic mixin applies."""

    serializer_class = RequestDetailSerializer

    def post(self, request: Request, request_id: str) -> Response:
        # The body is ignored, so it is never parsed.
        purchase_request = services.approve_request(
            request.user,
            request_id,
        )
        return Response(self.get_serializer(purchase_request).data)


class RequestRejectAPIView(
    RequestDetailContextMixin,
    generics.GenericAPIView,
):
    serializer_class = RequestDetailSerializer

    def post(self, request: Request, request_id: str) -> Response:
        def read_reason() -> str:
            body = RejectRequestSerializer(data=request.data)
            body.is_valid(raise_exception=True)
            return body.validated_data["reason"]

        purchase_request = services.reject_request(
            request.user,
            request_id,
            read_reason,
        )
        return Response(self.get_serializer(purchase_request).data)
