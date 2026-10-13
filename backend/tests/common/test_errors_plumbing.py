import pytest
from django.test import Client
from django.urls import path
from rest_framework import exceptions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.test import APIClient

from common import errors
from common.validators import validate_fields, validate_title


@api_view(["GET"])
@permission_classes([AllowAny])
def boom(request):
    raise RuntimeError("secret internals SELECT * FROM x")


@api_view(["GET"])
def protected(request):
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([AllowAny])
def post_only(request):
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([AllowAny])
def raises_validation(request):
    raise exceptions.ValidationError({"title": ["bad"], "amount": ["x"]})


@api_view(["POST"])
@permission_classes([AllowAny])
def echo(request):
    return Response(request.data)


urlpatterns = [
    path("api/test/boom/", boom),
    path("api/test/protected/", protected),
    path("api/test/post-only/", post_only),
    path("api/test/validation/", raises_validation),
    path("api/test/echo/", echo),
]


@pytest.fixture
def urls(settings):
    settings.ROOT_URLCONF = __name__


def error_of(response):
    body = response.json()
    assert list(body) == ["error"]
    return body["error"]


def test_unknown_api_path_is_a_json_404(client):
    response = client.get("/api/nope/")
    assert response.status_code == 404
    assert response["Content-Type"].startswith("application/json")
    assert error_of(response) == {"code": "not_found", "message": "Not found."}


@pytest.mark.django_db
def test_every_api_response_is_no_store(client):
    assert client.get("/api/nope/")["Cache-Control"] == "no-store"
    assert client.get("/api/health/")["Cache-Control"] == "no-store"


@pytest.mark.django_db
def test_health_body_is_not_wrapped_in_the_error_format(client):
    assert client.get("/api/health/").json() == {"status": "ok"}


def test_wrong_method_on_a_django_view_is_json_405_with_allow(client):
    response = client.post("/api/health/")
    assert response.status_code == 405
    assert response["Content-Type"].startswith("application/json")
    assert error_of(response) == {
        "code": "method_not_allowed",
        "message": "Method not allowed.",
    }
    assert "GET" in response["Allow"]
    assert response["Cache-Control"] == "no-store"


def test_wrong_method_on_a_drf_view_is_json_405(urls):
    response = APIClient().get("/api/test/post-only/")
    assert response.status_code == 405
    assert error_of(response)["code"] == "method_not_allowed"
    assert response["Cache-Control"] == "no-store"


def test_non_api_paths_keep_their_own_cache_header(client, tmp_path, settings):
    index = tmp_path / "index.html"
    index.write_bytes(b"x")
    settings.SPA_INDEX_FILE = index
    assert client.get("/requests")["Cache-Control"] == "no-cache"


def test_anonymous_request_is_401_not_403(urls):
    response = APIClient().get("/api/test/protected/")
    assert response.status_code == 401
    assert error_of(response) == {
        "code": "not_authenticated",
        "message": "Sign in to continue.",
    }


def test_drf_validation_error_becomes_the_validation_format(urls):
    response = APIClient().post("/api/test/validation/", {}, format="json")
    assert response.status_code == 400
    error = error_of(response)
    assert error["code"] == "validation_error"
    assert error["message"] == "Check the highlighted fields."
    assert set(error["fields"]) == {"title", "amount"}
    assert all(item["code"] == "invalid_format" for item in error["fields"]["title"])


def test_malformed_json_body_is_a_validation_error_on_body(urls):
    response = APIClient().post(
        "/api/test/echo/", data="{not json", content_type="application/json"
    )
    assert response.status_code == 400
    error = error_of(response)
    assert error["code"] == "validation_error"
    assert [item["code"] for item in error["fields"]["_body"]] == ["invalid_format"]


def test_wrong_content_type_is_a_validation_error_on_body(urls):
    response = APIClient().post("/api/test/echo/", data="a=1", content_type="text/plain")
    assert response.status_code == 400
    assert [item["code"] for item in error_of(response)["fields"]["_body"]] == ["invalid_format"]


def test_unhandled_exception_is_a_generic_500_and_is_logged_without_details(urls, caplog):
    with caplog.at_level("ERROR", logger="common.errors"):
        response = APIClient().get("/api/test/boom/")
    assert response.status_code == 500
    assert error_of(response) == {
        "code": "server_error",
        "message": "Something went wrong. Try again.",
    }
    assert "secret internals" not in response.content.decode()
    assert response["Cache-Control"] == "no-store"
    ours = [r for r in caplog.records if r.name == "common.errors"]
    assert len(ours) == 1
    assert "RuntimeError" in ours[0].getMessage()
    assert "/api/test/boom/" in ours[0].getMessage()
    assert "secret internals" not in ours[0].getMessage()


def test_csrf_failure_uses_the_error_format():
    response = Client(enforce_csrf_checks=True).post("/api/health/")
    assert response.status_code == 403
    assert error_of(response) == {
        "code": "csrf_failed",
        "message": "Your session could not be verified. Reload the page and try again.",
    }


def test_validation_failed_body_lists_codes_with_messages():
    with pytest.raises(errors.ValidationFailedError) as exc:
        validate_fields({"title": "  "}, {"title": validate_title})
    assert exc.value.body() == {
        "error": {
            "code": "validation_error",
            "message": "Check the highlighted fields.",
            "fields": {"title": [{"code": "required", "message": "This field is required."}]},
        }
    }


def test_validate_fields_reports_every_failing_field_and_returns_clean_values():
    cleaned = validate_fields({"title": " ok "}, {"title": validate_title})
    assert cleaned == {"title": "ok"}
    with pytest.raises(errors.ValidationFailedError) as exc:
        validate_fields({}, {"title": validate_title, "vendor": validate_title})
    assert set(exc.value.fields) == {"title", "vendor"}


def test_already_decided_carries_the_current_request():
    body = errors.AlreadyDecidedError({"id": "x"}).body()
    assert body["error"]["request"] == {"id": "x"}
    assert body["error"]["code"] == "already_decided"


@pytest.mark.parametrize(
    ("error", "status", "code", "message"),
    [
        (errors.NotAuthenticatedError(), 401, "not_authenticated", "Sign in to continue."),
        (
            errors.InvalidCredentialsError(),
            401,
            "invalid_credentials",
            "Email or password is incorrect.",
        ),
        (
            errors.CsrfFailedError(),
            403,
            "csrf_failed",
            "Your session could not be verified. Reload the page and try again.",
        ),
        (
            errors.NotPermittedError(),
            403,
            "not_permitted",
            "You do not have permission to decide requests.",
        ),
        (errors.OwnRequestError(), 403, "own_request", "Another manager must review your request."),
        (
            errors.RequestUnavailableError(),
            404,
            "request_unavailable",
            "Request unavailable. It may not exist or you may not have access.",
        ),
        (errors.NotFoundError(), 404, "not_found", "Not found."),
        (errors.MethodNotAllowedError(), 405, "method_not_allowed", "Method not allowed."),
        (
            errors.IdempotencyConflictError(),
            409,
            "idempotency_conflict",
            "This submission key was already used with different values.",
        ),
        (errors.ServerError(), 500, "server_error", "Something went wrong. Try again."),
    ],
)
def test_error_classes_match_the_contract_table(error, status, code, message):
    assert error.status_code == status
    assert error.body() == {"error": {"code": code, "message": message}}
