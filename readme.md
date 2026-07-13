# VoicePost

AI-powered voice ad generation tool. Write a script, pick a voice, get a professionally mastered audio file with optional background music and video waveform visualization.

## How it works

**Step 1 — Write or generate your script.** Compose your own ad copy or let AI draft one for you.

<p align="center">
  <img src="backend/src/public/step1.png" alt="Script step" />
</p>

**Step 2 — Pick a voice and background music.** Choose from a library of natural-sounding voices and curated BGM tracks, then generate the audio.

<p align="center">
  <img src="backend/src/public/step2.png" alt="Voice and music step" />
</p>

**Step 3 — Generate the video.** Add a thumbnail, and VoicePost produces a captioned MP4 with word-by-word captions timed to the audio.

<p align="center">
  <img src="backend/src/public/step3.png" alt="Generate step" />
</p>

## Demo

<p align="center">
  <a href="https://youtu.be/aPalRWJQ-00"><img src="https://img.youtube.com/vi/aPalRWJQ-00/maxresdefault.jpg" alt="VoicePost demo video" /></a>
</p>

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org/) | >= 20 | Backend + frontend |
| [pnpm](https://pnpm.io/) | >= 10 | Workspace package manager |
| [Python](https://www.python.org/) | 3.12 | Kokoro TTS service |
| [uv](https://docs.astral.sh/uv/) | >= 0.5 | Python venv + dependency management |
| [ffmpeg](https://ffmpeg.org/) | >= 7 | Audio/video processing |
| [Ollama](https://ollama.com/) | >= 0.31 | Local LLM for script rewriting |

## Quick start

```bash
# 1. Clone and install
git clone <repo-url> VoicePost && cd VoicePost
pnpm install

# 2. Set up the Kokoro TTS venv
cd kokoro-service
uv venv --python 3.12
uv pip install -r requirements.txt
cd ..


# 5. Pull the Ollama model (for script rewriting)
ollama pull qwen3:1.7b

# 6. Start everything
./run.sh
```

This starts all services:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080/api/v1/tts/ |
| Kokoro TTS | http://localhost:8888 |
| Ollama | http://localhost:11434 |

Press `Ctrl+C` to stop all services.

## Development

```bash
# Start backend + frontend (without Kokoro/Ollama)
pnpm dev

# Format code
pnpm format

# Run tests
pnpm --filter backend test
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
```

## Environment variables

Backend reads from `backend/.env` (loaded via `dotenv-cli`):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `KOKORO_URL` | `http://localhost:8888` | Kokoro TTS service URL |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama LLM URL |
| `STORAGE_PATH` | `storage` | Path for generated audio/video files |

## Project structure

```
backend/          Hono API server (Kysely + Postgres)
frontend/         React 19 + Mantine 9 + Vite
shared/           ArkType validators + shared types
kokoro-service/   Python FastAPI TTS service (Kokoro)
run.sh            Starts Kokoro + Ollama + backend together
```
