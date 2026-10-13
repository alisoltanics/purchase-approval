# syntax=docker/dockerfile:1

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1 AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app
WORKDIR /app
RUN chown app:app /app
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY --chown=app:app backend/ ./
COPY --from=frontend-build --chown=app:app /frontend/dist ./static_spa
EXPOSE 8000

# Adds dev tools (pytest, ruff). Used by dev, test and CI only; never deployed.
FROM base AS test
COPY backend/requirements-dev.txt ./
RUN pip install -r requirements-dev.txt
USER app
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# Last stage, so a plain `docker build .` produces the deployable image.
FROM base AS runtime
USER app
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
