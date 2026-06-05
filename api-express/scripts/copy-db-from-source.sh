#!/usr/bin/env bash
# Copy contents of a source PostgreSQL DB into a target PostgreSQL DB.
#
# Use case: replicate preprod data into the local dev DB to debug
# without running the seed script. The target is wiped and replaced
# by an exact copy of the source (schema + data + Prisma migration state).
#
# Usage
# -----
#   ./scripts/copy-db-from-source.sh
#       reads SOURCE_URL and TARGET_URL from env or api-express/.env
#
#   ./scripts/copy-db-from-source.sh <SOURCE_URL> <TARGET_URL>
#
# Options
# -------
#   --include-logs   Include Log / NotificationLog / ApiKeyLog table data.
#                    Excluded by default (can be huge on preprod).
#   --yes, -y        Skip the interactive confirmation prompt.
#   --force-target   Allow a target URL that matches "clevercloud" /
#                    "preprod" / "prod" (DANGER, do not use casually).
#   -h, --help       Show this help.
#
# Safety
# ------
#   - Refuses to run if TARGET_URL looks like a shared environment, unless
#     --force-target is set.
#   - Drops and recreates the "public" schema on TARGET. All existing data
#     in the target is destroyed.
#   - Passes --no-owner --no-acl to pg_dump / pg_restore so cross-tenant
#     ownership info is ignored (Clever Cloud uses random db users).
#
# Requirements
# ------------
#   - pg_dump, pg_restore, psql in PATH.
#   - Local PostgreSQL client version >= source server version.
#   - Network access from this machine to the source DB.

set -euo pipefail

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

INCLUDE_LOGS=0
SKIP_CONFIRM=0
FORCE_TARGET=0
ARGS=()

usage() {
  cat <<'EOF'
Copy contents of a source PostgreSQL DB into a target PostgreSQL DB.

Use case: replicate preprod data into the local dev DB to debug
without running the seed script. The target is wiped and replaced
by an exact copy of the source (schema + data + Prisma migration state).

Usage:
  ./scripts/copy-db-from-source.sh
      reads SOURCE_URL and TARGET_URL from env or api-express/.env

  ./scripts/copy-db-from-source.sh <SOURCE_URL> <TARGET_URL>

Options:
  --include-logs   Include Log / NotificationLog / ApiKeyLog table data.
                   Excluded by default (can be huge on preprod).
  --yes, -y        Skip the interactive confirmation prompt.
  --force-target   Allow a non-local target host (DANGER, do not use
                   casually).
  -h, --help       Show this help.

Safety:
  - Refuses to run unless TARGET_URL host is localhost / 127.0.0.1 / ::1.
    Override with --force-target if you really mean to write to a remote.
  - Drops and recreates the "public" schema on TARGET. Existing data in
    the target is destroyed.
  - Passes --no-owner --no-acl to pg_dump / pg_restore so cross-tenant
    ownership info is ignored (Clever Cloud uses random db users).

Requirements:
  - pg_dump, pg_restore, psql in PATH.
  - Local PostgreSQL client version >= source server version.
EOF
  exit "${1:-1}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --include-logs)  INCLUDE_LOGS=1; shift ;;
    --yes|-y)        SKIP_CONFIRM=1;  shift ;;
    --force-target)  FORCE_TARGET=1;  shift ;;
    -h|--help)       usage 0 ;;
    --) shift; while [[ $# -gt 0 ]]; do ARGS+=("$1"); shift; done ;;
    -*) echo "Unknown option: $1" >&2; usage 1 ;;
    *)  ARGS+=("$1"); shift ;;
  esac
done

# ---------------------------------------------------------------------------
# Resolve URLs (CLI args > env vars > .env file)
# ---------------------------------------------------------------------------

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ENV_FILE="$SCRIPT_DIR/../.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

SOURCE_URL="${ARGS[0]:-${SOURCE_URL:-}}"
TARGET_URL="${ARGS[1]:-${TARGET_URL:-${POSTGRESQL_ADDON_URI:-}}}"

if [[ -z "$SOURCE_URL" ]]; then
  echo "Error: SOURCE_URL is required (1st positional arg or env)." >&2
  echo "Tip: export it from Clever Cloud (preprod app -> Information -> Postgres add-on)." >&2
  exit 1
fi
if [[ -z "$TARGET_URL" ]]; then
  echo "Error: TARGET_URL is required (2nd positional arg, env, or POSTGRESQL_ADDON_URI in .env)." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Safety: target must be a local host (whitelist)
# ---------------------------------------------------------------------------

# Extract host part (between '@' and the next ':' or '/' or '?')
target_host=$(echo "$TARGET_URL" | sed -E 's#^[^@]*@([^:/?]+).*#\1#' | tr '[:upper:]' '[:lower:]')

is_local_host=0
case "$target_host" in
  localhost|127.0.0.1|::1|host.docker.internal) is_local_host=1 ;;
esac

if [[ "$FORCE_TARGET" -eq 0 && "$is_local_host" -eq 0 ]]; then
  echo "Error: TARGET_URL host is '$target_host', which is not a local host." >&2
  echo "Allowed without --force-target : localhost, 127.0.0.1, ::1, host.docker.internal." >&2
  echo "Refusing for safety. Override with --force-target if you really mean it." >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Tool checks
# ---------------------------------------------------------------------------

for bin in pg_dump pg_restore psql; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Error: '$bin' not found in PATH." >&2
    exit 3
  fi
done

# Helpers
mask() { sed -E 's#://([^:]+):[^@]+@#://\1:*****@#'; }

# ---------------------------------------------------------------------------
# Ensure local Postgres client >= source server version.
# pg_dump refuses to dump from a newer server than itself.
# ---------------------------------------------------------------------------

ensure_compatible_client() {
  local source_version_num
  source_version_num=$(psql "$SOURCE_URL" -At -c "SHOW server_version_num;" 2>/dev/null || true)
  if [[ -z "$source_version_num" ]]; then
    echo "Warning: could not query source server_version_num. Proceeding anyway." >&2
    return
  fi
  # server_version_num is an integer like 170005 -> major 17
  local source_major=$(( source_version_num / 10000 ))

  local pg_dump_major
  pg_dump_major=$(pg_dump --version | grep -oE '[0-9]+' | head -1)

  if [[ -n "$pg_dump_major" && "$pg_dump_major" -ge "$source_major" ]]; then
    return
  fi

  echo "Source server is PostgreSQL $source_major, local pg_dump is $pg_dump_major. Looking for a compatible client..." >&2
  local candidates=(
    "/opt/homebrew/opt/postgresql@$source_major/bin"
    "/usr/local/opt/postgresql@$source_major/bin"
    "/opt/homebrew/opt/postgresql/bin"
    "/usr/local/opt/postgresql/bin"
  )
  for dir in "${candidates[@]}"; do
    if [[ -x "$dir/pg_dump" ]]; then
      local v
      v=$("$dir/pg_dump" --version | grep -oE '[0-9]+' | head -1)
      if [[ -n "$v" && "$v" -ge "$source_major" ]]; then
        echo "Found PostgreSQL $v client at $dir — using it." >&2
        export PATH="$dir:$PATH"
        return
      fi
    fi
  done

  cat >&2 <<EOF
Error: no pg_dump >= $source_major found.

Install a matching client and re-run:
  brew install postgresql@$source_major

Or pass an explicit path:
  PATH=/opt/homebrew/opt/postgresql@$source_major/bin:\$PATH ./scripts/copy-db-from-source.sh ...
EOF
  exit 4
}

ensure_compatible_client

# ---------------------------------------------------------------------------
# Summary + confirmation
# ---------------------------------------------------------------------------

echo "==========================================="
echo "  Copy DB (source -> target)"
echo "==========================================="
echo "Source       : $(echo "$SOURCE_URL" | mask)"
echo "Target       : $(echo "$TARGET_URL" | mask)"
echo "Include logs : $INCLUDE_LOGS"
echo "==========================================="
echo ""
echo "This will DROP everything in the target schema 'public'"
echo "and replace it with an exact copy of the source."
echo ""

if [[ "$SKIP_CONFIRM" -eq 0 ]]; then
  read -r -p "Continue? [y/N] " reply
  if [[ ! "$reply" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

DUMP_FILE=$(mktemp -t zacharie-db-dump.XXXXXX)
TOC_FILE=$(mktemp -t zacharie-db-toc.XXXXXX)
trap 'rm -f "$DUMP_FILE" "$TOC_FILE"' EXIT

EXCLUDE_OPTS=()
if [[ "$INCLUDE_LOGS" -eq 0 ]]; then
  EXCLUDE_OPTS+=(--exclude-table-data='public.Log')
  EXCLUDE_OPTS+=(--exclude-table-data='public.NotificationLog')
  EXCLUDE_OPTS+=(--exclude-table-data='public.ApiKeyLog')
fi

# Skip PostGIS / pgvector schemas — Clever Cloud installs these by default
# on its Postgres add-on, but Zacharie does not use them. Their extensions
# are filtered from the TOC further down too.
EXCLUDE_OPTS+=(
  --exclude-schema=tiger
  --exclude-schema=tiger_data
  --exclude-schema=topology
)

t0=$(date +%s)

echo ""
echo "[1/4] Dumping source ..."
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --no-comments \
  "${EXCLUDE_OPTS[@]}" \
  --file="$DUMP_FILE" \
  "$SOURCE_URL"
echo "       dump size: $(du -h "$DUMP_FILE" | cut -f1)"

echo "[2/4] Filtering unused extensions (postgis, pgvector) from TOC ..."
# Exclude :
#  - CREATE EXTENSION entries for postgis* and vector
#  - COMMENT ON EXTENSION entries for the same
#  - TABLE DATA entries for tables provided by these extensions (e.g. spatial_ref_sys)
pg_restore --list "$DUMP_FILE" \
  | grep -v -E 'EXTENSION - (postgis|postgis_raster|postgis_tiger_geocoder|postgis_topology|vector)( |$)' \
  | grep -v -E 'COMMENT - EXTENSION (postgis|postgis_raster|postgis_tiger_geocoder|postgis_topology|vector)( |$)' \
  | grep -v -E 'TABLE DATA public (spatial_ref_sys|geometry_columns|geography_columns|raster_columns|raster_overviews)( |$)' \
  > "$TOC_FILE"

echo "[3/4] Resetting target schema 'public' ..."
psql "$TARGET_URL" \
  -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

echo "[4/4] Restoring into target (parallel jobs = 4) ..."
pg_restore \
  --dbname="$TARGET_URL" \
  --no-owner \
  --no-acl \
  --use-list="$TOC_FILE" \
  --jobs=4 \
  "$DUMP_FILE"

t1=$(date +%s)
echo ""
echo "Done in $((t1 - t0))s. Target is now a copy of source."
echo ""
echo "Next steps:"
echo "  1. Run 'npx prisma migrate deploy' if your migrations directory has"
echo "     migrations more recent than what was in the source DB."
echo "  2. Run 'npx prisma generate' to regenerate the client if needed."
