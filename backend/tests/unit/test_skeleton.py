import pytest
from django.db import OperationalError

INDEX_HTML = b"<!doctype html><title>spa</title>"


@pytest.fixture
def spa_index(tmp_path, settings):
    index = tmp_path / "index.html"
    index.write_bytes(INDEX_HTML)
    settings.SPA_INDEX_FILE = index
    return index


@pytest.mark.django_db
def test_health_returns_ok_when_database_is_reachable(client):
    response = client.get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_returns_503_when_database_fails(client, monkeypatch):
    def broken_cursor(*args, **kwargs):
        raise OperationalError("db down")

    monkeypatch.setattr("common.views.connection.cursor", broken_cursor)

    response = client.get("/api/health/")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}


@pytest.mark.parametrize("path", ["/", "/requests", "/requests/new", "/requests/3f2b8c1e-aaaa"])
def test_non_api_paths_serve_the_spa_index(client, spa_index, path):
    response = client.get(path)

    assert response.status_code == 200
    assert response.content == INDEX_HTML
    assert response["Cache-Control"] == "no-cache"


def test_spa_index_is_404_when_frontend_is_not_built(client, settings, tmp_path):
    settings.SPA_INDEX_FILE = tmp_path / "missing.html"

    assert client.get("/requests").status_code == 404


@pytest.mark.parametrize("path", ["/api/nope/", "/api", "/api/requests/unrouted/"])
def test_api_paths_never_fall_back_to_the_spa(client, spa_index, path):
    response = client.get(path)

    assert response.status_code == 404 or response.status_code == 301
    assert response.content != INDEX_HTML


def test_spa_fallback_is_read_only(client, spa_index):
    assert client.post("/requests").status_code == 405
