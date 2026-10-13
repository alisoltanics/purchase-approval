import math
from typing import Any, Final

from django.db.models import QuerySet
from rest_framework.pagination import BasePagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from common.serializers import PageQuerySerializer

PAGE_SIZE: Final = 20


class ClampedPagePagination(BasePagination):
    """Page-number pagination for every list (D-11) that clamps a page past the end (D-12).

    A view whose query has more parameters than `page` validates them together with the page
    (a PageQuerySerializer subclass) and exposes the result as `view.query`; otherwise the
    page is validated here.
    """

    page_size = PAGE_SIZE

    def paginate_queryset(
        self,
        queryset: QuerySet,
        request: Request,
        view: APIView | None = None,
    ) -> list[Any]:
        query = getattr(view, "query", None)
        if query is None:
            serializer = PageQuerySerializer(data=request.query_params)
            serializer.is_valid(raise_exception=True)
            query = serializer.validated_data
        self.count = queryset.count()
        self.page_count = max(1, math.ceil(self.count / self.page_size))
        self.page = min(query["page"], self.page_count)
        offset = (self.page - 1) * self.page_size
        return list(queryset[offset : offset + self.page_size])

    def get_paginated_response(self, data: list[Any]) -> Response:
        return Response(
            {
                "count": self.count,
                "page": self.page,
                "page_size": self.page_size,
                "page_count": self.page_count,
                "results": data,
            },
        )
