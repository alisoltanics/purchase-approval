"""Field validators for D-25..D-30 and D-56 (docs/api-contract.md section 6).

Each validator returns the normalized value or raises FieldInvalidError with the first error code.
Both this module and frontend/src/validation/ must pass testdata/validation-cases.json.
Python's str.strip() is deliberately not used: it differs from the contract's trim set.
"""

import re
import unicodedata
from collections.abc import Callable, Mapping
from decimal import Decimal
from typing import Any, Final

from common.errors import ValidationFailedError

TRIM_CHARS: Final = (
    "\u0009\u000a\u000b\u000c\u000d \u0085  "
    + "".join(chr(cp) for cp in range(0x2000, 0x200B))
    + "    　"
)
AMOUNT_TRIM_CHARS: Final = "\u0009\u000a\u000b\u000c\u000d "

TITLE_MAX: Final = 120
VENDOR_MAX: Final = 120
DESCRIPTION_MAX: Final = 2000
REASON_MAX: Final = 1000

AMOUNT_MIN: Final = Decimal("0.01")
AMOUNT_MAX: Final = Decimal("999999.99")
AMOUNT_PATTERN: Final = re.compile(r"[0-9]+(?:\.[0-9]+)?")
LINE_SEPARATORS: Final = "  "


class _Missing:
    def __repr__(self) -> str:
        return "MISSING"


MISSING: Final = _Missing()


class FieldInvalidError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _is_lone_surrogate(char: str) -> bool:
    return "\ud800" <= char <= "\udfff"


def validate_text(value: Any, *, max_length: int, multiline: bool) -> str:
    if value is MISSING or value is None:
        raise FieldInvalidError("required")
    if not isinstance(value, str):
        raise FieldInvalidError("invalid_format")
    if multiline:
        value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = value.strip(TRIM_CHARS)
    if not value:
        raise FieldInvalidError("required")
    for char in value:
        if _is_lone_surrogate(char):
            raise FieldInvalidError("invalid_characters")
        if unicodedata.category(char) == "Cc" and not (multiline and char == "\n"):
            raise FieldInvalidError("invalid_characters")
        if not multiline and char in LINE_SEPARATORS:
            raise FieldInvalidError("invalid_characters")
    if len(value) > max_length:
        raise FieldInvalidError("too_long")
    return value


def validate_title(value: Any) -> str:
    return validate_text(value, max_length=TITLE_MAX, multiline=False)


def validate_vendor(value: Any) -> str:
    return validate_text(value, max_length=VENDOR_MAX, multiline=False)


def validate_description(value: Any) -> str:
    return validate_text(value, max_length=DESCRIPTION_MAX, multiline=True)


def validate_reason(value: Any) -> str:
    return validate_text(value, max_length=REASON_MAX, multiline=True)


def validate_amount(value: Any) -> str:
    """Returns the amount as a two-decimal string. Never goes through float."""
    if value is MISSING or value is None:
        raise FieldInvalidError("required")
    if not isinstance(value, str):
        raise FieldInvalidError("invalid_format")
    value = value.strip(AMOUNT_TRIM_CHARS)
    if not value:
        raise FieldInvalidError("required")
    if not AMOUNT_PATTERN.fullmatch(value):
        raise FieldInvalidError("invalid_format")
    integer_part, _, fraction = value.partition(".")
    if len(fraction) > 2:
        raise FieldInvalidError("too_many_decimals")
    if len(integer_part) > 6:
        raise FieldInvalidError("out_of_range")
    amount = Decimal(value)
    if not AMOUNT_MIN <= amount <= AMOUNT_MAX:
        raise FieldInvalidError("out_of_range")
    return f"{amount:.2f}"


def validate_login_email(value: Any) -> str:
    if value is MISSING or value is None:
        raise FieldInvalidError("required")
    if not isinstance(value, str):
        raise FieldInvalidError("invalid_format")
    value = value.strip(TRIM_CHARS)
    if not value:
        raise FieldInvalidError("required")
    return value


def validate_login_password(value: Any) -> str:
    """The password is never trimmed."""
    if value is MISSING or value is None:
        raise FieldInvalidError("required")
    if not isinstance(value, str):
        raise FieldInvalidError("invalid_format")
    if value == "":
        raise FieldInvalidError("required")
    return value


Validator = Callable[[Any], str]


def validate_fields(data: Mapping[str, Any], validators: Mapping[str, Validator]) -> dict[str, str]:
    """Validate every field; raise ValidationFailedError listing all failures (first code each)."""
    cleaned: dict[str, str] = {}
    failures: dict[str, list[str]] = {}
    for name, validator in validators.items():
        try:
            cleaned[name] = validator(data.get(name, MISSING))
        except FieldInvalidError as exc:
            failures[name] = [exc.code]
    if failures:
        raise ValidationFailedError(failures)
    return cleaned
