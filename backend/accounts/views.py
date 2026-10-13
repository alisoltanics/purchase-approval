from django.middleware.csrf import get_token
from rest_framework import generics, permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts import services
from accounts.models import User
from accounts.serializers import LoginSerializer, UserSerializer
from common.authentication import SessionAuthentication


class CsrfAPIView(APIView):
    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        get_token(request._request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class LoginAPIView(APIView):
    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        # Anonymous requests skip DRF's CSRF check, so run it explicitly and first.
        SessionAuthentication().enforce_csrf(request)
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.sign_in(
            request._request,
            serializer.validated_data["email"],
            serializer.validated_data["password"],
        )
        return Response(UserSerializer(user).data)


class LogoutAPIView(APIView):
    def post(self, request: Request) -> Response:
        services.sign_out(request._request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeAPIView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self) -> User:
        return self.request.user
