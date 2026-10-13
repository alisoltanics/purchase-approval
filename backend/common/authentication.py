from rest_framework import authentication, exceptions

from common.errors import CsrfFailedError


class SessionAuthentication(authentication.SessionAuthentication):
    """Session auth whose CSRF failure uses the project error format (D-18, D-20)."""

    def enforce_csrf(self, request):
        try:
            # The Django request, not DRF's wrapper: the wrapper's POST would parse the body,
            # and endpoints that ignore their body (approve) must not fail on a malformed one.
            super().enforce_csrf(request._request)
        except exceptions.PermissionDenied as exc:
            raise CsrfFailedError() from exc
