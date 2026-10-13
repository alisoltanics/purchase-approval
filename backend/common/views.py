from django.conf import settings
from django.db import DatabaseError, connection
from django.http import Http404, HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.http import require_safe

from common.errors import CsrfFailedError
from common.responses import error_response


@require_safe
def health(request: HttpRequest) -> JsonResponse:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})


@require_safe
def spa_index(request: HttpRequest) -> HttpResponse:
    try:
        content = settings.SPA_INDEX_FILE.read_bytes()
    except FileNotFoundError:
        raise Http404 from None
    response = HttpResponse(content, content_type="text/html; charset=utf-8")
    # index.html references hashed assets; it must not be cached across releases.
    response["Cache-Control"] = "no-cache"
    return response


def csrf_failure(request: HttpRequest, reason: str = "") -> JsonResponse:
    return error_response(CsrfFailedError())
