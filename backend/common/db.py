from django.db.models import Q
from django.db.models.functions import Length
from django.db.models.lookups import GreaterThanOrEqual, LessThanOrEqual


def between_length(field: str, low: int, high: int) -> Q:
    """CHECK condition: character length of `field` is within [low, high] (code points)."""
    return Q(GreaterThanOrEqual(Length(field), low), LessThanOrEqual(Length(field), high))
