from django.http import HttpRequest, HttpResponse
from rest_framework import status

from common import errors
from common.responses import error_response

API_PREFIX = "/api/"
# Django's own HTML error pages are replaced for these statuses (D-21, D-22).
REPLACED_STATUS = {
    status.HTTP_404_NOT_FOUND: errors.NotFoundError,
    status.HTTP_405_METHOD_NOT_ALLOWED: errors.MethodNotAllowedError,
    status.HTTP_500_INTERNAL_SERVER_ERROR: errors.ServerError,
}


class ApiResponseMiddleware:
    """Every /api/ response is no-store and every API error uses the JSON error format."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        if not request.path.startswith(API_PREFIX):
            return response
        error_class = REPLACED_STATUS.get(response.status_code)
        is_json = response.get("Content-Type", "").startswith("application/json")
        if error_class and not is_json:
            replacement = error_response(error_class())
            if "Allow" in response:
                replacement["Allow"] = response["Allow"]
            response = replacement
        response["Cache-Control"] = "no-store"
        return response
