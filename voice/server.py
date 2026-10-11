"""Barfly's voice: Chatterbox-Turbo behind the two OpenAI-style routes the Barfly page calls.

A voice is any audio file dropped into the `voices` folder next to this file. About ten seconds
of one person talking, no music, is what the model wants. The file name is the voice's name.
"""

import io
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import torch
import torchaudio as ta
from chatterbox.tts_turbo import ChatterboxTurboTTS
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

VOICES = Path(__file__).parent / "voices"
AUDIO = {".wav", ".mp3", ".flac", ".m4a", ".ogg"}

state = {}
lock = threading.Lock()  # one line at a time; the GPU is shared with whatever else is running


def voices() -> dict[str, Path]:
    return {p.stem: p for p in sorted(VOICES.iterdir()) if p.suffix.lower() in AUDIO}


@asynccontextmanager
async def lifespan(_: FastAPI):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    state["model"] = ChatterboxTurboTTS.from_pretrained(device=device)
    print(f"Chatterbox-Turbo ready on {device}. Voices: {', '.join(voices()) or 'none yet'}")
    yield


app = FastAPI(lifespan=lifespan)


class Speech(BaseModel):
    input: str
    voice: str = ""
    model: str = ""
    response_format: str = "wav"
    speed: float = 1.0


@app.get("/v1/models")
def models():
    return {"data": [{"id": "chatterbox-turbo"}]}


@app.get("/v1/audio/voices")
def list_voices():
    return {"voices": list(voices())}


@app.post("/v1/audio/speech")
def speech(req: Speech):
    found = voices()
    if req.voice not in found:
        raise HTTPException(404, f"no voice named {req.voice!r}; have: {', '.join(found) or 'none'}")
    model = state["model"]
    with lock:
        wav = model.generate(req.input, audio_prompt_path=str(found[req.voice]))
    wav = wav.detach().cpu()
    # Slower also means lower, like a tape running down, which suits a drunk fly.
    # Speed is snapped to steps of 0.05 so the resampler stays cheap.
    speed = min(1.2, max(0.6, round(req.speed * 20) / 20))
    if speed != 1.0:
        wav = ta.functional.resample(wav, orig_freq=round(model.sr * speed), new_freq=model.sr)
    out = io.BytesIO()
    ta.save(out, wav, model.sr, format="wav", encoding="PCM_S", bits_per_sample=16)
    return Response(out.getvalue(), media_type="audio/wav")
