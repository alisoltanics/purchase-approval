from typing import Any


class RequestDetailContextMixin:
    """RequestDetailSerializer renders can_decide for the caller."""

    def get_serializer_context(self) -> dict[str, Any]:
        return {
            **super().get_serializer_context(),
            "user": self.request.user,
        }
