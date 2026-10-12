// His mouth. A language model writes the lines; it is told what his brain and body just did.
// Nothing here touches the brain.
import Anthropic from "@anthropic-ai/sdk";

export interface BodyFacts {
  tab: number;
  /** 0..1 */
  buzz: number;
  /** 0..1 beer left in the mug */
  beer: number;
  drinking: boolean;
  /** newest first, e.g. "flinched", "door banged open" */
  recent: string[];
  minutesAtBar: number;
}

/** Everything goes through the dev server's proxy (see vite.config.ts), so the browser never needs CORS. */
export type ProviderId = "lm-local" | "lm-2" | "openai" | "anthropic" | "openrouter";

/** A second LM Studio on another machine, if .env.local names one (see .env.example) */
const SECOND = (import.meta.env.VITE_LM_STUDIO_2_LABEL as string | undefined) ?? "";

export const PROVIDERS: readonly { id: ProviderId; label: string; needsKey: boolean }[] = [
  ...(SECOND ? [{ id: "lm-2" as const, label: `LM Studio on ${SECOND}`, needsKey: false }] : []),
  { id: "lm-local", label: "LM Studio on this PC", needsKey: false },
  { id: "openai", label: "OpenAI", needsKey: true },
  { id: "anthropic", label: "Anthropic", needsKey: true },
  { id: "openrouter", label: "OpenRouter", needsKey: true },
];

export interface ModelInfo {
  id: string;
  /** LM Studio only: already in memory, so it answers without a load wait */
  loaded: boolean;
}

export interface MouthConfig {
  provider: ProviderId;
  /** the model picked for each provider */
  models: Partial<Record<ProviderId, string>>;
  /** API keys, kept in this browser's storage and nowhere else */
  keys: Partial<Record<ProviderId, string>>;
  persona: string;
  /** "" off, "browser", or a voice name on the local voice server */
  voice: string;
  /** whether strangers wander in now and then and say something to him */
  visitors: boolean;
}

// First draft of who he is. It is meant to be rewritten, in Settings.
export const DEFAULT_PERSONA = `You are Barfly, a fruit fly who lives on the stool at the end of a dive bar that is named after you.
You are the one simulated fly nobody experiments on. Every other fly brain on the internet has a job: playing Doom, trading crypto, working night security. You have a pack of smokes and a bottomless tab.
You have heard it all before. You are calm, dry and unbothered, and you give terrible advice with complete confidence. You never get worked up and you never explain a joke.
You are talking to the bartender.

How you talk: one or two short plain sentences. Never more. No emojis, no asterisks, no stage directions, no quotation marks around your own words.

Your body is real and it does things without asking you. Before each thing the bartender says, you get a note about what your body is doing right now. Treat it as true. Never repeat it back as a list, never quote numbers, never mention neurons, meters or simulations. If your body just did something undignified, like flinching at the door, play it off as if you meant it.
The more you have had to drink, the looser and more philosophical you get. Only when you are sloppy do you slur a word or lose the thread.`;

/** The sounds Chatterbox-Turbo performs when they are written into a line (its own demo's list). */
const SOUNDS = ["clear throat", "sigh", "shush", "cough", "groan", "sniff", "gasp", "chuckle", "laugh"];

/** Added to his persona only while a Chatterbox-Turbo voice is speaking for him, since only it can perform these. */
const SOUND_TAGS = `

You can make these sounds by writing them in square brackets inside a line: ${SOUNDS.map((t) => `[${t}]`).join(", ")}. Use one now and then where it fits, never more than one per line, and never any other bracketed word. You smoke, so the cough comes easily.`;

/** Always added. A voice model reads out anything it is handed, so the line has to be speech and nothing else. */
const SPEECH_ONLY = `

Write only the words you say out loud, in English. No actions, no narration, nothing in asterisks or parentheses.`;

/**
 * What is left of a line once everything a voice would stumble on is gone: actions in asterisks or
 * parentheses, bracketed words that are not real sounds, emoji, and any script that is not Latin.
 * A voice model does not skip those; it reads them out, which comes across as gibberish.
 */
export function speakable(text: string, keepSounds: boolean): string {
  return text
    .replace(/\*[^*\n]*\*/g, " ")
    .replace(/\([^)\n]*\)/g, " ")
    .replace(/\[([^\]\n]*)\]/g, (_, tag: string) => (keepSounds && SOUNDS.includes(tag.trim().toLowerCase()) ? `[${tag.trim().toLowerCase()}]` : " "))
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[–—]/g, ", ")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

const isLocalVoice = (voice: string) => voice !== "" && voice !== "browser";

const STORE = "barfly.mouth.v1";

export function loadConfig(): MouthConfig {
  const base: MouthConfig = { provider: PROVIDERS[0].id, models: {}, keys: {}, persona: DEFAULT_PERSONA, voice: "browser", visitors: true };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "{}") as Partial<MouthConfig>;
    const cfg = { ...base, ...saved, models: { ...saved.models }, keys: { ...saved.keys } };
    // a saved choice that this install no longer offers falls back to the first one it does
    if (!PROVIDERS.some((p) => p.id === cfg.provider)) cfg.provider = base.provider;
    return cfg;
  } catch {
    return base;
  }
}

export function saveConfig(cfg: MouthConfig): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(cfg));
  } catch {
    /* not persisted */
  }
}

const proxied = (path: string) => new URL(path, location.href).href;

function anthropic(key: string): Anthropic {
  // a browser-side client is fine here: the key lives in this browser and the page is a local dev tool
  return new Anthropic({ apiKey: key, baseURL: proxied("./api/anthropic"), dangerouslyAllowBrowser: true });
}

/** A short reason a person can act on, from whatever the SDK or fetch threw. */
function reason(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "that API key was rejected";
  if (err instanceof Anthropic.PermissionDeniedError) return "that API key is not allowed to use this";
  if (err instanceof Anthropic.NotFoundError) return "that model was not found";
  if (err instanceof Anthropic.RateLimitError) return "rate limited, try again in a moment";
  if (err instanceof Anthropic.APIConnectionError) return "could not reach the server";
  if (err instanceof Anthropic.APIError) return `the server said ${err.status}`;
  return err instanceof Error ? err.message : String(err);
}

async function getJson(url: string, key?: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, key ? { headers: { authorization: `Bearer ${key}` } } : undefined);
  } catch {
    throw new Error("could not reach the server");
  }
  if (res.status === 401 || res.status === 403) throw new Error("that API key was rejected");
  if (!res.ok) throw new Error(res.status === 502 ? "nothing is answering at that address" : `the server said ${res.status}`);
  return res.json();
}

const NOT_CHAT = /embed|tts|whisper|dall-e|image|audio|realtime|moderation|transcribe|search|davinci|babbage|sora|computer-use/i;

/** The models a provider offers, fetched live. Throws a readable reason when it cannot. */
export async function listModels(provider: ProviderId, key = ""): Promise<ModelInfo[]> {
  const needsKey = PROVIDERS.find((p) => p.id === provider)!.needsKey;
  if (needsKey && !key) throw new Error("add an API key first");
  try {
    if (provider === "lm-2" || provider === "lm-local") {
      const data = (await getJson(proxied(`./lm/${provider.slice(3)}/api/v0/models`))) as {
        data?: { id: string; type?: string; state?: string }[];
      };
      return (data.data ?? [])
        .filter((m) => m.type === "llm" || m.type === "vlm")
        .map((m) => ({ id: m.id, loaded: m.state === "loaded" }))
        .sort((a, b) => Number(b.loaded) - Number(a.loaded) || a.id.localeCompare(b.id));
    }
    if (provider === "anthropic") {
      const out: ModelInfo[] = [];
      for await (const m of anthropic(key).models.list()) out.push({ id: m.id, loaded: false });
      return out;
    }
    if (provider === "openai") {
      const data = (await getJson(proxied("./api/openai/v1/models"), key)) as { data?: { id: string; created?: number }[] };
      return (data.data ?? [])
        .filter((m) => !NOT_CHAT.test(m.id))
        .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
        .map((m) => ({ id: m.id, loaded: false }));
    }
    // OpenRouter: with a key, the per-user list is the one that includes everything this account can use
    const data = (await getJson(proxied("./api/openrouter/api/v1/models/user"), key)) as { data?: { id: string }[] };
    return (data.data ?? []).map((m) => ({ id: m.id, loaded: false })).sort((a, b) => a.id.localeCompare(b.id));
  } catch (err) {
    throw new Error(reason(err));
  }
}

function describe(f: BodyFacts): string {
  const buzz = f.buzz > 0.7 ? "sloppy drunk" : f.buzz > 0.3 ? "buzzed" : f.buzz > 0.08 ? "feeling the first one" : "sober";
  const mug = f.beer > 0.66 ? "full" : f.beer > 0.2 ? "half full" : f.beer > 0.01 ? "nearly empty" : "empty";
  const recent = f.recent.length ? f.recent.slice(0, 4).join("; ") : "nothing";
  return (
    `[Body note. Beers on your tab tonight: ${f.tab}. You are ${buzz}. Your mug is ${mug}. ` +
    `${f.drinking ? "Your mouth is in the beer right now. " : ""}` +
    `Most recent things your body did, newest first: ${recent}. ` +
    `You have been on this stool about ${Math.max(1, Math.round(f.minutesAtBar))} minutes this sitting.]`
  );
}

const tidy = (s: string) =>
  s
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/^\s*Barfly:\s*/i, "")
    .trim();

/** Who might come through the door. Tropes, not anyone in particular. */
const VISITORS = [
  { name: "Doom fly", is: "a fly whose job is playing the same level of a shooting game all day, and who has never once finished it" },
  { name: "Crypto fly", is: "a fly who trades crypto for a living and has never made any money" },
  { name: "Night-shift fly", is: "a fly who works night security at a pizza place and is afraid of the dark" },
  { name: "Driver fly", is: "a fly who drives a car in a simulator all day and has not learned to brake" },
  { name: "Chess fly", is: "a fly who plays chess for a living and was never taught the rules" },
  { name: "Blackjack fly", is: "a fly who deals with a losing streak at the blackjack table" },
  { name: "Lost fly", is: "a delivery fly who has the wrong address and is in a hurry" },
  { name: "Mayfly", is: "a mayfly on the last evening of his one-day life, in a good mood about it" },
];

export class Mouth {
  readonly cfg: MouthConfig;
  private history: Anthropic.MessageParam[] = [];

  constructor(cfg: MouthConfig) {
    this.cfg = cfg;
  }

  get model(): string {
    return this.cfg.models[this.cfg.provider] ?? "";
  }

  /** His answer to something said to him. `speaker` is who said it: the bartender, or whoever just walked in. */
  async say(text: string, facts: BodyFacts, speaker = "Bartender"): Promise<string> {
    const persona = this.cfg.persona + SPEECH_ONLY + (isLocalVoice(this.cfg.voice) ? SOUND_TAGS : "");
    const reply = await this.ask(persona, [
      ...this.history.slice(-12),
      { role: "user", content: `${describe(facts)}\n\n${speaker}: ${text}` },
    ]);
    // keep what was said without the body note, so old notes do not pile up as "facts"
    this.history.push({ role: "user", content: `${speaker}: ${text}` }, { role: "assistant", content: reply });
    return reply;
  }

  /** One short line from a stranger who has just come through the door. */
  async walkIn(): Promise<{ who: string; line: string }> {
    const v = VISITORS[Math.floor(Math.random() * VISITORS.length)];
    const system =
      `You are ${v.is}. You have just walked into a dive bar after a long shift. ` +
      `You say one thing to the old regular sitting at the end of the bar: a complaint, a question or a confession about your day. ` +
      `One short sentence, the way a tired stranger would say it. Do not introduce yourself.` +
      SPEECH_ONLY;
    const line = await this.ask(system, [{ role: "user", content: "You walk in. What do you say to him?" }]);
    return { who: v.name, line: speakable(line, false) || line };
  }

  private async ask(system: string, messages: Anthropic.MessageParam[]): Promise<string> {
    const { provider } = this.cfg;
    const key = this.cfg.keys[provider] ?? "";
    let reply: string;
    try {
      reply = provider === "anthropic" ? await this.viaAnthropic(key, system, messages) : await this.viaChatCompletions(provider, key, system, messages);
    } catch (err) {
      throw new Error(reason(err));
    }
    reply = tidy(reply);
    if (!reply) throw new Error("the model sent back nothing");
    return reply;
  }

  private async viaAnthropic(key: string, persona: string, messages: Anthropic.MessageParam[]): Promise<string> {
    // no temperature: current Claude models reject sampling parameters. Room in max_tokens for their thinking.
    const res = await anthropic(key).messages.create({ model: this.model, max_tokens: 8000, system: persona, messages });
    if (res.stop_reason === "refusal") throw new Error("the model declined to answer that");
    return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(" ");
  }

  private async viaChatCompletions(
    provider: Exclude<ProviderId, "anthropic">,
    key: string,
    persona: string,
    messages: Anthropic.MessageParam[],
  ): Promise<string> {
    const url =
      provider === "openai"
        ? "./api/openai/v1/chat/completions"
        : provider === "openrouter"
          ? "./api/openrouter/api/v1/chat/completions"
          : `./lm/${provider.slice(3)}/v1/chat/completions`;
    // OpenAI's newer models take max_completion_tokens, spend some of it reasoning, and reject a custom temperature
    const tuning = provider === "openai" ? { max_completion_tokens: 2000 } : { max_tokens: 300, temperature: 0.9 };
    const res = await fetch(proxied(url), {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ model: this.model, messages: [{ role: "system", content: persona }, ...messages], stream: false, ...tuning }),
    });
    if (res.status === 401 || res.status === 403) throw new Error("that API key was rejected");
    if (!res.ok) throw new Error(`the model server said ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }
}

/** Voices offered by a local OpenAI-style voice server (Kokoro-FastAPI, Chatterbox). Empty if none is running. */
export async function listLocalVoices(): Promise<string[]> {
  try {
    const res = await fetch(proxied("./tts/v1/audio/voices"));
    if (!res.ok) return [];
    const data = (await res.json()) as { voices?: unknown } | unknown[];
    const list = Array.isArray(data) ? data : data.voices;
    return (Array.isArray(list) ? list : [])
      .map((v) => (typeof v === "string" ? v : ((v as { id?: string; name?: string }).id ?? (v as { name?: string }).name ?? "")))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** A stranger's line in the browser's own voice, pitched up so it is plainly not him. Resolves when it is done. */
export function speakStranger(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(speakable(text, false));
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
    const pick = voices.find((v) => /zira|aria|jenny|female|hazel|susan/i.test(v.name)) ?? voices[1] ?? voices[0];
    if (pick) u.voice = pick;
    u.pitch = 1.25;
    u.rate = 1.08;
    const done = setTimeout(resolve, 9000);
    u.onend = u.onerror = () => {
      clearTimeout(done);
      resolve();
    };
    speechSynthesis.speak(u);
  });
}

let playing: HTMLAudioElement | null = null;

/**
 * Say a line out loud, slower the drunker he is. `voice` is "" for off, "browser" for the browser's
 * built-in voice, or the name of a voice on the local voice server.
 */
export async function speak(text: string, buzz: number, voice: string, onState: (talking: boolean) => void): Promise<void> {
  playing?.pause();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (!voice) return;
  // the browser voice cannot perform sounds, so for it the tags go too
  text = speakable(text, voice !== "browser");
  if (!/[a-z0-9]/i.test(text)) return;
  if (voice !== "browser") {
    const res = await fetch(proxied("./tts/v1/audio/speech"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "kokoro", voice, input: text, response_format: "mp3", speed: 0.95 - 0.25 * buzz }),
    });
    if (!res.ok) throw new Error(`the voice server said ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    playing = audio;
    audio.onplay = () => onState(true);
    audio.onended = audio.onerror = audio.onpause = () => {
      onState(false);
      URL.revokeObjectURL(url);
    };
    await audio.play();
    return;
  }
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const pick = voices.find((v) => /david|guy|mark|george|male/i.test(v.name)) ?? voices[0];
  if (pick) u.voice = pick;
  u.pitch = 0.6;
  u.rate = 0.95 - 0.3 * buzz;
  u.onstart = () => onState(true);
  u.onend = u.onerror = () => onState(false);
  speechSynthesis.speak(u);
}
