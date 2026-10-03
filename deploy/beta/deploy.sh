#!/usr/bin/env sh
set -eu

umask 077
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
RUNTIME_DIR="${ROOT_DIR}/runtime"
COMPOSE_FILE="${ROOT_DIR}/compose.beta.yml"
CONF_FILE="${RUNTIME_DIR}/deployment.conf"
ENV_FILE="${RUNTIME_DIR}/beta.env"
MIGRATION_ENV_FILE="${RUNTIME_DIR}/migration.env"
LOCK_FILE="${RUNTIME_DIR}/deploy.lock"
REGION="${AWS_REGION:-ap-south-1}"
[ "$ROOT_DIR" = /opt/sapienworx-beta ] || { echo "Beta must use its separate runtime directory." >&2; exit 1; }
: "${AWS_CONFIG_FILE:=${RUNTIME_DIR}/aws-config}"
: "${AWS_PROFILE:=beta}"
export AWS_CONFIG_FILE AWS_PROFILE
[ -f "$AWS_CONFIG_FILE" ] || { echo "Beta role profile is missing." >&2; exit 1; }
caller_arn="$(aws sts get-caller-identity --query Arn --output text)"
case "$caller_arn" in
  arn:aws:sts::*:assumed-role/sapienworx-beta-application/*) ;;
  *) echo "Deployment must assume the beta runtime role." >&2; exit 1 ;;
esac
for subnet in 172.29.0.0/24 172.30.0.0/24; do
  iptables -C DOCKER-USER -s "$subnet" -d 169.254.169.254/32 -j DROP || {
    echo "Beta metadata isolation must be installed before deployment." >&2; exit 1;
  }
done
test -s "$RUNTIME_DIR/aws-credentials/current.json"
test -f "$RUNTIME_DIR/aws-sdk-config"
PARAMETER_ROOT="/sapienworx/beta"
IMAGE_TAG="${1:-}"

case "$IMAGE_TAG" in
  *[!0-9a-f]*|'') echo "Release must be a full lowercase Git SHA." >&2; exit 2 ;;
esac
[ "${#IMAGE_TAG}" -eq 40 ] || { echo "Release must be exactly 40 hexadecimal characters." >&2; exit 2; }

mkdir -p "$RUNTIME_DIR" "$RUNTIME_DIR/caddy-data" "$RUNTIME_DIR/caddy-config"
touch "$LOCK_FILE"

if ! command -v flock >/dev/null 2>&1; then
  echo "flock is required for serialized deployments." >&2
  exit 1
fi

exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Another deployment is already running." >&2; exit 1; }

parameters="$(aws ssm get-parameters \
  --region "$REGION" \
  --with-decryption \
  --names \
    "$PARAMETER_ROOT/DATABASE_URL" \
    "$PARAMETER_ROOT/INTELLIGENCE_DATABASE_URL" \
    "$PARAMETER_ROOT/MIGRATION_DATABASE_URL" \
    "$PARAMETER_ROOT/JWT_SECRET" \
    "$PARAMETER_ROOT/AUTH_OTP_HMAC_SECRET" \
    "$PARAMETER_ROOT/S3_BUCKET" \
    "$PARAMETER_ROOT/RDS_ENDPOINT" \
  --output json)"

missing="$(printf '%s' "$parameters" | jq -r '.InvalidParameters[]?' | head -n 1)"
[ -z "$missing" ] || { echo "A required SSM parameter is missing." >&2; exit 1; }

parameter_value() {
  name="$1"
  printf '%s' "$parameters" | jq -er --arg name "$name" '.Parameters[] | select(.Name == $name) | .Value'
}

database_url="$(parameter_value "$PARAMETER_ROOT/DATABASE_URL")"
intelligence_database_url="$(parameter_value "$PARAMETER_ROOT/INTELLIGENCE_DATABASE_URL")"
migration_database_url="$(parameter_value "$PARAMETER_ROOT/MIGRATION_DATABASE_URL")"
jwt_secret="$(parameter_value "$PARAMETER_ROOT/JWT_SECRET")"
otp_secret="$(parameter_value "$PARAMETER_ROOT/AUTH_OTP_HMAC_SECRET")"
s3_bucket="$(parameter_value "$PARAMETER_ROOT/S3_BUCKET")"

for value in "$database_url" "$intelligence_database_url" "$migration_database_url" "$jwt_secret" "$otp_secret" "$s3_bucket"; do
  case "$value" in
    *REPLACE_OUTSIDE_TERRAFORM*|*REPLACE_WITH*) echo "An SSM placeholder has not been replaced." >&2; exit 1 ;;
  esac
  [ "$(printf '%s' "$value" | wc -l | tr -d ' ')" -eq 0 ] || {
    echo "Runtime parameters must not contain newlines." >&2
    exit 1
  }
done
[ "${#jwt_secret}" -ge 32 ] || { echo "JWT_SECRET is shorter than 32 bytes." >&2; exit 1; }
[ "${#otp_secret}" -ge 32 ] || { echo "AUTH_OTP_HMAC_SECRET is shorter than 32 bytes." >&2; exit 1; }
[ "$jwt_secret" != "$otp_secret" ] || { echo "The JWT and OTP secrets must be different." >&2; exit 1; }
case "$database_url" in
  *sslmode=require*|*sslmode=verify-ca*|*sslmode=verify-full*) ;;
  *) echo "DATABASE_URL must require PostgreSQL TLS." >&2; exit 1 ;;
esac
case "$intelligence_database_url" in
  *sslmode=require*|*sslmode=verify-ca*|*sslmode=verify-full*) ;;
  *) echo "INTELLIGENCE_DATABASE_URL must require PostgreSQL TLS." >&2; exit 1 ;;
esac
case "$migration_database_url" in
  *sslmode=require*|*sslmode=verify-ca*|*sslmode=verify-full*) ;;
  *) echo "MIGRATION_DATABASE_URL must require PostgreSQL TLS." >&2; exit 1 ;;
esac
[ "$database_url" != "$migration_database_url" ] && [ "$database_url" != "$intelligence_database_url" ] && [ "$migration_database_url" != "$intelligence_database_url" ] || {
  echo "Application, Intelligence and migration database URLs must use separate credentials." >&2
  exit 1
}

printf '%s' "$parameters" | python3 "${ROOT_DIR}/validate-runtime.py"

account_id="$(aws sts get-caller-identity --query Account --output text)"
registry="${account_id}.dkr.ecr.${REGION}.amazonaws.com"

tmp_env="$(mktemp "${RUNTIME_DIR}/beta.env.XXXXXX")"
tmp_migration_env="$(mktemp "${RUNTIME_DIR}/migration.env.XXXXXX")"
trap 'rm -f "$tmp_env" "$tmp_migration_env"' EXIT INT TERM
{
  printf 'ECR_REGISTRY=%s\n' "$registry"
  printf 'IMAGE_TAG=%s\n' "$IMAGE_TAG"
  printf 'AWS_REGION=%s\n' "$REGION"
  printf 'S3_BUCKET=%s\n' "$s3_bucket"
  printf 'DATABASE_URL=%s\n' "$database_url"
  printf 'INTELLIGENCE_DATABASE_URL=%s\n' "$intelligence_database_url"
  printf 'JWT_SECRET=%s\n' "$jwt_secret"
  printf 'AUTH_OTP_HMAC_SECRET=%s\n' "$otp_secret"
} >"$tmp_env"
chmod 0600 "$tmp_env"
printf 'DATABASE_URL=%s\n' "$migration_database_url" >"$tmp_migration_env"
chmod 0600 "$tmp_migration_env"
mv "$tmp_env" "$ENV_FILE"
mv "$tmp_migration_env" "$MIGRATION_ENV_FILE"
trap - EXIT INT TERM

if [ -f "$CONF_FILE" ]; then
  set -a
  . "$CONF_FILE"
  set +a
fi
export ECR_REGISTRY="$registry" IMAGE_TAG AWS_REGION="$REGION" S3_BUCKET="$s3_bucket"

docker_config_dir="$(mktemp -d "${RUNTIME_DIR}/docker-config.XXXXXX")"
chmod 0700 "$docker_config_dir"
cleanup_registry_auth() {
  docker logout "$registry" >/dev/null 2>&1 || true
  rm -rf -- "$docker_config_dir"
}
trap cleanup_registry_auth EXIT INT TERM
export DOCKER_CONFIG="$docker_config_dir"

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$registry" >/dev/null

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull backend frontend intelligence
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile migration pull migration

cleanup_registry_auth
trap - EXIT INT TERM
unset DOCKER_CONFIG

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile migration run --rm migration
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans backend frontend intelligence

# Shared Caddy is managed separately. Never replace the public mascot edge here.

"${ROOT_DIR}/health-check.sh"
printf '%s\n' "$IMAGE_TAG" >"${RUNTIME_DIR}/deployed-sha"
chmod 0600 "${RUNTIME_DIR}/deployed-sha"
# Do not prune shared-host images; preserved production rollback images remain available.

echo "Deployment completed for ${IMAGE_TAG}."
