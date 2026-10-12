// Barfly. A whole fly brain on a stool: we put sugar on his tongue and bang the door; he does the rest.
import { BarScene } from "./bar.ts";
import { BrainClient } from "./brain/client.ts";
import { loadConfig, Mouth, speak, speakStranger } from "./chat.ts";
import { setUpSettings } from "./settings.ts";
import { TRACKED, type FrameResult, type ReadyInfo, type SensoryInput } from "./brain/protocol.ts";
import { loadFlyAnatomy } from "./fly3d/anatomy.ts";

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
await loadFlyAnatomy().catch((error: unknown) => console.warn("Fly anatomy could not load; using the original procedural fly.", error));
const bar = new BarScene($<HTMLCanvasElement>("bar"));
let info: ReadyInfo;

let beer = 0;
let tab = 0;
let loomLeft = 0;
/** ms the door is held open for someone coming or going, without any looming signal */
let doorHold = 0;
let guestTalking = false;
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
  doorHold = Math.max(0, doorHold - realDt);
  const doorTarget = loomLeft > 0 || doorHold > 0 ? 1 : 0;
  door += (doorTarget - door) * (1 - Math.exp(-realDt / (doorTarget ? 60 : 900)));

  bar.render(realDt / 1000, { proboscis, startle, beer, door, tab, drunk: buzz, talking, guestTalking });
  meter("sugar", hz.sugar, 160);
  meter("mouth", hz.mouth, 40);
  meter("loom", hz.loom, 160);
  meter("escape", hz.escape, 300);
  $("m-buzz").style.width = `${Math.round(buzz * 100)}%`;
  $("v-buzz").textContent = `${Math.round(buzz * 100)}%`;
  $("v-gaba").textContent = `x${gabaGain.toFixed(2)}`;
}

function line(who: "you" | "him" | "guest" | "oops", text: string): void {
  const li = document.createElement("li");
  li.className = who;
  li.textContent = text;
  $("chat").append(li);
  while ($("chat").children.length > 4) $("chat").firstElementChild!.remove();
  $("chat").scrollTop = $("chat").scrollHeight;
}

/** true while a line is being fetched or answered, so the bartender and a stranger never talk over each other */
let busy = false;
/** seconds until the next stranger */
let strangerIn = 75;

const facts = () => ({ tab, buzz, beer, drinking, recent, minutesAtBar: (performance.now() - startedAt) / 60000 });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Now and then someone flies in, lands on the next stool, says one thing to him, hears the answer and leaves. */
async function strangerWalksIn(): Promise<void> {
  busy = true;
  const visitor = mouth.pickVisitor();
  try {
    // the same looming signal as the Bang the door button, so his flinch at the newcomer is his own
    loomLeft = LOOM_MS;
    doorHold = 3200;
    log(`door banged open: ${visitor.name} flew in`);
    // he thinks of his line on the way to the stool
    const [{ who, line: said }] = await Promise.all([mouth.walkIn(visitor), bar.guestArrive(visitor.tint)]);
    line("guest", `${who}: ${said}`);
    if (mouth.cfg.voice) {
      guestTalking = true;
      await speakStranger(said);
      guestTalking = false;
    }
    const reply = await mouth.say(said, facts(), `${who}, who has just flown in and sat down next to you,`);
    line("him", reply);
    speak(reply, buzz, mouth.cfg.voice, (on) => (talking = on)).catch(() => {});
    // long enough to hear the answer, then he goes
    await wait(2500 + reply.length * 70);
  } catch {
    // a stranger who cannot think of anything to say just leaves; no need to tell anyone
  } finally {
    guestTalking = false;
    doorHold = 3400;
    bar.guestLeave();
    log(`${visitor.name} left`);
    busy = false;
  }
}

function setUpMouth(): void {
  void setUpSettings(mouth.cfg);

  setInterval(() => {
    if (!mouth.cfg.visitors || !mouth.model || busy || document.hidden) return;
    strangerIn -= 1;
    if (strangerIn > 0) return;
    strangerIn = 90 + Math.random() * 120;
    void strangerWalksIn();
  }, 1000);

  $<HTMLFormElement>("say").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>("say-text");
    const text = input.value.trim();
    if (!text || busy) return;
    if (!mouth.model) {
      line("oops", "He has no language model to speak with. Open Settings and pick one.");
      return;
    }
    input.value = "";
    busy = true;
    input.disabled = true;
    line("you", text);
    try {
      const reply = await mouth.say(text, facts());
      line("him", reply);
      speak(reply, buzz, mouth.cfg.voice, (on) => (talking = on)).catch((err) => line("oops", `No voice: ${(err as Error).message}.`));
    } catch (err) {
      line("oops", `He said nothing: ${(err as Error).message}.`);
    } finally {
      busy = false;
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
  bar.onDrag = () => log("took a drag");
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
    `The mug, the smokes, the stool and the bar are set dressing, and he smokes on a timer, not because his brain asked for one. ` +
    `Strangers who fly in are the same fly model with no brain behind it, flown along a set path, and their lines are written by the same language model; the door that announces them is the same looming signal, so his flinch at them is his own. ` +
    `His words come from the language model picked in Settings, which is told what his body just did; his voice is your browser's or a local voice server's. Neither one touches his brain. ` +
    `Brain engine and animation rig from <a href="https://github.com/dtecx/doodle-fly">dtecx/doodle-fly</a> (MIT). ` +
    `Scan-derived body meshes from <a href="https://neuromechfly.org/">NeuroMechFly / FlyGym</a> (Apache-2.0), rescaled to fit this character; they do not change his brain or add a biomechanics simulation. ` +
    `The wood material is <a href="https://polyhaven.com/a/wood_table">Wood Table by Dimitrios Savva / Poly Haven</a> (CC0). ` +
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
  if (import.meta.env.DEV) Object.assign(window, { __barfly: { hz, bar, state: () => ({ beer, tab, proboscis, startle, door, buzz }), setBuzz: (v: number) => (buzz = v), stranger: () => strangerWalksIn() } });
  requestAnimationFrame(tick);
}

void boot();
