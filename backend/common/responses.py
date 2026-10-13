from django.http import JsonResponse

from common.errors import ApplicationError


def error_response(error: ApplicationError) -> JsonResponse:
    return JsonResponse(error.body(), status=error.status_code)
