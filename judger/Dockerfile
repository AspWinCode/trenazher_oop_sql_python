FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev docker.io && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Keep project as importable package: /app/judger
COPY . /app/judger

ENV PYTHONPATH=/app

CMD ["celery", "-A", "judger.worker:celery", "worker", "--loglevel=info", "-Q", "queue_python_io,queue_python_oop,queue_python_numpy,queue_sql,queue_cpp,queue_js", "--concurrency=4"]
