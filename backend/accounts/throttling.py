"""Sign-in throttling (D-24): fixed windows of failed attempts per email and per client IP.

Counters live in the shared database cache so every Gunicorn worker sees the same counts. The
read-modify-write is not atomic: concurrent failures can overshoot a limit by a few attempts.
"""

import hashlib
import math
import time

from django.conf import settings
from django.core.cache import cache
from django.http import HttpRequest
from rest_framework.exceptions import Throttled

WINDOW_SECONDS = 15 * 60
MAX_FAILURES_PER_EMAIL = 10
MAX_FAILURES_PER_IP = 50


def now() -> float:
    return time.time()


def client_ip(request: HttpRequest) -> str:
    """REMOTE_ADDR, or the address the TRUSTED_PROXY_COUNT-th proxy from the right appended."""
    remote = request.META.get("REMOTE_ADDR", "")
    hops = settings.TRUSTED_PROXY_COUNT
    if hops <= 0:
        return remote
    forwarded = [ip.strip() for ip in request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")]
    forwarded = [ip for ip in forwarded if ip]
    return forwarded[-hops] if len(forwarded) >= hops else remote


def _keys(request: HttpRequest, email: str) -> list[tuple[str, int]]:
    # Hashed so the cache table never holds email addresses.
    email_hash = hashlib.sha256(email.encode()).hexdigest()
    return [
        (f"login-fail:email:{email_hash}", MAX_FAILURES_PER_EMAIL),
        (f"login-fail:ip:{client_ip(request)}", MAX_FAILURES_PER_IP),
    ]


def _window(key: str, current: float) -> dict | None:
    window = cache.get(key)
    return window if window and window["reset"] > current else None


def check(request: HttpRequest, email: str) -> None:
    """Raise Throttled (429) when the email or the client IP has used up its failures."""
    current = now()
    waits = []
    for key, limit in _keys(request, email):
        window = _window(key, current)
        if window and window["count"] >= limit:
            waits.append(window["reset"] - current)
    if waits:
        raise Throttled(wait=math.ceil(max(waits)))


def record_failure(request: HttpRequest, email: str) -> None:
    current = now()
    for key, _ in _keys(request, email):
        window = _window(key, current) or {"count": 0, "reset": current + WINDOW_SECONDS}
        window["count"] += 1
        cache.set(key, window, timeout=math.ceil(window["reset"] - current))


def clear_email(request: HttpRequest, email: str) -> None:
    email_key, _ = _keys(request, email)[0]
    cache.delete(email_key)
