# VoicePost

VoicePost turns your text into studio-quality audio — without the studio. Write your own script or let AI write one, pick a voice from our natural-sounding library, and drop in background music to set the mood. The result is broadcast-ready audio, ready to share. Want a video instead? Add a thumbnail and we generate word-by-word captions automatically. 



## Features

- **Script Studio** — Write your own script or generate one from a rough idea using AI (hook → benefits → CTA structure)
- **Text-to-Speech** — 4 Kokoro neural voices (male/female)
- **Background Music** — Upload and mix BGM tracks with auto-looping, ducking, and fade effects
- **Audio Processing** — Professional mastering pipeline: high-pass, EQ, loudness normalization, limiter
- **Video Generation** — Thumbnail + animated waveform overlay + word-level captions

## How it works

A three-step workflow from script to share-ready audio and video.

### Step 1 — Script
Write your own script or let AI generate one from a rough idea (hook → benefits → CTA).

![Script editor with Write Script and Generate with AI tabs](backend/src/public/step1.png)

### Step 2 — Voice & Music
Pick a neural voice and pair it with a background track. Auto-ducking keeps the voice clear.

![Voice & Music selection](backend/src/public/step2.png)

### Step 3 — Generate
Get a mastered MP3 plus a captioned MP4 with animated waveform and word-level captions.

![Generate step with audio result and video ready](backend/src/public/step3.png)

### Final output

The rendered video combines thumbnail, waveform, and word-level captions:

<video src="backend/src/public/generated-video.mp4" controls width="100%"></video>



## Getting Started

### Prerequisites

- Node.js 18+, pnpm, Python 3.11+, Docker

### Setup

```bash
# Clone and install
git clone <repo-url> && cd voicepost
pnpm install

# Start infrastructure (Postgres, Ollama, Kokoro)
docker compose up -d

# Start Kokoro + Ollama + backend
./run.sh

# In a separate terminal — start frontend
pnpm dev:frontend
```

### Development

```bash
pnpm dev              # Start backend + frontend concurrently
pnpm format           # Lint & format with Biome
pnpm build            # Build all packages
```

### Backend

```bash
cd backend
pnpm dev              # Hono dev server on :8080
pnpm test             # Run tests
pnpm migrate:up       # Apply migrations
pnpm migrate:create <name>  # New migration
pnpm gen              # Regenerate Kysely types from DB
pnpm seed             # Clean DB tables
```

### Frontend

```bash
cd frontend
pnpm dev              # Vite dev server (proxies /api → :8080)
pnpm typecheck        # Type check
```


## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Mantine 9, React Query, Zustand, Vite |
| **Backend** | Hono, Kysely, PostgreSQL 17, PASETO auth |
| **TTS** | Kokoro TTS (Python FastAPI) — 20+ neural voices |
| **LLM** | Ollama (qwen3:1.7b) — AI script rewriting |
| **Video/Audio** | FFmpeg — waveform visualization, captions, BGM mixing, loudness normalization |
| **Infra** | Docker Compose, pnpm workspaces, Biome, Lefthook |


## Project Structure

```
├── backend/           Hono API (Kysely + Postgres, PASETO auth)
│   ├── src/routes/    API routes (auth, TTS, profile)
│   ├── src/services/  TTS (Kokoro), audio/video (FFmpeg), script (Ollama)
│   └── migrations/    PostgreSQL migrations
├── frontend/          React 19 + Mantine 9 SPA
│   ├── src/pages/     ScriptStudio, Login, Register, Profile, etc.
│   └── src/queries/   React Query hooks + Axios instance
├── shared/            @app/shared — ArkType validators + types
├── kokoro-service/    Python FastAPI TTS service (Kokoro KPipeline)
├── docker-compose.yaml
└── run.sh             Start Kokoro + Ollama + backend
```


