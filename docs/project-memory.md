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

### Caption char cap & font size
- `computeFontSize` clamps output to `[MIN_FONT_SIZE=16, MAX_FONT_SIZE=40]`. The upper cap prevents captions from ballooning on 4K inputs (the backend downscales to 1920 wide, but the helper is the single source of truth and protects against future changes).
- `computeMaxChars(barW, fontSize)` derives a width-aware char cap from the caption bar width and chosen font size, using `CHAR_WIDTH_RATIO=0.55` (conservative average proportional glyph width as a fraction of fontSize). Output is clamped to `[20, 45]`.
- The hardcoded 45-char cap that used to live in `backend/src/services/video/captions.ts` was a static heuristic: it was overly conservative on wide videos (forcing too many line breaks) and could overflow on narrow videos (text extending past the frame). The width-aware cap fixes both cases.
- `groupTokensIntoSegments` now takes an explicit `maxChars` parameter. SRT export (`tts/srt.ts`) keeps the default of 45 — SRT line length is a display convention, not pixel-based, and players wrap automatically.


## Frontend State Management

Four feature-scoped Zustand stores live in `frontend/src/stores/`. One store per domain — not one per component, not slices of one giant store. Server state stays in TanStack Query; transient UI state stays in `useUiStore`; workflow state for the open project stays in `useStudioStore`; project library state (with persistence) lives in `useProjectsStore`; the active project pointer (also persisted) lives in `useActiveProjectStore`.

| Store | Persisted? | localStorage key | What it owns |
|---|---|---|---|
| `useActiveProjectStore` | yes (persist) | `voicepost-active-project` (v1) | `activeProjectId`, `activeProjectName` |
| `useProjectsStore` | yes (persist) | `voicepost-projects` (v1) | `projects: ProjectData[]`, `lastSelection` + CRUD actions |
| `useStudioStore` | no (in-memory) | — | `audioUrl`, `srtUrl`, `videoUrl`, `currentStep`, `speed`, `overlayY`, `lastGeneratedScript`, `projectNotFound` for the open project |
| `useUiStore` | no (in-memory) | — | `drawerOpen`, `nameModalOpen`, `projectsRefreshKey` |

The `useEffectiveAudioUrl(currentScript)` and `useEffectiveVideoUrl(currentScript)` hooks in `studioStore.ts` return `null` when the form's current script diverges from `lastGeneratedScript` — this is a pure derived selector that replaces a previous `useEffect`-based stale-URL clearing pattern.

The previous `lib/storage.ts` module-level helpers (`getProjects`, `saveProject`, `deleteProject`, `isProjectNameUnique`, `getLastSelection`, `saveLastSelection`, `getLastProjectId`, `setLastProjectId`) were deleted in favor of `useProjectsStore` and `useActiveProjectStore` actions. The old localStorage keys (`voicepost-projects`, `voicepost-last-id`, `voicepost-last-selection`) were abandoned on a clean cutover; existing users' local data is orphaned. Future schema changes will use `persist`'s `version` + `migrate` in the same store.

## Known Tech Debt

- `backend/src/lib/http/errorHandler.ts` exports error classes (Unauthorized, Forbidden, BadSignature, Conflict, etc.) that are not currently used by any route
- `backend/src/__tests__/globalSetup.ts` imports `@src/db/client` which doesn't exist; the test file's `try/catch` swallows the import error and the suite still passes, but `tsc --noEmit` in the backend reports the missing module. Pre-existing on `main`.
- `useStudioStore` currently stores `lastGeneratedScript` to support the URL-staleness derivation. If we add more "regenerate-on-change" workflows (e.g., regenerate video when overlay changes), promote that comparison into a `useEffectiveMedia(script, overlay)` selector family.
