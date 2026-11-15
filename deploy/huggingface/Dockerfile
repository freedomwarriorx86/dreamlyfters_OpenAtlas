# OpenAtlas on Hugging Face Spaces (Docker SDK, free CPU tier).
# Built from the folder that deploy/huggingface/deploy.py assembles:
#   backend/  frontend/ (the built site)  serve.py  start.sh  prewarm.py
FROM python:3.12-slim

RUN useradd -m -u 1000 user
WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY --chown=user backend/ /app/backend/
COPY --chown=user frontend/ /app/frontend/
COPY --chown=user serve.py start.sh prewarm.py /app/

USER user
ENV OPENATLAS_CACHE_DIR=/tmp/openatlas_cache \
    OPENATLAS_ROOT=/app/frontend \
    OPENATLAS_BACKEND=http://127.0.0.1:8000 \
    PYTHONUNBUFFERED=1

EXPOSE 7860
CMD ["bash", "/app/start.sh"]
