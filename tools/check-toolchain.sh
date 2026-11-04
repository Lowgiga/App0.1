#!/usr/bin/env bash
# Verify the toolchain declared by app/package.json and app/README.md.
# Usage: tools/check-toolchain.sh [--android]
# Exit code = number of failed checks (0 = everything required is present).
set -uo pipefail

failures=0
ok()   { printf '[OK]   %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1"; failures=$((failures + 1)); }

# Node.js: engines "^22.18.0 || ^24.0.0"
if command -v node >/dev/null 2>&1; then
  node_version=$(node -p 'process.versions.node')
  IFS=. read -r node_major node_minor _ <<<"$node_version"
  if { [ "$node_major" -eq 22 ] && [ "$node_minor" -ge 18 ]; } || [ "$node_major" -eq 24 ]; then
    ok "Node.js $node_version erfuellt ^22.18.0 || ^24.0.0"
  else
    fail "Node.js $node_version erfuellt ^22.18.0 || ^24.0.0 nicht"
  fi
else
  fail "Node.js fehlt"
fi

if [ "${1:-}" = "--android" ]; then
  # JDK 21 with compiler (Gradle needs a full JDK, not only a JRE).
  if command -v javac >/dev/null 2>&1; then
    # JAVA_TOOL_OPTIONS makes the JVM print an extra "Picked up ..." line; keep only the version line.
    javac_line=$(javac -version 2>&1 | grep -E '^javac [0-9]' | head -n 1)
    javac_major=$(printf '%s' "$javac_line" | sed -E 's/^javac ([0-9]+).*/\1/')
    if [ "$javac_major" = "21" ]; then ok "${javac_line} (JDK 21)"; else fail "javac-Version '${javac_line:-unbekannt}' statt 21"; fi
  else
    fail "javac fehlt: vollstaendiges JDK 21 erforderlich"
  fi
  sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  if [ -z "$sdk" ]; then
    fail "ANDROID_HOME bzw. ANDROID_SDK_ROOT nicht gesetzt"
  else
    if [ -d "$sdk/platforms/android-36" ]; then ok "Android SDK Platform 36"; else fail "Android SDK Platform 36 fehlt in $sdk"; fi
    if [ -d "$sdk/build-tools/35.0.0" ]; then ok "Android Build-Tools 35.0.0"; else fail "Android Build-Tools 35.0.0 fehlen in $sdk"; fi
  fi
fi

if [ "$failures" -eq 0 ]; then echo "Toolchain vollstaendig."; else echo "$failures Pruefung(en) fehlgeschlagen."; fi
exit "$failures"
