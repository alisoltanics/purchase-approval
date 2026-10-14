from django.contrib import admin

from approvals.models import PurchaseRequest


@admin.register(PurchaseRequest)
class PurchaseRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "company", "requester", "amount", "status", "submitted_at")
    list_filter = ("company", "status")
    search_fields = ("title", "vendor", "requester__email")
    date_hierarchy = "submitted_at"
    # Decisions go through the API so the D-18 rules and the row lock always apply.
    readonly_fields = (
        "id",
        "company",
        "requester",
        "title",
        "vendor",
        "description",
        "amount",
        "currency",
        "status",
        "submitted_at",
        "decided_by",
        "decided_at",
        "rejection_reason",
        "idempotency_key",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
