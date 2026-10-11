// Headless: what happens to his two reflexes if "alcohol" strengthens every GABA connection in the brain?
//   node scripts/drunk-probe.ts
// A cartoon of real pharmacology (ethanol boosts GABA inhibition). The wiring is untouched.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { parseGraph, parseNeurons, type BrainMeta } from "../src/brain/data.ts";
import { LIFEngine, SHIU_PARAMS } from "../src/brain/engine.ts";

const DIR = new URL("../public/data/brain/", import.meta.url);
const toAB = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const meta = JSON.parse(readFileSync(new URL("meta.json", DIR), "utf8")) as BrainMeta;
const graph = parseGraph(toAB(gunzipSync(readFileSync(new URL("graph.bin.gz", DIR)))), meta);
const info = parseNeurons(toAB(gunzipSync(readFileSync(new URL("neurons.bin.gz", DIR)))), meta.neurons);

const GABA = meta.nts.indexOf("gaba");
const DOPAMINE = meta.nts.indexOf("dopamine");
const count = (nt: number) => info.nt.reduce((a, v) => a + (v === nt ? 1 : 0), 0);
console.log(`neurons: ${graph.n}, GABA: ${count(GABA)}, dopamine: ${count(DOPAMINE)}`);

const engine = new LIFEngine(graph, { ...SHIU_PARAMS }, 7);
const G = meta.groups;
const names = Object.keys(G);
engine.defineGroups(names.map((k) => G[k]));
const dopamineIds = Int32Array.from(Array.from(info.nt.keys()).filter((i) => info.nt[i] === DOPAMINE));

function setChemistry(gabaGain: number): void {
  const scale = new Float32Array(graph.n);
  for (let j = 0; j < graph.n; j++) scale[j] = info.nt[j] === GABA ? gabaGain : 1;
  engine.setWeights(graph.syn, scale);
}

/** mean Hz per neuron of a tracked group over `ms` of the given stimulus */
function measure(ms: number, stim: Record<string, number>, dopamineHz: number): Record<string, number> {
  engine.reset();
  for (const k of names) engine.setRate(G[k], 0);
  engine.setRate(dopamineIds, dopamineHz);
  for (const [k, hz] of Object.entries(stim)) engine.setRate(G[k], hz);
  engine.groupCounts.fill(0);
  engine.run(Math.round(ms / engine.params.dt));
  const hz = (k: string) => (engine.groupCounts[names.indexOf(k)] * 1000) / ms / G[k].length;
  return { mouth: hz("proboscis_MN"), escape: (hz("DNp01_L") + hz("DNp01_R")) / 2 };
}

const SUGAR = { sugar_GRN_L: 150, sugar_GRN_R: 150 };
const LOOM = { LPLC2_L: 150, LPLC2_R: 150, LC4_L: 150, LC4_R: 150 };
const f = (x: number) => x.toFixed(1).padStart(6);

console.log("\nGABA gain | sugar->mouth | loom->escape | sugar+loom: mouth, escape");
for (const gain of [1, 1.25, 1.5, 2, 3]) {
  setChemistry(gain);
  const a = measure(1000, SUGAR, 0);
  const b = measure(1000, LOOM, 0);
  const c = measure(1000, { ...SUGAR, ...LOOM }, 0);
  console.log(`${gain.toFixed(2).padStart(9)} | ${f(a.mouth)}       | ${f(b.escape)}       | ${f(c.mouth)}, ${f(c.escape)}`);
}

console.log("\ndopamine neurons buzzing in the background (GABA gain 1)");
console.log("dopamine Hz | sugar->mouth | loom->escape | nothing: mouth, escape");
setChemistry(1);
for (const da of [0, 5, 20, 60]) {
  const a = measure(1000, SUGAR, da);
  const b = measure(1000, LOOM, da);
  const c = measure(1000, {}, da);
  console.log(`${String(da).padStart(11)} | ${f(a.mouth)}       | ${f(b.escape)}       | ${f(c.mouth)}, ${f(c.escape)}`);
}
