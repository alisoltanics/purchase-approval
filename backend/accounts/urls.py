from django.urls import path

from accounts import views

urlpatterns = [
    path("csrf/", views.CsrfAPIView.as_view()),
    path("login/", views.LoginAPIView.as_view()),
    path("logout/", views.LogoutAPIView.as_view()),
    path("me/", views.MeAPIView.as_view()),
]
