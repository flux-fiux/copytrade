FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir "python-jose[cryptography]>=3.3.0" && \
    pip install --no-cache-dir -e ".[standard]" gunicorn==22.0.0 || pip install --no-cache-dir -e . gunicorn==22.0.0

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && gunicorn app.main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --timeout 120 --access-logfile - --error-logfile -"]
