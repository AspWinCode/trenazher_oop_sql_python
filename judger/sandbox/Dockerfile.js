FROM node:20-alpine

RUN adduser -D -s /bin/sh runner
USER runner

WORKDIR /workspace
