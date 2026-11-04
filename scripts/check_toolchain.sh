#!/usr/bin/env bash
set -e

echo "========================================="
echo " LowQuantFlow Build Toolchain Checker "
echo "========================================="

# Check Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v)
    echo "[OK] Node.js version: $NODE_VER"
else
    echo "[FAIL] Node.js is not installed."
    exit 1
fi

# Check Java JDK
if command -v java >/dev/null 2>&1; then
    JAVA_VER=$(java -version 2>&1 | head -n 1)
    echo "[OK] Java runtime: $JAVA_VER"
else
    echo "[FAIL] Java runtime is not installed."
    exit 1
fi

if command -v javac >/dev/null 2>&1; then
    JAVAC_VER=$(javac -version 2>&1)
    echo "[OK] Java compiler (javac): $JAVAC_VER"
else
    echo "[WARN] javac command missing from PATH. Full JDK 21 required for Gradle builds."
fi

# Check Android SDK if present
if [ -n "$ANDROID_HOME" ] || [ -n "$ANDROID_SDK_ROOT" ]; then
    echo "[OK] Android SDK environment detected."
else
    echo "[INFO] Android SDK environment variables not set (required for APK builds)."
fi

echo "========================================="
echo " Toolchain check completed."
echo "========================================="
