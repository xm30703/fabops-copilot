FROM node:24-bookworm-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements-lock.txt ./
RUN pip install --no-cache-dir -r requirements-lock.txt && useradd --uid 10001 --create-home fabops
COPY agent/ agent/
COPY knowledge/ knowledge/
COPY scripts/evaluate.py scripts/smoke.py scripts/
COPY --from=web /web/dist/ web/dist/
RUN mkdir artifacts && chown fabops:fabops artifacts
USER fabops
EXPOSE 4317
CMD ["python", "-m", "uvicorn", "agent.app:app", "--host", "0.0.0.0", "--port", "4317"]
