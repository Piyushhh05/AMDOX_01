# ── Stage 1: Builder ───────────────────────────────────────────────────────
FROM python:3.13-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libgomp1 && \
    rm -rf /var/lib/apt/lists/*

COPY apps/ml-service/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Stage 2: Runner ────────────────────────────────────────────────────────
FROM python:3.13-slim AS runner
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/root/.local/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
COPY apps/ml-service/ .

RUN addgroup --system --gid 1001 mluser && \
    adduser --system --uid 1001 --ingroup mluser mluser
USER mluser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8000/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
