from rest_framework import serializers

from accounts.models import Company, User
from common.serializers import ValidatedSerializer
from common.validators import validate_login_email, validate_login_password


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


class UserRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "display_name",
        ]


class LoginSerializer(ValidatedSerializer):
    email = serializers.CharField()
    password = serializers.CharField()

    field_validators = {
        "email": validate_login_email,
        "password": validate_login_password,
    }
