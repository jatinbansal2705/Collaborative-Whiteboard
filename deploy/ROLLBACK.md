# Rollback Runbook

Every production deployment is an immutable, versioned artifact set plus a git
tag. Rollback means **redeploying a previous version** — never hot-patching a
running container.

## What identifies a deployment

| Artifact        | Identifier                                              |
| --------------- | ------------------------------------------------------- |
| Git tag         | `deploy/<run_number>` (e.g. `deploy/142`)               |
| Container image | `ghcr.io/<org>/<repo>/whiteboard-{api,web}:<git-sha>`   |
|                 | …and `:deploy-<run_number>` alias                       |
| Sentry release  | `<git-sha>` (per project: api + web)                    |

The `Deploy` workflow tags the deployed commit after the health-check gate
passes, so `git tag --list 'deploy/*'` is the authoritative deployment history.

## Standard procedure (≤ 10 minutes)

1. **Identify the last known-good tag**

   ```bash
   git fetch --tags origin
   git tag --list 'deploy/*' --sort=-creatordate | Select-Object -Skip 1 -First 1
   # -> e.g. deploy/141
   ```

2. **Redeploy that ref** — run the Deploy workflow manually against it:

   ```bash
   gh workflow run deploy.yml --ref main -f ref=deploy/141
   ```

   The pipeline rebuilds from that exact commit, pushes images tagged with its
   SHA, re-runs migrations if needed (`prisma migrate deploy` is idempotent for
   already-applied migrations), deploys web/API, and gates on health checks
   before tagging `deploy/<new run number>`.

3. **Watch the health gate**

   ```bash
   gh run watch
   ```

   The gate hits `/health` (API) and `/` (web); a failed gate blocks the new
   deployment tag, signalling to roll further back.

4. **Verify** — hit `/api/v1` info endpoint, check Sentry for error-rate
   recovery, confirm Socket.IO connections resume (clients reconnect
   automatically).

## Container-only quick rollback (compose hosts)

When you need to skip CI entirely on a self-hosted compose box:

```bash
docker pull ghcr.io/<org>/<repo>/whiteboard-api:<previous-sha>
docker pull ghcr.io/<org>/<repo>/whiteboard-web:<previous-sha>

API_IMAGE=ghcr.io/<org>/<repo>/whiteboard-api:<previous-sha> \
WEB_IMAGE=ghcr.io/<org>/<repo>/whiteboard-web:<previous-sha> \
  docker compose -f docker-compose.prod.yml up -d --no-deps api web nginx
```

Follow up by running the full workflow so the git tag history stays truthful.

## Database considerations

- Migrations run **forward only** (`prisma migrate deploy`). Rolling back the
  application does **not** revert schema changes; all migrations must stay
  backward-compatible for one release cycle (add columns nullable / with
  defaults, never drop within the same release).
- If a bad migration shipped, write a forward-fix migration instead of editing
  history. Emergency manual reversal requires a DBA and a PITR snapshot:
  restore the snapshot, then redeploy the pre-migration tag.

## Secrets & config drift

Rollbacks reuse the same environment/secrets — no rotation required unless the
incident was a leaked credential. For leaks: rotate the secret first, then
redeploy the previous tag with the new value injected.
