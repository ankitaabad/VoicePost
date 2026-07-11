import base64
from dataclasses import dataclass
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from kokoro import KPipeline
import soundfile as sf
import io
import numpy as np

app = FastAPI()

pipeline: KPipeline | None = None

VOICES = [
    {"id": "af_heart", "name": "American Female (Heart)", "gender": "female", "language": "en"},
    {"id": "af_alloy", "name": "American Female (Alloy)", "gender": "female", "language": "en"},
    {"id": "af_aoede", "name": "American Female (Aoede)", "gender": "female", "language": "en"},
    {"id": "af_bella", "name": "American Female (Bella)", "gender": "female", "language": "en"},
    {"id": "af_jessica", "name": "American Female (Jessica)", "gender": "female", "language": "en"},
    {"id": "af_kore", "name": "American Female (Kore)", "gender": "female", "language": "en"},
    {"id": "af_nicole", "name": "American Female (Nicole)", "gender": "female", "language": "en"},
    {"id": "af_nova", "name": "American Female (Nova)", "gender": "female", "language": "en"},
    {"id": "af_river", "name": "American Female (River)", "gender": "female", "language": "en"},
    {"id": "af_sarah", "name": "American Female (Sarah)", "gender": "female", "language": "en"},
    {"id": "af_skitter", "name": "American Female (Skitter)", "gender": "female", "language": "en"},
    {"id": "am_adam", "name": "American Male (Adam)", "gender": "male", "language": "en"},
    {"id": "am_echo", "name": "American Male (Echo)", "gender": "male", "language": "en"},
    {"id": "am_eric", "name": "American Male (Eric)", "gender": "male", "language": "en"},
    {"id": "am_fenrir", "name": "American Male (Fenrir)", "gender": "male", "language": "en"},
    {"id": "am_liam", "name": "American Male (Liam)", "gender": "male", "language": "en"},
    {"id": "am_michael", "name": "American Male (Michael)", "gender": "male", "language": "en"},
    {"id": "am_onyx", "name": "American Male (Onyx)", "gender": "male", "language": "en"},
    {"id": "am_puck", "name": "American Male (Puck)", "gender": "male", "language": "en"},
    {"id": "am_santa", "name": "American Male (Santa)", "gender": "male", "language": "en"},
]


class TTSRequest(BaseModel):
    text: str
    voice_id: str = "af_heart"
    speed: float = 1.0


@app.on_event("startup")
async def startup():
    global pipeline
    pipeline = KPipeline(lang_code="a")
    print("Kokoro pipeline loaded")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/voices")
async def get_voices():
    return {"voices": VOICES}


def _collect_token_timings(pipeline: KPipeline, text: str, voice: str, speed: float):
    """Run the pipeline and return (audio_chunks, tokens).

    Each chunk's tokens have per-token `start_ts` / `end_ts` in seconds
    RELATIVE to that chunk's audio. We add the cumulative chunk duration
    to make timestamps absolute across the full utterance.
    """
    audio_chunks: list = []
    all_tokens: list[dict] = []
    cursor = 0.0  # seconds, end of last emitted audio chunk

    for result in pipeline(text, voice=voice, speed=speed):
        if result.audio is None or len(result.audio) == 0:
            continue
        audio_chunks.append(result.audio)
        chunk_duration = len(result.audio) / 24000.0

        if result.tokens:
            for tok in result.tokens:
                text_val = tok.text or ""
                if not text_val:
                    # whitespace-only or empty tokens (e.g. space between
                    # words); skip — we don't need them for captions
                    continue
                start = getattr(tok, "start_ts", None)
                end = getattr(tok, "end_ts", None)
                if start is None or end is None:
                    continue
                all_tokens.append(
                    {
                        "text": text_val,
                        "start": round(cursor + float(start), 4),
                        "end": round(cursor + float(end), 4),
                    }
                )

        cursor += chunk_duration

    if not audio_chunks:
        return None, []
    combined = np.concatenate(audio_chunks)
    return combined, all_tokens


@app.post("/tts")
async def synthesize(req: TTSRequest):
    global pipeline
    if pipeline is None:
        raise HTTPException(503, "Pipeline not available")

    voice = req.voice_id
    if not any(v["id"] == voice for v in VOICES):
        raise HTTPException(400, f"Unknown voice: {voice}")

    combined, tokens = _collect_token_timings(pipeline, req.text, voice, req.speed)
    if combined is None:
        raise HTTPException(500, "No audio generated")

    duration = len(combined) / 24000.0

    buf = io.BytesIO()
    sf.write(buf, combined, 24000, format="WAV")
    audio_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return JSONResponse(
        content={
            "audio": audio_b64,
            "sample_rate": 24000,
            "duration": round(duration, 4),
            "voice_id": voice,
            "tokens": tokens,
        }
    )
