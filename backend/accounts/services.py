from django.contrib.auth import authenticate, login, logout
from django.http import HttpRequest

from accounts.models import User
from common.errors import InvalidCredentialsError
from common.validators import TRIM_CHARS


def sign_in(request: HttpRequest, email: str, password: str) -> User:
    """Authenticate and start a fresh session.

    authenticate() hashes the password even for unknown emails, and inactive accounts fail
    the same way as a wrong password (D-24).
    """
    user = authenticate(
        request,
        username=email.strip(TRIM_CHARS).lower(),
        password=password,
    )
    if user is None:
        raise InvalidCredentialsError()
    # login() rotates the session key and the CSRF token, and flushes a previous user's session.
    login(request, user)
    return user


def sign_out(request: HttpRequest) -> None:
    logout(request)
