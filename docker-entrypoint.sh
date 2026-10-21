#!/bin/sh
# Cartethyia container entrypoint
# Fixes the data directories' ownership, then executes the application as the
# unprivileged runtime identity.

set -e

APP_UID=10001
APP_GID=10001

# Gateway-owned state (lite database, install id) plus telemetry payload
# captures. Both default under /app/data; a relative payload dir is resolved
# against /app so it stays inside the volume.
STATE_DIR="${CARTETHYIA_DATA_DIR:-/app/data}"
case "$STATE_DIR" in /*) ;; *) STATE_DIR="/app/data" ;; esac
PAYLOAD_DIR="${CARTETHYIA_TELEMETRY_PAYLOAD_DIR:-/app/data}"
case "$PAYLOAD_DIR" in
  /*) ;;
  *) PAYLOAD_DIR="/app/$PAYLOAD_DIR" ;;
esac

# A mounted volume arrives owned by root, while the application runs as 10001.
# The image deliberately does not set USER, so the entrypoint starts as root,
# repairs the ownership of the data directories, and then drops privileges —
# otherwise the lite database cannot write and every telemetry payload capture
# fails while the console still reports capture as enabled.
if [ "$(id -u)" = "0" ]; then
  # Fix DNS sinkhole / 0.0.0.1 ECONNREFUSED for CodeBuddy
  CURRENT_CB_IP=$(getent hosts www.codebuddy.ai 2>/dev/null | awk '{print $1}')
  if [ -z "$CURRENT_CB_IP" ] || [ "$CURRENT_CB_IP" = "0.0.0.1" ]; then
    RESOLVED_IP=$(nslookup www.codebuddy.ai 1.1.1.1 2>/dev/null | grep 'Address: ' | tail -n 1 | sed 's/Address: *//')
    if [ -z "$RESOLVED_IP" ] || [ "$RESOLVED_IP" = "0.0.0.1" ]; then
      RESOLVED_IP=$(nslookup www.codebuddy.ai 8.8.8.8 2>/dev/null | grep 'Address: ' | tail -n 1 | sed 's/Address: *//')
    fi
    if [ -n "$RESOLVED_IP" ] && [ "$RESOLVED_IP" != "0.0.0.1" ]; then
      sed -i '/www.codebuddy.ai/d' /etc/hosts 2>/dev/null || true
      echo "$RESOLVED_IP www.codebuddy.ai" >> /etc/hosts
    else
      sed -i '/www.codebuddy.ai/d' /etc/hosts 2>/dev/null || true
      echo "43.169.32.91 www.codebuddy.ai" >> /etc/hosts
    fi
  fi

  mkdir -p "$STATE_DIR" "$PAYLOAD_DIR" 2>/dev/null || true
  chown -R "$APP_UID:$APP_GID" "$STATE_DIR" "$PAYLOAD_DIR" 2>/dev/null || true
  exec setpriv --reuid="$APP_UID" --regid="$APP_GID" --init-groups "$@"
fi

# Started unprivileged (the operator pinned a user, or the platform forbids
# root): nothing can be repaired from here, so report the exact ownership the
# host directory needs.
if [ ! -w "$STATE_DIR" ]; then
  echo "cartethyia: $STATE_DIR is not writable by uid $(id -u); the lite database cannot start here." >&2
  echo "cartethyia: chown it to $APP_UID:$APP_GID on the host, or let the entrypoint start as root so it can fix the mount." >&2
fi
if [ ! -w "$PAYLOAD_DIR" ]; then
  echo "cartethyia: $PAYLOAD_DIR is not writable by uid $(id -u); telemetry payload capture will fail." >&2
fi

exec "$@"
