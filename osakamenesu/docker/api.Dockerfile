# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS api-base
WORKDIR /app
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100
COPY services/api/requirements.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

FROM api-base AS api-test
COPY requirements-test.txt ./requirements-test.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements-test.txt
COPY services/api/ ./
CMD ["pytest", "-q", "-n", "auto"]
