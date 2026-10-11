// Barfly. A whole fly brain on a stool: we put sugar on his tongue and bang the door; he does the rest.
import { BarScene } from "./bar.ts";
import { BrainClient } from "./brain/client.ts";
import { loadConfig, Mouth, speak } from "./chat.ts";
import { setUpSettings } from "./settings.ts";
import { TRACKED, type FrameResult, type ReadyInfo, type SensoryInput } from "./brain/protocol.ts";

const FRAME_MS = 1000 / 60;
/** Poisson drive to the sugar taste neurons while there is beer in the mug */
const SUGAR_HZ = 150;
/** Poisson drive to the looming detectors while the door is swinging open */
const LOOM_HZ = 150;
const LOOM_MS = 350;
/** seconds of full-extension drinking to empty a mug */
const MUG_SECONDS = 7;
/** made up: how much one whole mug adds to the buzz meter, and how many seconds it takes to wear off */
const BUZZ_PER_MUG = 0.3;
const BUZZ_FADE_S = 600;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const brain = new BrainClient();
const bar = new BarScene($<HTMLCanvasElement>("bar"));
let info: ReadyInfo;

let beer = 0;
let tab = 0;
let loomLeft = 0;
let door = 0;
let proboscis = 0;
let startle = 0;
let budget = 0;
let lastNow = performance.now();
let startedAt = 0;
let lastInput: SensoryInput = { lc10L: 0, lc10R: 0, loom: 0, sugar: 0 };
const hz = { sugar: 0, mouth: 0, loom: 0, escape: 0 };
let drinking = false;
let flinching = false;
let buzz = 0;
let buzzStage = 0;
const mouth = new Mouth(loadConfig());
let talking = false;
/** what his body did lately, newest first, for the language model */
const recent: string[] = [];

/** the buzz acts on his brain one way only: it strengthens every GABA connection, up to this much at full buzz */
const GABA_GAIN_AT_FULL_BUZZ = 1.7;
let gabaGain = 1;

function log(text: string): void {
  const s = Math.floor((performance.now() - startedAt) / 1000);
  const li = document.createElement("li");
  const stamp = document.createElement("span");
  stamp.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  li.append(stamp, text);
  $("log").prepend(li);
  recent.unshift(text);
  recent.length = Math.min(recent.length, 6);
  while ($("log").children.length > 12) $("log").lastElementChild!.remove();
}

function sendStep(): void {
  lastInput = { lc10L: 0, lc10R: 0, loom: loomLeft > 0 ? LOOM_HZ : 0, sugar: beer > 0 ? SUGAR_HZ : 0 };
  brain.step(FRAME_MS, lastInput);
}

function onFrame(frame: FrameResult): void {
  budget -= frame.frameMs;
  const counts: Record<string, number> = {};
  TRACKED.forEach((k, i) => (counts[k] = frame.counts[i]));
  const perSec = 1000 / frame.frameMs;
  const g = info.groups;

  // what we did to him
  hz.sugar = ((counts.sugar_GRN_L + counts.sugar_GRN_R) * perSec) / (g.sugar_GRN_L.length + g.sugar_GRN_R.length);
  hz.loom =
    ((counts.LPLC2_L + counts.LPLC2_R + counts.LC4_L + counts.LC4_R) * perSec) /
    (g.LPLC2_L.length + g.LPLC2_R.length + g.LC4_L.length + g.LC4_R.length);

  // what he did about it (same readouts and scaling as dtecx/doodle-fly)
  const mouthNow = (counts.proboscis_MN * perSec) / g.proboscis_MN.length;
  const escapeNow = ((counts.DNp01_L + counts.DNp01_R) * perSec) / 2;
  hz.mouth += (mouthNow - hz.mouth) * 0.15;
  hz.escape += (escapeNow - hz.escape) * 0.3;
  proboscis += (Math.min(1, mouthNow / 14) - proboscis) * (1 - Math.exp(-frame.frameMs / 140));
  startle += (Math.min(1, escapeNow / 120) - startle) * (1 - Math.exp(-frame.frameMs / 90));

  // the only way beer leaves the mug is through his mouth
  const dt = frame.frameMs / 1000;
  if (beer > 0) {
    const sip = Math.min(beer, (proboscis * dt) / MUG_SECONDS);
    beer -= sip;
    buzz = Math.min(1, buzz + sip * BUZZ_PER_MUG);
    if (beer === 0) log(`finished beer ${tab}`);
  }
  buzz = Math.max(0, buzz - dt / BUZZ_FADE_S);
  const wantGain = 1 + (GABA_GAIN_AT_FULL_BUZZ - 1) * buzz;
  if (Math.abs(wantGain - gabaGain) > 0.02) {
    gabaGain = wantGain;
    brain.setChemistry(gabaGain);
  }
  const stage = buzz > 0.7 ? 2 : buzz > 0.3 ? 1 : 0;
  if (stage > buzzStage) log(stage === 2 ? "sloppy" : "getting buzzed");
  buzzStage = stage;
  loomLeft = Math.max(0, loomLeft - frame.frameMs);

  if (!drinking && proboscis > 0.5) {
    drinking = true;
    log("mouth went out: drinking");
  } else if (drinking && proboscis < 0.2) {
    drinking = false;
    log("mouth pulled back");
  }
  if (!flinching && startle > 0.5) {
    flinching = true;
    log("flinched");
  } else if (flinching && startle < 0.15) flinching = false;

  if (budget >= FRAME_MS) sendStep();
}

function meter(id: string, value: number, full: number): void {
  $(`m-${id}`).style.width = `${Math.min(100, (value / full) * 100)}%`;
  $(`v-${id}`).textContent = `${value.toFixed(0)} /s`;
}

function tick(now: number): void {
  // queued first, so an error further down can never stop the loop
  requestAnimationFrame(tick);
  const realDt = Math.min(100, now - lastNow);
  lastNow = now;
  budget = Math.min(budget + realDt, FRAME_MS * 4);
  if (!brain.pending && budget >= FRAME_MS) sendStep();

  // the door swings open fast and drifts shut
  const doorTarget = loomLeft > 0 ? 1 : 0;
  door += (doorTarget - door) * (1 - Math.exp(-realDt / (doorTarget ? 60 : 900)));

  bar.render(realDt / 1000, { proboscis, startle, beer, door, tab, drunk: buzz, talking });
  meter("sugar", hz.sugar, 160);
  meter("mouth", hz.mouth, 40);
  meter("loom", hz.loom, 160);
  meter("escape", hz.escape, 300);
  $("m-buzz").style.width = `${Math.round(buzz * 100)}%`;
  $("v-buzz").textContent = `${Math.round(buzz * 100)}%`;
  $("v-gaba").textContent = `x${gabaGain.toFixed(2)}`;
}

function line(who: "you" | "him" | "oops", text: string): void {
  const li = document.createElement("li");
  li.className = who;
  li.textContent = text;
  $("chat").append(li);
  while ($("chat").children.length > 4) $("chat").firstElementChild!.remove();
  $("chat").scrollTop = $("chat").scrollHeight;
}

function setUpMouth(): void {
  void setUpSettings(mouth.cfg);

  $<HTMLFormElement>("say").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>("say-text");
    const text = input.value.trim();
    if (!text || input.disabled) return;
    if (!mouth.model) {
      line("oops", "He has no language model to speak with. Open Settings and pick one.");
      return;
    }
    input.value = "";
    input.disabled = true;
    line("you", text);
    try {
      const reply = await mouth.say(text, {
        tab,
        buzz,
        beer,
        drinking,
        recent,
        minutesAtBar: (performance.now() - startedAt) / 60000,
      });
      line("him", reply);
      speak(reply, buzz, mouth.cfg.voice, (on) => (talking = on)).catch((err) => line("oops", `No voice: ${(err as Error).message}.`));
    } catch (err) {
      line("oops", `He said nothing: ${(err as Error).message}.`);
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
}

async function boot(): Promise<void> {
  brain.onProgress = (stage, frac) => {
    $("loading-stage").textContent = stage;
    $("loading-bar").style.width = `${Math.round(frac * 100)}%`;
  };
  brain.onError = (msg) => {
    $("loading-stage").textContent = `Something broke: ${msg}`;
  };
  brain.onFrame = onFrame;
  info = await brain.init(new URL(import.meta.env.BASE_URL, location.href).href);

  const sugarN = info.groups.sugar_GRN_L.length + info.groups.sugar_GRN_R.length;
  const loomN = info.groups.LPLC2_L.length + info.groups.LPLC2_R.length + info.groups.LC4_L.length + info.groups.LC4_R.length;
  $("fine").innerHTML =
    `Real wiring: ${info.neurons.toLocaleString()} neurons and ${info.connections.toLocaleString()} connections from the FlyWire v783 female fly brain, ` +
    `run with the Shiu et al. 2024 model. Bolted on: the beer is a ${SUGAR_HZ}/s signal sent straight to ${sugarN} sugar taste neurons; ` +
    `the door is a ${LOOM_HZ}/s signal sent straight to ${loomN} looming detectors, not something he sees. ` +
    `Made up: the buzz meter. Alcohol is chemistry and this map is only wiring, so we count the beer that went through his own mouth. ` +
    `The buzz does one thing to his brain: it strengthens every connection made by his ${info.gabaNeurons.toLocaleString()} GABA neurons, up to ${GABA_GAIN_AT_FULL_BUZZ} times. ` +
    `That is a cartoon of what alcohol does. What follows from it, the slower drinking and the duller flinch, is his wiring, not us. ` +
    `The sagging wings, lids and sway are animation tied to the same meter. ` +
    `His big eyes are a costume worn over his real compound eyes; the red in them is what is left of the real ones. ` +
    `The mug, the smokes, the stool and the bar are set dressing. ` +
    `His words come from the language model picked in Settings, which is told what his body just did; his voice is your browser's or a local voice server's. Neither one touches his brain. ` +
    `Brain engine and 3D fly from <a href="https://github.com/dtecx/doodle-fly">dtecx/doodle-fly</a> (MIT). ` +
    `FlyWire data: CC BY-NC 4.0, Dorkenwald et al. and Schlegel et al., Nature 2024.`;

  $("pour").addEventListener("click", () => {
    if (beer > 0.02) return;
    beer = 1;
    tab++;
    $("tab").textContent = String(tab);
    $("tab-unit").textContent = tab === 1 ? "beer" : "beers";
    log(`poured beer ${tab}`);
  });
  $("door").addEventListener("click", () => {
    loomLeft = LOOM_MS;
    log("door banged open");
  });

  setUpMouth();

  $("loading").hidden = true;
  $("panel").hidden = false;
  $("dock").hidden = false;
  startedAt = performance.now();
  lastNow = startedAt;
  if (import.meta.env.DEV) Object.assign(window, { __barfly: { hz, bar, state: () => ({ beer, tab, proboscis, startle, door, buzz }), setBuzz: (v: number) => (buzz = v) } });
  requestAnimationFrame(tick);
}

void boot();
