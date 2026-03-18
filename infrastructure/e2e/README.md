# E2E Submission Flow Check

This check validates the full path:

1. Login as admin
2. Create a `python_io` task
3. Submit a solution
4. Subscribe to submission updates over WebSocket
5. Wait for `finished` event
6. Verify final submission detail is `AC`

## Run with Docker profile

From repository root:

```bash
docker compose --env-file docker/.env -f docker/docker-compose.yml --profile e2e up --build --abort-on-container-exit --exit-code-from e2e-check e2e-check
```

## Environment variables

- `BASE_URL` (default: `http://backend:8000`)
- `ADMIN_LOGIN` (default: `admin`)
- `ADMIN_PASSWORD` (default: `admin`)
- `E2E_TIMEOUT` in seconds (default: `120`)
- `E2E_HEALTH_TIMEOUT` in seconds (default: `120`)
