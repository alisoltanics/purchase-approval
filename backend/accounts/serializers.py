from collections.abc import Mapping
from typing import Any

from rest_framework import serializers

from accounts.models import Company, User
from common.errors import ValidationFailedError
from common.validators import validate_fields, validate_login_email, validate_login_password


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            "id",
            "name",
        ]


class UserSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "display_name",
            "role",
            "company",
        ]


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField()

    def to_internal_value(self, data: Any) -> dict[str, str]:
        # The contract's validators decide the codes and trimming (D-25); DRF's CharField
        # would coerce numbers and always trims, so it is only used to declare the fields.
        if not isinstance(data, Mapping):
            raise ValidationFailedError({"_body": ["invalid_format"]})
        return validate_fields(
            data,
            {
                "email": validate_login_email,
                "password": validate_login_password,
            },
        )
