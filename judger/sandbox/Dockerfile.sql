FROM postgres:16-alpine

ENV POSTGRES_HOST_AUTH_METHOD=trust
ENV POSTGRES_USER=postgres

RUN apk add --no-cache bash

COPY sql_entrypoint.sh /usr/local/bin/sql_entrypoint.sh
RUN chmod +x /usr/local/bin/sql_entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["sh"]
