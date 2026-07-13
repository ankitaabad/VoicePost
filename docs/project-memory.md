# Project Memory

## Project Identity

- **Name**: VoicePost (previously referenced as "VoiceAds" and "FS_TEMPLATE" in legacy code)
- **Purpose**: Text-to-speech voice ad generation with video output
- **No auth system**: The app has no login/registration. PASETO auth was removed during cleanup.

## Architecture Decisions

### Why no Docker?
Local development uses native installs:
- **Postgres**: Run locally or via Docker (optional, not required)
- **Ollama**: Installed locally (`ollama serve`)
- **Kokoro**: Python venv in `kokoro-service/.venv` (`uvicorn app:app`)

`run.sh` starts all three services together for development.

### Caption timing model
The project originally used a pause-based caption timing model with per-voice calibrated profiles (`voiceProfiles.ts`). This was replaced with direct Kokoro token timestamps — the TTS API returns per-word `start`/`end` values that flow into `TtsMetadata` and are used directly by `captions.ts` and `srt.ts`.

The old `voiceProfiles.ts` and `wordWeights.ts` files were deleted. The calibration scripts (`calibrate-speech-rate.ts`, `generate-tts-fixtures.ts`) were also removed since they depended on the old model.

### Audio processing
`audio/processor.ts` applies BGM mixing and normalization. The `AUDIO_PADDING_SECONDS` is set to 0 — timestamps from Kokoro align directly with the output audio. The `TokenTiming` JSDoc in `shared/src/types.ts` previously documented a 1s fadeIn/fadeOut offset, but this is no longer accurate (the offset was removed).

### Video generation
`video/processor.ts` combines thumbnail + waveform + captions. `thumbnailAnalysis.ts` detects brightness to adjust caption border styles for readability.

### Shared layout computation
`shared/src/videoLayout.ts` provides `computeLayout()` used by both `video/captions.ts` and `video/processor.ts` to compute consistent video dimensions and positioning.


## Known Tech Debt

- `backend/src/lib/http/errorHandler.ts` exports error classes (Unauthorized, Forbidden, BadSignature, Conflict, etc.) that are not currently used by any route
