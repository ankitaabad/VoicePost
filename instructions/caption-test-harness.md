# Caption Timing: Extract, Test, Fix

## Problem
1. Caption logic is duplicated between `processor.ts` and `captionTiming.test.ts` — fixes in one don't reach the other
2. Only 2 of 4 voices tested; user's long script not tested
3. Captions drift ahead of audio on long scripts (e.g., "Host static websites..." sentence)

## Root Cause of Drift
The algorithm uses a **single global wps** (words-per-second) derived from total words / available time. Pause estimates are summed from a calibration table. Any error in pause estimation (TTS pausing longer/shorter than predicted) causes cumulative drift — later segments push ahead of the audio.

## Plan

### 1. Extract `captions.ts` — single source of truth
**File:** `backend/src/services/video/captions.ts`

Export from here:
- `getPauseType(punct)` 
- `splitIntoSentences(script)` — with ellipsis normalization
- `countInternalPauses(text, voiceProfile)`
- `buildCaptionSegments(script, duration, voiceProfile)` — the core algorithm
- `buildCaptionFilters(segments, outputHeight, outputWidth)` — ffmpeg drawtext strings
- `escapeDrawText(text)` — ffmpeg text escaping
- Type: `CaptionSegment`

Import `VoiceProfile` from `./voiceProfiles`.

### 2. Update `processor.ts` — import from captions.ts
- Remove all inlined caption functions
- Import `{ buildCaptionSegments, buildCaptionFilters }` from `./captions`
- Keep ffmpeg-specific helpers (`getDimensions`, `getAudioDuration`, `generateVideo`) local

### 3. Fix drift — trim segment ends
Add a `SEGMENT_END_MARGIN = 0.05` (seconds) to `buildCaptionSegments`. After computing each segment's `end`, subtract the margin. This creates tiny gaps between segments so they never outlast the audio.

This is applied per-segment (not cumulative), so it prevents drift without affecting accuracy for well-predicted segments.

### 4. Rewrite test — all 4 voices × diverse scripts
**File:** `backend/src/__tests__/captionTiming.test.ts`

Import from `@src/services/video/captions` (no more duplicated logic).

**Test matrix — 4 voices × 6 scripts:**

| Script | Why |
|---|---|
| User's Zipup script (with `—`, `...`, `Let's Encrypt`) | Real-world long script that drifts |
| Short 2-sentence | Baseline |
| Medium with commas | Comma pause accuracy |
| Semicolons + colons | Rare punctuation |
| Question-heavy | Question pause accuracy |
| 50+ word paragraph | Stress test for cumulative drift |

**For each combination:**
1. Generate TTS via Kokoro (`http://localhost:8888/tts`)
2. Get actual audio duration via ffprobe
3. Run `buildCaptionSegments()` 
4. Run `detectSilenceSegments()` (already in test file)
5. **Compare**: segment boundaries vs silence gaps
6. Assert: no segment end exceeds audio duration, no negative-duration segments
7. Report: drift per segment (predicted end vs nearest silence gap)

### 5. Run & calibrate
Run the test suite. For each voice, check:
- Which scripts have the most drift?
- Are pause estimates too high or too low per voice?
- Adjust voice profile pauses if needed

## Files Changed
| File | Action |
|---|---|
| `backend/src/services/video/captions.ts` | **Create** — extracted caption functions |
| `backend/src/services/video/processor.ts` | **Edit** — import from captions.ts, remove inlined functions |
| `backend/src/__tests__/captionTiming.test.ts` | **Rewrite** — import from captions.ts, 4-voice matrix |

## Verification
1. `pnpm test:changed` — all new tests pass
2. `pnpm format` — no new lint errors
3. Generate test video with user's script — confirm captions stay in sync
