from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from kokoro import KPipeline
import soundfile as sf
import io
import uuid
import os

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


@app.post("/tts")
async def synthesize(req: TTSRequest):
    global pipeline
    if pipeline is None:
        raise HTTPException(503, "Pipeline not loaded")

    voice = req.voice_id
    if not any(v["id"] == voice for v in VOICES):
        raise HTTPException(400, f"Unknown voice: {voice}")

    audio_chunks = []
    for result in pipeline(req.text, voice=voice, speed=req.speed):
        audio_chunks.append(result.audio)

    if not audio_chunks:
        raise HTTPException(500, "No audio generated")

    combined = __import__("numpy").concatenate(audio_chunks)

    buf = io.BytesIO()
    sf.write(buf, combined, 24000, format="WAV")
    buf.seek(0)

    return Response(
        content=buf.read(),
        media_type="audio/wav",
        headers={"Content-Disposition": "inline"},
    )
