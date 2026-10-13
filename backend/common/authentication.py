from rest_framework import authentication, exceptions

from common.errors import CsrfFailedError


class SessionAuthentication(authentication.SessionAuthentication):
    """Session auth whose CSRF failure uses the project error format (D-18, D-20)."""

    def enforce_csrf(self, request):
        try:
            super().enforce_csrf(request)
        except exceptions.PermissionDenied as exc:
            raise CsrfFailedError() from exc
