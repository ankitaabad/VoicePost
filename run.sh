#!/bin/bash
set -e

cleanup() {
  echo "Stopping services..."
  kill $OLLAMA_PID $KOKORO_PID $BACKEND_PID 2>/dev/null
  wait
}

trap cleanup EXIT INT TERM

cd "$(dirname "$0")"

echo "Starting Kokoro TTS..."
(cd kokoro-service && nohup .venv/bin/python \
  -m uvicorn app:app --host 0.0.0.0 --port 8888 > /tmp/kokoro.log 2>&1) &
KOKORO_PID=$!

echo "Starting Ollama..."
nohup ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!

echo "Starting backend..."
(cd backend && pnpm dev) &
BACKEND_PID=$!

echo ""
echo "All services started. Press Ctrl+C to stop."
echo ""
echo "Kokoro: http://localhost:8888/health"
echo "Ollama: http://localhost:11434/api/tags"
echo "Backend: http://localhost:8080/api/v1/tts/voices"

wait
