# syntax=docker/dockerfile:1.7
# =============================================================================
# Staybooker backend — multi-stage production image.
#
# Why multi-stage:
#   * Build deps (gcc, python3-dev, libpq-dev, etc.) end up in the final image
#     at ~600MB+. Splitting build vs runtime shrinks the deployable artifact
#     and removes a class of supply-chain risk (no compiler in prod).
#   * `--no-install-recommends` and `--user` keep the image minimal.
#   * Non-root `app` user follows CIS Docker Benchmark 4.1.
#   * `tini` is PID 1 and reaps zombies, so FastAPI workers can crash safely.
#
# Build:
#   docker build -t staybooker-api -f Dockerfile .
# Run:
#   docker run --rm -p 8000:8000 --env-file backend/.env staybooker-api
# =============================================================================

# ---------- Stage 1: build dependencies in a throwaway layer ----------
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

# System deps required to compile any wheels (asyncpg, argon2-cffi, etc.)
# These are thrown away with this stage.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install Python deps into a user-site directory we can copy across stages.
COPY backend/requirements.txt ./
RUN pip install --prefix=/install -r requirements.txt


# ---------- Stage 2: minimal runtime image ----------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONFAULTHANDLER=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/home/app/.local/bin:$PATH"

# Runtime-only system deps. tini is PID 1 to reap zombie processes.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        tini \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user to run the app.
RUN groupadd --system --gid 1001 app \
    && useradd  --system --uid 1001 --gid app --home-dir /home/app --shell /bin/bash app \
    && mkdir -p /home/app /app \
    && chown -R app:app /home/app /app

# Copy the installed Python packages from the builder stage.
COPY --from=builder /install /usr/local

# Copy application source. Using --chown to avoid having to chown afterwards.
WORKDIR /app
COPY --chown=app:app backend/ /app/

USER app

EXPOSE 8000

# Healthcheck hits the unauthenticated /health endpoint we expose in main.py.
# Adjust the path if your main.py uses a different name.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# tini (PID 1) reaps zombies and forwards signals to the gunicorn/uvicorn
# process. `exec` so signals reach the worker.
ENTRYPOINT ["/usr/bin/tini", "--"]

# Default command. Worker count and port are env-driven (INF-01) so the
# same image runs on a 1GB box (WEB_CONCURRENCY=1) or a bigger plan
# (WEB_CONCURRENCY=4) without an image change, and honours Railway's $PORT.
# Shell form is required to expand the env vars. The DB pool is sized
# per-worker (see app/core/database.py) — keep WEB_CONCURRENCY × pool_size
# under the Supabase connection limit.
CMD gunicorn main:app \
     -k uvicorn.workers.UvicornWorker \
     --bind 0.0.0.0:${PORT:-8000} \
     --workers ${WEB_CONCURRENCY:-2} \
     --timeout 120 \
     --access-logfile - \
     --error-logfile -
