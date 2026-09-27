#!/bin/sh
# scripts/backup.sh — backup diário do MySQL em produção (RNF_06, §6 do plano).
#
# Gera um dump .sql.gz do banco em ./backups (ou $BACKUP_DIR) e mantém apenas
# os últimos 7 dias. Agende via cron no host, por exemplo:
#
#   0 2 * * * /caminho/para/Conecta_Bem/scripts/backup.sh >> /var/log/conectabem-backup.log 2>&1
#
# O acompanhamento diário dos backups (verificação do log e teste de restauração)
# é responsabilidade operacional do designado pela instituição — PENDENTE de
# definição do stakeholder (ver docs/decisoes.md, Sprint 5).
set -eu

DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Carrega as variáveis do .env de produção, se existir.
if [ -f "$DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$DIR/.env"
  set +a
fi

DB_NAME="${DB_NAME:-conectabem}"
DB_USER="${DB_USER:-conectabem}"
BACKUP_DIR="${BACKUP_DIR:-$DIR/backups}"
DATA="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

echo "[backup] $(date -Iseconds) iniciando dump de $DB_NAME..."
docker compose -f "$DIR/docker-compose.prod.yml" exec -T db \
  mysqldump --single-transaction -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
  | gzip > "$BACKUP_DIR/conectabem_${DATA}.sql.gz"

echo "[backup] gravado em $BACKUP_DIR/conectabem_${DATA}.sql.gz"

# Retenção: apaga dumps com mais de 7 dias.
find "$BACKUP_DIR" -name 'conectabem_*.sql.gz' -mtime +7 -delete
echo "[backup] concluído; retenção aplicada (7 dias)."
