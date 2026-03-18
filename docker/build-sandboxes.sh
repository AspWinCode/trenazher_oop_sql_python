#!/bin/bash
set -e
cd "$(dirname "$0")/../judger/sandbox"
echo "Building Python sandbox image..."
docker build -t platform-sandbox-python:latest -f Dockerfile.python .
echo "Building SQL sandbox image..."
docker build -t platform-sandbox-sql:latest -f Dockerfile.sql .
echo "Building C++ sandbox image..."
docker build -t platform-sandbox-cpp:latest -f Dockerfile.cpp .
echo "Building JS sandbox image..."
docker build -t platform-sandbox-js:latest -f Dockerfile.js .
echo "Done. All sandbox images built."
