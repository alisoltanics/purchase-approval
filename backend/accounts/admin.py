from django.contrib import admin

from accounts.models import Company, User


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "id")
    search_fields = ("name",)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "display_name", "company", "role", "is_active")
    list_filter = ("company", "role", "is_active")
    search_fields = ("email", "display_name")
    # Passwords are changed through the sign-in flow only, never shown here.
    exclude = ("password", "last_login")
    readonly_fields = ("id",)
