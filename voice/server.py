"""Barfly's voice: Chatterbox-Turbo behind the two OpenAI-style routes the Barfly page calls,
plus a page at /ui for trying voices by hand.

A voice is any audio file in the `voices` folder next to this file. About ten seconds of one
person talking, no music, is what the model wants. The file name is the voice's name.
"""

import io
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import gradio as gr
import torch
import torchaudio as ta
from chatterbox.tts_turbo import ChatterboxTurboTTS
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel

import ui

VOICES = Path(__file__).parent / "voices"
AUDIO = {".wav", ".mp3", ".flac", ".m4a", ".ogg"}

state = {}
lock = threading.Lock()  # one line at a time; the GPU is shared with whatever else is running


def voices() -> dict[str, Path]:
    return {p.stem: p for p in sorted(VOICES.iterdir()) if p.suffix.lower() in AUDIO}


def synthesize(text: str, clip: str, speed: float = 1.0, **sampling) -> tuple[int, torch.Tensor]:
    """One line in the voice of `clip`. The single place the model is called, for the API and the page alike."""
    model = state["model"]
    print(f"saying: {text!r}", flush=True)  # so the terminal shows exactly what he was asked to say
    with lock:
        wav = model.generate(text, audio_prompt_path=clip, **sampling)
    wav = wav.detach().cpu()
    # Slower also means lower, like a tape running down, which suits a drunk fly.
    # Speed is snapped to steps of 0.05 so the resampler stays cheap.
    speed = min(1.2, max(0.6, round(speed * 20) / 20))
    if speed != 1.0:
        wav = ta.functional.resample(wav, orig_freq=round(model.sr * speed), new_freq=model.sr)
    return model.sr, wav


@asynccontextmanager
async def lifespan(_: FastAPI):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    state["model"] = ChatterboxTurboTTS.from_pretrained(device=device)
    print(f"Chatterbox-Turbo ready on {device}. Voices: {', '.join(voices()) or 'none yet'}")
    print("Try voices by hand at /ui on this server's address.")
    yield


app = FastAPI(lifespan=lifespan)


class Speech(BaseModel):
    input: str
    voice: str = ""
    model: str = ""
    response_format: str = "wav"
    speed: float = 1.0
    # Chatterbox-Turbo's own sampling settings. (It ignores exaggeration and cfg_weight.)
    temperature: float = 0.8
    top_p: float = 0.95
    repetition_penalty: float = 1.2


@app.get("/")
def home():
    return RedirectResponse("/ui")


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
    sr, wav = synthesize(
        req.input,
        str(found[req.voice]),
        speed=req.speed,
        temperature=req.temperature,
        top_p=req.top_p,
        repetition_penalty=req.repetition_penalty,
    )
    out = io.BytesIO()
    # 16-bit PCM plays everywhere; the default for a float tensor is 32-bit float, which some players turn into noise
    ta.save(out, wav, sr, format="wav", encoding="PCM_S", bits_per_sample=16)
    return Response(out.getvalue(), media_type="audio/wav")


app = gr.mount_gradio_app(app, ui.build(voices, VOICES, synthesize), path="/ui")
