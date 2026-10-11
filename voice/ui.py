"""The page at /ui: Chatterbox-Turbo's own Gradio demo, rebuilt on top of this server's one loaded model.

Laid out after resemble-ai/chatterbox's gradio_tts_turbo_app.py (MIT), with two additions: pick a voice
that is already in the `voices` folder, and save an uploaded or recorded clip into it so the bar can use it.
"""

import random
import re
import shutil
from pathlib import Path
from typing import Callable

import gradio as gr
import numpy as np
import torch

# the sounds Chatterbox-Turbo performs when written into a line (from the upstream demo)
EVENT_TAGS = ["[clear throat]", "[sigh]", "[shush]", "[cough]", "[groan]", "[sniff]", "[gasp]", "[chuckle]", "[laugh]"]

INSERT_TAG_JS = """
(tag_val, current_text) => {
    const textarea = document.querySelector('#main_textbox textarea');
    if (!textarea) return current_text + " " + tag_val;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    let prefix = " ";
    let suffix = " ";
    if (start === 0) prefix = "";
    else if (current_text[start - 1] === ' ') prefix = "";
    if (end < current_text.length && current_text[end] === ' ') suffix = "";
    return current_text.slice(0, start) + prefix + tag_val + suffix + current_text.slice(end);
}
"""


def build(
    voices: Callable[[], dict[str, Path]],
    voices_dir: Path,
    synthesize: Callable[..., tuple[int, torch.Tensor]],
) -> gr.Blocks:
    def names() -> list[str]:
        return list(voices())

    def generate(text, voice, ref_clip, speed, temperature, seed, top_p, top_k, repetition_penalty, min_p, norm_loudness):
        # a clip dropped into the box wins over the saved voice, so you can audition before saving
        path = ref_clip or (str(voices()[voice]) if voice in voices() else None)
        if not path:
            raise gr.Error("Pick a saved voice or add a reference clip first.")
        if seed:
            torch.manual_seed(int(seed))
            torch.cuda.manual_seed_all(int(seed))
            random.seed(int(seed))
            np.random.seed(int(seed))
        sr, wav = synthesize(
            text,
            path,
            speed=speed,
            temperature=temperature,
            top_p=top_p,
            top_k=int(top_k),
            repetition_penalty=repetition_penalty,
            min_p=min_p,
            norm_loudness=norm_loudness,
        )
        return sr, wav.squeeze(0).numpy()

    def save_voice(ref_clip, name):
        if not ref_clip:
            raise gr.Error("Add a reference clip first.")
        clean = re.sub(r"[^a-z0-9_-]+", "-", (name or "").strip().lower()).strip("-")
        if not clean:
            raise gr.Error("Give the voice a name.")
        dest = voices_dir / f"{clean}{Path(ref_clip).suffix.lower() or '.wav'}"
        shutil.copyfile(ref_clip, dest)
        gr.Info(f'Saved as "{clean}". Reopen Settings in the bar to pick it.')
        return gr.update(choices=names(), value=clean)

    with gr.Blocks(title="Barfly's voice") as demo:
        gr.Markdown(
            "# Barfly's voice\n"
            "Chatterbox-Turbo, cloning from about ten seconds of one person talking. "
            "The buttons under the text box insert the sounds it can perform. It has no hiccup."
        )
        with gr.Row():
            with gr.Column():
                text = gr.Textbox(
                    value="Go heavy on rotting bananas. [cough] That is a growth market.",
                    label="Text to synthesize (about 300 characters at most)",
                    max_lines=5,
                    elem_id="main_textbox",
                )
                with gr.Row():
                    for tag in EVENT_TAGS:
                        btn = gr.Button(tag, size="sm", min_width=60)
                        btn.click(fn=None, inputs=[btn, text], outputs=text, js=INSERT_TAG_JS)

                voice = gr.Dropdown(choices=names(), value=(names() or [None])[0], label="Saved voice (the ones the bar can use)")
                ref = gr.Audio(sources=["upload", "microphone"], type="filepath", label="Or try a new reference clip")
                with gr.Row():
                    new_name = gr.Textbox(label="Save that clip as a voice named", placeholder="gravel", scale=3)
                    save_btn = gr.Button("Save voice", scale=1)
                run_btn = gr.Button("Generate", variant="primary")

            with gr.Column():
                audio_output = gr.Audio(label="Output audio")
                speed = gr.Slider(0.6, 1.2, step=0.05, value=1.0, label="Speed (the bar lowers this as he gets drunk; slower is also deeper)")
                with gr.Accordion("Advanced options", open=False):
                    seed = gr.Number(value=0, label="Random seed (0 for random)")
                    temperature = gr.Slider(0.05, 2.0, step=0.05, value=0.8, label="Temperature")
                    top_p = gr.Slider(0.0, 1.0, step=0.01, value=0.95, label="Top P")
                    top_k = gr.Slider(0, 1000, step=10, value=1000, label="Top K")
                    repetition_penalty = gr.Slider(1.0, 2.0, step=0.05, value=1.2, label="Repetition penalty")
                    min_p = gr.Slider(0.0, 1.0, step=0.01, value=0.0, label="Min P (0 to disable)")
                    norm_loudness = gr.Checkbox(value=True, label="Normalize loudness (-27 LUFS)")

        run_btn.click(
            fn=generate,
            inputs=[text, voice, ref, speed, temperature, seed, top_p, top_k, repetition_penalty, min_p, norm_loudness],
            outputs=audio_output,
        )
        save_btn.click(fn=save_voice, inputs=[ref, new_name], outputs=voice)
        demo.load(fn=lambda: gr.update(choices=names()), outputs=voice)

    return demo
