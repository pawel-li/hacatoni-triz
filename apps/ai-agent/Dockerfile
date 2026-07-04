# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
COPY apps/ai-agent/pyproject.toml apps/ai-agent/uv.lock ./
RUN pip install --no-cache-dir google-genai scikit-learn
COPY apps/ai-agent/ai_agent ./ai_agent
COPY apps/ai-agent/serve.py ./serve.py
ENV PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["python", "serve.py"]
