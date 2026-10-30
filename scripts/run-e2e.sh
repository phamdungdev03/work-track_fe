#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Never run scan tests against an already running service on the test ports.
python3 - <<'PYCHECK'
import socket
for port in (8011, 3011):
    with socket.socket() as listener:
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            listener.bind(('127.0.0.1', port))
        except OSError as exc:
            raise SystemExit(f'Test port {port} is already in use: {exc}')
PYCHECK
worktrack_dir=$(mktemp -d /tmp/worktrack-ui-e2e.XXXXXX)
worktrack_mysql_pid=''
worktrack_django_pid=''
worktrack_next_pid=''
cleanup() {
  for process_id in "$worktrack_next_pid" "$worktrack_django_pid"; do
    if [[ -n "$process_id" ]]; then kill "$process_id" 2>/dev/null || true; fi
  done
  if [[ -n "$worktrack_mysql_pid" ]]; then
    timeout 8s mysqladmin --no-defaults --socket="$worktrack_dir/mysql.sock" -uroot shutdown >/dev/null 2>&1 || true
    if kill -0 "$worktrack_mysql_pid" 2>/dev/null; then
      kill "$worktrack_mysql_pid" 2>/dev/null || true
      for attempt in $(seq 1 20); do
        kill -0 "$worktrack_mysql_pid" 2>/dev/null || break
        sleep .1
      done
      if kill -0 "$worktrack_mysql_pid" 2>/dev/null; then kill -KILL "$worktrack_mysql_pid" 2>/dev/null || true; fi
    fi
    wait "$worktrack_mysql_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT
mysqld --no-defaults --initialize-insecure --datadir="$worktrack_dir/data" --log-error="$worktrack_dir/mysql-init.log"
mysqld --no-defaults --datadir="$worktrack_dir/data" --socket="$worktrack_dir/mysql.sock" --pid-file="$worktrack_dir/mysql.pid" --skip-networking --mysqlx=OFF --innodb-buffer-pool-dump-at-shutdown=OFF --log-error="$worktrack_dir/mysql.log" &
worktrack_mysql_pid=$!
for attempt in $(seq 1 50); do
  mysqladmin --no-defaults --socket="$worktrack_dir/mysql.sock" -uroot ping >/dev/null 2>&1 && break
  sleep .2
done
mysql --no-defaults --socket="$worktrack_dir/mysql.sock" -uroot -e 'CREATE DATABASE worktrack_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'
mysql --no-defaults --socket="$worktrack_dir/mysql.sock" -uroot worktrack_test < database/attendance-schema.sql
mysql --no-defaults --socket="$worktrack_dir/mysql.sock" -uroot worktrack_test < database/attendance-seed.sql > /dev/null
DB_HOST="$worktrack_dir/mysql.sock" DB_PORT=3306 DB_NAME=worktrack_test DB_USER=root DB_PASSWORD='' DEMO_MODE=true work-track_be/.venv/bin/python work-track_be/manage.py migrate --noinput > /dev/null
DB_HOST="$worktrack_dir/mysql.sock" DB_PORT=3306 DB_NAME=worktrack_test DB_USER=root DB_PASSWORD='' DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost DEMO_MODE=true work-track_be/.venv/bin/python work-track_be/manage.py runserver 127.0.0.1:8011 --noreload > "$worktrack_dir/django.log" 2>&1 &
worktrack_django_pid=$!
cd work-track_fe
BACKEND_API_ORIGIN=http://127.0.0.1:8011 NEXT_DIST_DIR=.next-e2e npm run build > "$worktrack_dir/next-build.log" 2>&1
BACKEND_API_ORIGIN=http://127.0.0.1:8011 NEXT_DIST_DIR=.next-e2e npm run start -- --hostname 127.0.0.1 --port 3011 > "$worktrack_dir/next.log" 2>&1 &
worktrack_next_pid=$!
for attempt in $(seq 1 100); do
  curl -fsS http://127.0.0.1:3011/api/health/ > /dev/null 2>&1 && break
  sleep .25
done
kill -0 "$worktrack_mysql_pid"
kill -0 "$worktrack_django_pid"
kill -0 "$worktrack_next_pid"
curl -fsS http://127.0.0.1:3011/api/health/
npx playwright test --reporter=line "$@"
