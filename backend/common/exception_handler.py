import logging
import math

from django.http import Http404
from rest_framework import exceptions
from rest_framework.response import Response

from common import errors

logger = logging.getLogger("common.errors")

DRF_FIELD_CODES = {"required": "required", "null": "required", "max_length": "too_long"}


def _normalize_drf_validation(exc: exceptions.ValidationError) -> errors.ValidationFailedError:
    detail = exc.detail
    fields: dict[str, list[str]] = {}
    if isinstance(detail, dict):
        for name, items in detail.items():
            items = items if isinstance(items, list) else [items]
            codes = [DRF_FIELD_CODES.get(getattr(i, "code", ""), "invalid_format") for i in items]
            fields[str(name)] = codes or ["invalid_format"]
    else:
        fields["_body"] = ["invalid_format"]
    return errors.ValidationFailedError(fields)


def to_application_error(exc: Exception) -> errors.ApplicationError:
    if isinstance(exc, errors.ApplicationError):
        return exc
    if isinstance(exc, exceptions.ValidationError):
        return _normalize_drf_validation(exc)
    if isinstance(exc, exceptions.ParseError | exceptions.UnsupportedMediaType):
        return errors.ValidationFailedError({"_body": ["invalid_format"]})
    if isinstance(exc, exceptions.NotAuthenticated | exceptions.AuthenticationFailed):
        return errors.NotAuthenticatedError()
    if isinstance(exc, exceptions.PermissionDenied):
        return errors.NotPermittedError()
    if isinstance(exc, exceptions.NotFound | Http404):
        return errors.NotFoundError()
    if isinstance(exc, exceptions.MethodNotAllowed):
        return errors.MethodNotAllowedError()
    if isinstance(exc, exceptions.APIException) and exc.status_code < 500:
        # default_detail, not detail: detail may carry request-specific text.
        return errors.ProtocolError(exc.status_code, exc.default_code, str(exc.default_detail))
    return errors.ServerError()


def exception_handler(exc: Exception, context: dict) -> Response:
    error = to_application_error(exc)
    headers = {}
    if getattr(exc, "wait", None):
        headers["Retry-After"] = str(math.ceil(exc.wait))
    if isinstance(error, errors.ServerError):
        request = context.get("request")
        # Never log bodies or credentials: only the path and the exception.
        logger.error(
            "unhandled exception %s on %s",
            type(exc).__name__,
            getattr(request, "path", "?"),
            exc_info=exc,
        )
    return Response(error.body(), status=error.status_code, headers=headers)
