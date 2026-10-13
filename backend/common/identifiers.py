import re
import uuid
from typing import Final

from common.errors import ValidationFailedError

# Canonical 8-4-4-4-12 form only: uuid.UUID() would also accept braces, urn: and bare hex.
UUID_PATTERN: Final = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
)


def parse_uuid(value: str) -> uuid.UUID | None:
    if not UUID_PATTERN.fullmatch(value):
        return None
    return uuid.UUID(value)


def parse_idempotency_key(value: str | None) -> uuid.UUID:
    """The Idempotency-Key header: a UUID of any version and letter case (contract 3.3)."""
    if value is None:
        raise ValidationFailedError({"idempotency_key": ["required"]})
    key = parse_uuid(value)
    if key is None:
        raise ValidationFailedError({"idempotency_key": ["invalid_format"]})
    return key
