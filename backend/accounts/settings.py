from django.db import models


class Role(models.TextChoices):
    EMPLOYEE = "employee", "Employee"
    MANAGER = "manager", "Manager"
