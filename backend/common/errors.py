"""The single error format of docs/api-contract.md section 5."""

from typing import Any

from rest_framework import status

FIELD_MESSAGES = {
    "required": "This field is required.",
    "too_long": "The value is too long.",
    "invalid_characters": "Remove characters that are not allowed.",
    "invalid_format": "Check the format of this value.",
    "too_many_decimals": "Use at most two decimal places.",
    "out_of_range": "The value is out of range.",
    "invalid_choice": "Choose one of the allowed values.",
}


class ApplicationError(Exception):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "server_error"
    message = "Something went wrong. Try again."

    def body(self) -> dict[str, Any]:
        return {"error": {"code": self.code, "message": self.message}}


class ValidationFailedError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "validation_error"
    message = "Check the highlighted fields."

    def __init__(self, fields: dict[str, list[str]]):
        super().__init__(self.code)
        self.fields = fields

    def body(self) -> dict[str, Any]:
        body = super().body()
        body["error"]["fields"] = {
            name: [{"code": code, "message": FIELD_MESSAGES[code]} for code in codes]
            for name, codes in self.fields.items()
        }
        return body


class NotAuthenticatedError(ApplicationError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "not_authenticated"
    message = "Sign in to continue."


class InvalidCredentialsError(ApplicationError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "invalid_credentials"
    message = "Email or password is incorrect."


class CsrfFailedError(ApplicationError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "csrf_failed"
    message = "Your session could not be verified. Reload the page and try again."


class NotPermittedError(ApplicationError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "not_permitted"
    message = "You do not have permission to decide requests."


class OwnRequestError(ApplicationError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "own_request"
    message = "Another manager must review your request."


class RequestUnavailableError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "request_unavailable"
    message = "Request unavailable. It may not exist or you may not have access."


class NotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"
    message = "Not found."


class MethodNotAllowedError(ApplicationError):
    status_code = status.HTTP_405_METHOD_NOT_ALLOWED
    code = "method_not_allowed"
    message = "Method not allowed."


class AlreadyDecidedError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    code = "already_decided"
    message = "This request has already been decided."

    def __init__(self, request: dict[str, Any]):
        super().__init__(self.code)
        self.request = request

    def body(self) -> dict[str, Any]:
        body = super().body()
        body["error"]["request"] = self.request
        return body


class IdempotencyConflictError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    code = "idempotency_conflict"
    message = "This submission key was already used with different values."


class ServerError(ApplicationError):
    pass
