from django.contrib.auth import authenticate, login, logout
from django.http import HttpRequest

from accounts import throttling
from accounts.models import User
from common.errors import InvalidCredentialsError
from common.validators import TRIM_CHARS


def sign_in(request: HttpRequest, email: str, password: str) -> User:
    """Authenticate and start a fresh session.

    authenticate() hashes the password even for unknown emails, and inactive accounts fail
    the same way as a wrong password (D-24). Failures are throttled per email and per client IP,
    whether or not the email exists.
    """
    email = email.strip(TRIM_CHARS).lower()
    throttling.check(request, email)
    user = authenticate(request, username=email, password=password)
    if user is None:
        throttling.record_failure(request, email)
        raise InvalidCredentialsError()
    throttling.clear_email(request, email)
    # login() rotates the session key and the CSRF token, and flushes a previous user's session.
    login(request, user)
    return user


def sign_out(request: HttpRequest) -> None:
    logout(request)
