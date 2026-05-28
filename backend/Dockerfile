# Backend Dockerfile - FastAPI + Python 3.11
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Add redis to requirements (for rate shopper)
RUN pip install --no-cache-dir redis

# Copy application code
COPY . .

# Expose port (Optional, Railway overrides this)
# EXPOSE 8001

# Use Uvicorn directly instead of Gunicorn.
# Why? Gunicorn with 2 workers uses double the RAM.
# With Pandas and Langchain, 2 workers will easily exceed Railway's 1GB RAM limit
# and cause "Application failed to respond" (OOM crash).
# A single Uvicorn process is much safer for a 1GB environment.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001} --proxy-headers --forwarded-allow-ips='*'
