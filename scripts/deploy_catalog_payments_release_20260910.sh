#!/usr/bin/env bash
set -Eeuo pipefail

# One-shot production release for the 2026-09-10 catalogue/payment code.
# It intentionally does not enable real-money checkout: production banking and
# fiscal flags remain owned by /opt/poizon/secrets/backend.env.

umask 077

root_dir="${POIZON_ROOT:-/opt/poizon}"
backend_dir="$root_dir/poizon-bot"
frontend_dir="$root_dir/poizon-select-site"
env_file="$root_dir/secrets/backend.env"
backend_branch="feat/raketa-delivery-20260909"
frontend_branch="feat/raketa-delivery-ui-20260909"
backend_sha="${BACKEND_SHA:?BACKEND_SHA is required}"
frontend_sha="${FRONTEND_SHA:?FRONTEND_SHA is required}"
started_at="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="$root_dir/backups/catalog-payments-$started_at"

for value in "$backend_sha" "$frontend_sha"; do
  if [[ ! "$value" =~ ^[0-9a-f]{40}$ ]]; then
    printf 'Invalid release SHA: %s\n' "$value" >&2
    exit 2
  fi
done

if [[ "$(id -u)" != 0 ]]; then
  printf 'Run this release as root.\n' >&2
  exit 3
fi

for path in "$backend_dir/.git" "$frontend_dir/.git" "$env_file"; do
  if [[ ! -e "$path" ]]; then
    printf 'Required production path is missing: %s\n' "$path" >&2
    exit 4
  fi
done

install -d -m 700 "$backup_dir"
release_log="$backup_dir/release.log"
exec > >(tee -a "$release_log") 2>&1

printf 'RELEASE_STARTED=%s\n' "$started_at"
printf 'BACKUP_DIR=%s\n' "$backup_dir"

cd "$root_dir"
docker compose config --quiet

for repo in "$backend_dir" "$frontend_dir"; do
  git -C "$repo" status --short --branch
  if ! git -C "$repo" diff --quiet || ! git -C "$repo" diff --cached --quiet; then
    printf 'Tracked production changes detected in %s; release stopped.\n' "$repo" >&2
    exit 10
  fi
done

old_backend_sha="$(git -C "$backend_dir" rev-parse HEAD)"
old_frontend_sha="$(git -C "$frontend_dir" rev-parse HEAD)"
old_backend_ref="$(git -C "$backend_dir" symbolic-ref --short -q HEAD || printf 'DETACHED')"
old_frontend_ref="$(git -C "$frontend_dir" symbolic-ref --short -q HEAD || printf 'DETACHED')"

{
  printf 'backend_sha=%s\n' "$old_backend_sha"
  printf 'backend_ref=%s\n' "$old_backend_ref"
  printf 'frontend_sha=%s\n' "$old_frontend_sha"
  printf 'frontend_ref=%s\n' "$old_frontend_ref"
  docker compose ps
} > "$backup_dir/before-release.txt"

git -C "$backend_dir" status --porcelain=v1 -uall > "$backup_dir/backend-status.txt"
git -C "$frontend_dir" status --porcelain=v1 -uall > "$backup_dir/frontend-status.txt"
git -C "$backend_dir" diff --binary > "$backup_dir/backend-local.patch"
git -C "$frontend_dir" diff --binary > "$backup_dir/frontend-local.patch"
install -m 600 "$env_file" "$backup_dir/backend.env"

git -C "$backend_dir" fetch --no-tags origin "$backend_branch"
fetched_backend_sha="$(git -C "$backend_dir" rev-parse FETCH_HEAD)"
if [[ "$fetched_backend_sha" != "$backend_sha" ]]; then
  printf 'Backend ref moved: expected=%s fetched=%s\n' "$backend_sha" "$fetched_backend_sha" >&2
  exit 11
fi

git -C "$frontend_dir" fetch --no-tags origin "$frontend_branch"
fetched_frontend_sha="$(git -C "$frontend_dir" rev-parse FETCH_HEAD)"
if [[ "$fetched_frontend_sha" != "$frontend_sha" ]]; then
  printf 'Frontend ref moved: expected=%s fetched=%s\n' "$frontend_sha" "$fetched_frontend_sha" >&2
  exit 12
fi

declare -A old_image_ids=()
declare -A old_image_refs=()
declare -A rollback_tags=()
for service in api bot select; do
  container_id="$(docker compose ps -q "$service")"
  if [[ -z "$container_id" ]]; then
    printf 'Required production service is not running: %s\n' "$service" >&2
    exit 13
  fi
  old_image_ids["$service"]="$(docker inspect --format '{{.Image}}' "$container_id")"
  old_image_refs["$service"]="$(docker inspect --format '{{.Config.Image}}' "$container_id")"
  rollback_tags["$service"]="poizon-release-rollback-$service:$started_at"
  docker image tag "${old_image_ids[$service]}" "${rollback_tags[$service]}"
done

writers_stopped=false
cache_apply_started=false

restore_code_and_services() {
  status="$?"
  trap - ERR
  set +e
  printf 'RELEASE_FAILED_STATUS=%s\n' "$status"

  if [[ "$cache_apply_started" == false ]]; then
    install -m 600 "$backup_dir/backend.env" "$env_file"
    git -C "$backend_dir" switch --detach "$old_backend_sha"
    git -C "$frontend_dir" switch --detach "$old_frontend_sha"
    for service in api bot select; do
      docker image tag "${rollback_tags[$service]}" "${old_image_refs[$service]}"
    done
  else
    python3 - "$env_file" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines()
key = "POIZON_PRICE_REFRESH_ENABLED"
replacement = f"{key}=true"
updated = []
seen = False
for line in lines:
    if line.startswith(f"{key}="):
        if not seen:
            updated.append(replacement)
            seen = True
    else:
        updated.append(line)
if not seen:
    updated.append(replacement)
path.write_text("\n".join(updated) + "\n", encoding="utf-8")
PY
  fi

  if [[ "$writers_stopped" == true ]]; then
    docker compose up -d --no-deps --force-recreate api bot select
  fi
  printf 'ROLLBACK_OR_SAFE_RESTART_FINISHED=1\n'
  printf 'Review log: %s\n' "$release_log"
  exit "$status"
}
trap restore_code_and_services ERR

database_url="$(
  docker compose exec -T api python -c \
    'import os; print(os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://", 1))'
)"
if [[ "$database_url" != postgresql://* && "$database_url" != postgres://* ]]; then
  printf 'The running API did not expose a PostgreSQL DATABASE_URL.\n' >&2
  exit 14
fi

git -C "$backend_dir" switch --detach "$backend_sha"
git -C "$frontend_dir" switch --detach "$frontend_sha"

docker compose build api bot select
printf 'IMAGES_BUILT=ok\n'

docker compose stop api bot
writers_stopped=true

database_backup="$backup_dir/production.dump"
docker run --rm --network host -e ACTIVE_DATABASE_URL="$database_url" postgres:18-alpine \
  sh -ceu 'pg_dump --dbname="$ACTIVE_DATABASE_URL" --format=custom --no-owner --no-privileges' \
  > "$database_backup"
unset database_url
chmod 600 "$database_backup"
test -s "$database_backup"
sha256sum "$database_backup" > "$database_backup.sha256"
sha256sum -c "$database_backup.sha256"
docker run --rm -i postgres:18-alpine pg_restore --list < "$database_backup" >/dev/null
printf 'DATABASE_BACKUP=valid\n'

python3 - "$env_file" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
desired = {
    "POIZON_PRICE_REFRESH_ENABLED": "false",
    "POIZON_CATALOG_COORDINATOR_FILE": "/app/data/poizon-catalog-coordinator.json",
    "POIZON_INTERNATIONAL_DELIVERY_RUB": "1500",
}
lines = path.read_text(encoding="utf-8").splitlines()
updated = []
seen = set()
for line in lines:
    key = line.split("=", 1)[0] if "=" in line else ""
    if key in desired:
        if key not in seen:
            updated.append(f"{key}={desired[key]}")
            seen.add(key)
    else:
        updated.append(line)
for key, value in desired.items():
    if key not in seen:
        updated.append(f"{key}={value}")
path.write_text("\n".join(updated) + "\n", encoding="utf-8")
PY
chmod 600 "$env_file"

docker compose run --rm --no-deps -T api python - <<'PY'
from bot.config import settings
from parser.catalog_recommendations import load_public_catalog

version, products = load_public_catalog()
if len(products) != 209:
    raise SystemExit(f"unexpected packaged catalogue: {len(products)}")
if float(settings.POIZON_INTERNATIONAL_DELIVERY_RUB) != 1500:
    raise SystemExit("international delivery is not 1500 RUB")
if settings.POIZON_PRICE_REFRESH_ENABLED:
    raise SystemExit("background price refresh was not paused")
settings.validate_database_startup()
print(f"RELEASE_PREFLIGHT=ok catalog={len(products)} version={version}")
PY

docker compose run --rm -T api python -m database.migrate
printf 'DATABASE_MIGRATION=ok\n'

docker compose run --rm --no-deps -T api \
  python scripts/refresh_poizon_price_policy.py \
    --expected-count 209 \
    --minimum-public-prices 200 \
    --source-attempt-budget 100 \
  > "$backup_dir/price-refresh-dry-run.json"
printf 'PRICE_REFRESH_DRY_RUN=ok\n'

cache_apply_started=true
docker compose run --rm --no-deps -T api \
  python scripts/refresh_poizon_price_policy.py \
    --apply \
    --expected-count 209 \
    --minimum-public-prices 200 \
    --source-attempt-budget 100 \
  > "$backup_dir/price-refresh-apply.json"
printf 'PRICE_REFRESH_APPLY=ok\n'

python3 - "$env_file" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines()
key = "POIZON_PRICE_REFRESH_ENABLED"
replacement = f"{key}=true"
updated = []
seen = False
for line in lines:
    if line.startswith(f"{key}="):
        if not seen:
            updated.append(replacement)
            seen = True
    else:
        updated.append(line)
if not seen:
    updated.append(replacement)
path.write_text("\n".join(updated) + "\n", encoding="utf-8")
PY
chmod 600 "$env_file"

docker compose up -d --no-deps --force-recreate api
for attempt in $(seq 1 45); do
  if curl -fsS --max-time 5 http://127.0.0.1:8000/api/health >/dev/null; then
    break
  fi
  if [[ "$attempt" == 45 ]]; then
    printf 'LOCAL_API_HEALTH=failed\n' >&2
    false
  fi
  sleep 2
done
printf 'LOCAL_API_HEALTH=ok\n'

docker compose up -d --no-deps --force-recreate bot select

for attempt in $(seq 1 30); do
  if curl -fsS --max-time 10 https://kicksbase.ru/api/health >/dev/null \
    && [[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 https://kicksbase.ru/)" == 200 ]]; then
    break
  fi
  if [[ "$attempt" == 30 ]]; then
    printf 'PUBLIC_HEALTH=failed\n' >&2
    false
  fi
  sleep 2
done
printf 'PUBLIC_HEALTH=ok\n'

catalog_json="$backup_dir/catalog-after.json"
curl -fsS --max-time 30 'https://kicksbase.ru/api/checkout/orders?mode=catalog' > "$catalog_json"
python3 - "$catalog_json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    payload = json.load(source)

catalog_count = int(payload.get("catalog_count") or 0)
current_count = int(payload.get("current_priced_count") or 0)
old_delivery = 0
unexpected_delivery = 0

def walk(value):
    global old_delivery, unexpected_delivery
    if isinstance(value, dict):
        for key, item in value.items():
            if key == "rf_delivery" and isinstance(item, (int, float)):
                if float(item) == 1000:
                    old_delivery += 1
                elif float(item) != 1500:
                    unexpected_delivery += 1
            walk(item)
    elif isinstance(value, list):
        for item in value:
            walk(item)

walk(payload)
print(
    f"CATALOG_GATE catalog={catalog_count} current_prices={current_count} "
    f"old_delivery={old_delivery} unexpected_delivery={unexpected_delivery}"
)
if catalog_count != 209 or current_count < 200 or old_delivery or unexpected_delivery:
    raise SystemExit("production catalogue gate failed")
PY

docker compose exec -T api python - <<'PY'
from bot.config import settings

terminal = str(settings.TBANK_TERMINAL_KEY or "")
terminal_mode = "missing"
if terminal:
    terminal_mode = "demo" if terminal.upper().endswith("DEMO") else "production"
print(f"TBANK_TERMINAL_MODE={terminal_mode}")
print(f"TBANK_PASSWORD_PRESENT={bool(settings.TBANK_PASSWORD)}")
print(f"CLOUDKASSIR_CREDENTIALS_PRESENT={bool(settings.CLOUDKASSIR_PUBLIC_ID and settings.CLOUDKASSIR_API_SECRET)}")
print(f"PAYMENT_PROVIDER={settings.PAYMENT_PROVIDER}")
print(f"PAYMENT_PROVIDER_CONFIGURED={settings.PAYMENT_PROVIDER_CONFIGURED}")
print(f"KKT_PROVIDER={settings.KKT_PROVIDER}")
print(f"KKT_REGISTERED={settings.KKT_REGISTERED}")
print(f"CHECKOUT_CATALOG_APPROVED={settings.CHECKOUT_CATALOG_APPROVED}")
PY

docker compose logs --tail=240 api bot > "$backup_dir/service-logs-after.txt"
if grep -Eq 'Traceback|permission denied|relation .* does not exist' "$backup_dir/service-logs-after.txt"; then
  printf 'SERVICE_LOG_GATE=failed\n' >&2
  false
fi

{
  printf 'finished_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'backend_sha=%s\n' "$backend_sha"
  printf 'frontend_sha=%s\n' "$frontend_sha"
  sha256sum "$database_backup" "$catalog_json" "$backup_dir/price-refresh-apply.json"
  docker compose ps
} > "$backup_dir/release-result.txt"
chmod 600 "$backup_dir"/*

writers_stopped=false
trap - ERR

if [[ -f /run/sshd-alt.pid ]]; then
  alt_pid="$(cat /run/sshd-alt.pid)"
  if [[ "$alt_pid" =~ ^[0-9]+$ ]]; then
    kill "$alt_pid" 2>/dev/null || true
  fi
fi

printf 'RELEASE_RESULT=%s\n' "$backup_dir/release-result.txt"
printf 'RELEASE_COMPLETED=ok\n'
