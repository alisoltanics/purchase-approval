import re
from collections.abc import Mapping
from typing import Any, ClassVar, Final

from rest_framework import serializers
from rest_framework.fields import empty

from common.errors import ValidationFailedError
from common.validators import Validator, validate_fields

ASCII_DIGITS: Final = re.compile(r"[0-9]+")
# Anything longer is far beyond any page_count and is clamped to the last page anyway.
MAX_PAGE_DIGITS: Final = 12


class ValidatedSerializer(serializers.Serializer):
    """Request body serializer whose rules are the shared validators (contract section 6).

    DRF's own fields would coerce numbers and trim differently, so the declared fields only
    describe the shape; run_validation hands the whole body to the validators.
    """

    field_validators: ClassVar[Mapping[str, Validator]] = {}

    def run_validation(self, data: Any = empty) -> dict[str, str]:
        if not isinstance(data, Mapping):
            raise ValidationFailedError({"_body": ["invalid_format"]})
        return validate_fields(
            data,
            self.field_validators,
        )


class PageQuerySerializer(serializers.Serializer):
    """The `page` query parameter (contract 3.2); list views with more parameters subclass it.

    Unknown parameters are ignored. Subclasses extend `collect`, and every failure is reported
    together.
    """

    page = serializers.CharField(required=False)

    def collect(self, data: Mapping[str, Any]) -> tuple[dict[str, Any], dict[str, list[str]]]:
        values: dict[str, Any] = {"page": 1}
        failures: dict[str, list[str]] = {}
        if "page" in data:
            raw_page = data["page"]
            digits = raw_page.lstrip("0")
            if not ASCII_DIGITS.fullmatch(raw_page) or not digits:
                failures["page"] = ["invalid_format"]
            else:
                values["page"] = (
                    int(digits) if len(digits) <= MAX_PAGE_DIGITS else 10**MAX_PAGE_DIGITS
                )
        return values, failures

    def run_validation(self, data: Any = empty) -> dict[str, Any]:
        values, failures = self.collect(data)
        if failures:
            raise ValidationFailedError(failures)
        return values
