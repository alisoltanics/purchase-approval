from django.urls import path

from approvals import views

# The id is matched as any segment so a malformed id gets the same 404 as an unknown one (D-10).
# "summary" is a fixed path and must come before the id route.
urlpatterns = [
    path("", views.RequestListCreateAPIView.as_view()),
    path("summary/", views.RequestSummaryAPIView.as_view()),
    path("<str:request_id>/", views.RequestDetailAPIView.as_view()),
    path("<str:request_id>/approve/", views.RequestApproveAPIView.as_view()),
    path("<str:request_id>/reject/", views.RequestRejectAPIView.as_view()),
]
