FROM gcc:13-bookworm

RUN useradd -m -s /bin/sh runner
USER runner

WORKDIR /workspace
