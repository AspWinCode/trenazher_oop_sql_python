FROM python:3.11-slim

WORKDIR /e2e
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY submission_flow_check.py .

CMD ["python", "submission_flow_check.py"]
