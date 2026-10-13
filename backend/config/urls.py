from django.urls import include, path, re_path

from common.views import spa_index

urlpatterns = [
    path("api/", include("common.urls")),
    path("api/auth/", include("accounts.urls")),
    path("api/requests/", include("approvals.urls")),
    re_path(r"^(?!api(?:/|$)).*$", spa_index),
]
