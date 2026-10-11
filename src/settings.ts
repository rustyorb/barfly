// The settings dialog: which language model speaks for him, the key for it, his voice, and who he is.
import { DEFAULT_PERSONA, listLocalVoices, listModels, PROVIDERS, saveConfig, type MouthConfig, type ProviderId } from "./chat.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function option(value: string, label: string): HTMLOptionElement {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  return o;
}

export async function setUpSettings(cfg: MouthConfig): Promise<void> {
  const dialog = $<HTMLDialogElement>("settings");
  const providerSel = $<HTMLSelectElement>("set-provider");
  const keyRow = $("set-key-row");
  const keyInput = $<HTMLInputElement>("set-key");
  const modelSel = $<HTMLSelectElement>("set-model");
  const status = $("set-status");
  const voiceSel = $<HTMLSelectElement>("set-voice");
  const persona = $<HTMLTextAreaElement>("set-persona");

  const summarise = () => {
    const label = PROVIDERS.find((p) => p.id === cfg.provider)!.label;
    const model = cfg.models[cfg.provider];
    $("mouth-summary").textContent = model ? `His words: ${model}, ${label}` : `His words: no model picked (${label})`;
  };

  let request = 0;
  const refreshModels = async () => {
    const mine = ++request;
    const provider = cfg.provider;
    modelSel.replaceChildren(option("", "looking…"));
    status.textContent = "";
    try {
      const models = await listModels(provider, cfg.keys[provider]);
      if (mine !== request) return;
      if (!models.length) throw new Error("the server offered no chat models");
      modelSel.replaceChildren(...models.map((m) => option(m.id, (m.loaded ? "● " : "") + m.id)));
      const saved = cfg.models[provider];
      const preferred = provider === "anthropic" ? "claude-opus-5-5" : "";
      cfg.models[provider] = models.some((m) => m.id === saved)
        ? saved
        : (models.find((m) => m.id === preferred)?.id ?? models[0].id);
      modelSel.value = cfg.models[provider]!;
      status.textContent = `${models.length} models${provider.startsWith("lm-") ? "; ● is already loaded" : ""}.`;
    } catch (err) {
      if (mine !== request) return;
      modelSel.replaceChildren(option("", "none"));
      delete cfg.models[provider];
      status.textContent = `No models: ${(err as Error).message}.`;
    }
    saveConfig(cfg);
    summarise();
  };

  const showProvider = () => {
    const p = PROVIDERS.find((x) => x.id === cfg.provider)!;
    keyRow.hidden = !p.needsKey;
    keyInput.value = cfg.keys[cfg.provider] ?? "";
    $("set-cloud-note").hidden = !p.needsKey;
  };

  providerSel.replaceChildren(...PROVIDERS.map((p) => option(p.id, p.label)));
  providerSel.value = cfg.provider;
  providerSel.addEventListener("change", () => {
    cfg.provider = providerSel.value as ProviderId;
    showProvider();
    void refreshModels();
  });
  keyInput.addEventListener("change", () => {
    const key = keyInput.value.trim();
    if (key) cfg.keys[cfg.provider] = key;
    else delete cfg.keys[cfg.provider];
    void refreshModels();
  });
  modelSel.addEventListener("change", () => {
    if (modelSel.value) cfg.models[cfg.provider] = modelSel.value;
    saveConfig(cfg);
    summarise();
  });
  $("set-refresh").addEventListener("click", () => void refreshModels());

  // re-read every time Settings opens, so a voice server started later shows up without a reload
  const refreshVoices = async () => {
    const local = await listLocalVoices();
    voiceSel.replaceChildren(option("browser", "Browser's built-in voice"), ...local.map((v) => option(v, `${v} (local voice server)`)), option("", "Off"));
    // a saved voice that is not on offer right now is kept as the choice, and shown as unavailable
    if (![...voiceSel.options].some((o) => o.value === cfg.voice)) voiceSel.append(option(cfg.voice, `${cfg.voice} (not running)`));
    voiceSel.value = cfg.voice;
    $("set-voice-note").textContent = local.length
      ? ""
      : "No local voice server is answering. Start the one in the voice folder (or Kokoro-FastAPI), then reopen Settings.";
  };
  voiceSel.addEventListener("change", () => {
    cfg.voice = voiceSel.value;
    saveConfig(cfg);
  });
  await refreshVoices();

  persona.value = cfg.persona;
  persona.addEventListener("input", () => {
    cfg.persona = persona.value;
    saveConfig(cfg);
  });
  $("set-persona-reset").addEventListener("click", () => {
    cfg.persona = persona.value = DEFAULT_PERSONA;
    saveConfig(cfg);
  });

  $("open-settings").addEventListener("click", () => {
    dialog.showModal();
    void refreshVoices();
  });
  $("set-close").addEventListener("click", () => dialog.close());

  showProvider();
  summarise();
  await refreshModels();
  // nothing answering on the saved choice and no key involved: fall over to the other LM Studio, if there is one
  const other = PROVIDERS.find((p) => p.id.startsWith("lm-") && p.id !== cfg.provider);
  if (!cfg.models[cfg.provider] && cfg.provider.startsWith("lm-") && other) {
    cfg.provider = other.id;
    providerSel.value = cfg.provider;
    showProvider();
    await refreshModels();
  }
}
