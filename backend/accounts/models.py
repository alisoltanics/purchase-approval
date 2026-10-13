import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.db.models.functions import Lower

from accounts.settings import Role
from common.db import between_length


class Company(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="ID",
    )
    name = models.CharField(
        max_length=120,
        unique=True,
        verbose_name="name",
    )

    def __str__(self) -> str:
        return self.name


class UserManager(BaseUserManager["User"]):
    use_in_migrations = True

    def get_queryset(self) -> models.QuerySet["User"]:
        # Every response that shows a user also shows their company: load both in one query.
        return super().get_queryset().select_related("company")

    def create_user(self, email: str, password: str | None, **extra) -> "User":
        user = self.model(email=email.lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="ID",
    )
    # Always stored lowercase (CHECK below), so plain uniqueness equals unique lower(email).
    email = models.CharField(
        max_length=254,
        unique=True,
        verbose_name="email",
    )
    display_name = models.CharField(
        max_length=120,
        verbose_name="display name",
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name="users",
        verbose_name="company",
    )
    role = models.CharField(
        max_length=8,
        choices=Role.choices,
        verbose_name="role",
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="active",
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        constraints = [
            # Target of the composite foreign keys on purchase_request.
            models.UniqueConstraint(fields=["company", "id"], name="user_company_id_unique"),
            models.CheckConstraint(
                condition=models.Q(email=Lower("email")), name="user_email_is_lowercase"
            ),
            models.CheckConstraint(
                condition=models.Q(role__in=["employee", "manager"]), name="user_role_valid"
            ),
            models.CheckConstraint(
                condition=between_length("display_name", 1, 120),
                name="user_display_name_length",
            ),
        ]

    def __str__(self) -> str:
        return self.email
