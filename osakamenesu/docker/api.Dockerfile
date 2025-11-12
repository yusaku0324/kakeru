# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS api-base
WORKDIR /app
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY services/api/requirements.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

FROM api-base AS api-test
COPY requirements-test.txt ./requirements-test.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements-test.txt
COPY services/api/ ./
CMD ["pytest", "-q", "-n", "auto"]

FROM api-base AS api-runtime
COPY services/api/ ./
EXPOSE 8000
CMD ["bash", "start.sh"]
