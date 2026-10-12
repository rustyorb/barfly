import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const revision = "38c8ec61034cd59bc5ba0de20688d4a3c0000d60";
const upstream = `https://raw.githubusercontent.com/NeLy-EPFL/flygym/${revision}/`;
const modelPath = "src/flygym/assets/model/neuromechfly/";
const output = new URL("../public/art/", import.meta.url);
await mkdir(output, { recursive: true });
const sources = [];

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  const data = Buffer.from(await response.arrayBuffer());
  sources.push({ url, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") });
  return data;
}

const rigText = (await download(upstream + modelPath + "rigging.yaml")).toString();
const rig = Object.fromEntries([...rigText.matchAll(/^(\w+):\r?\n  pos: \[([^\]]+)\]\r?\n  quat: \[([^\]]+)\]/gm)].map((m) => [m[1], {
  pos: m[2].split(",").map(Number), quat: m[3].split(",").map(Number),
}]));
const poseText = (await download(upstream + modelPath + "pose/neutral/yaw_pitch_roll.yaml")).toString();
const angles = Object.fromEntries([...poseText.matchAll(/^  ([\w-]+): (-?[\d.]+)/gm)].map(m => [m[1], Number(m[2])]));
const geometries = new Map();
function smoothSurface(geometry) {
  const position = geometry.attributes.position;
  const adjacent = Array.from({ length: position.count }, () => new Set());
  const index = geometry.index;
  for (let i = 0; i < index.count; i += 3) {
    const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    for (const vertex of triangle) for (const neighbor of triangle) if (vertex !== neighbor) adjacent[vertex].add(neighbor);
  }
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(position.array);
    adjacent.forEach((neighbors, vertex) => {
      const mean = new THREE.Vector3();
      for (const neighbor of neighbors) mean.add(new THREE.Vector3().fromBufferAttribute(position, neighbor));
      mean.divideScalar(neighbors.size || 1);
      mean.lerp(new THREE.Vector3().fromBufferAttribute(position, vertex), 0.7);
      mean.toArray(next, vertex * 3);
    });
    position.array.set(next);
  }
}
const names = Object.keys(rig).filter(name => !name.startsWith("r"));
for (const name of names) {
  const bytes = await download(upstream + modelPath + `meshes/simplified_max2000faces/${name}.stl`);
  let geometry = new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  geometry.scale(1000, 1000, 1000);
  geometry.deleteAttribute("normal");
  geometry = mergeVertices(geometry, 0.00001);
  if (!name.endsWith("wing") && !name.endsWith("arista")) smoothSurface(geometry);
  geometry.computeVertexNormals();
  geometries.set(name, geometry);
}

function parentOf(name) {
  if (name === "c_thorax") return null;
  if (name === "c_haustellum") return "c_rostrum";
  if (name === "c_rostrum" || /_(eye|pedicel)$/.test(name)) return "c_head";
  if (/_(funiculus|arista)$/.test(name)) return name.slice(0, 1) + (name.endsWith("arista") ? "_funiculus" : "_pedicel");
  if (/^c_abdomen[3-6]$/.test(name)) return name === "c_abdomen3" ? "c_abdomen12" : "c_abdomen" + (Number(name.slice(-1)) - 1);
  const leg = name.match(/^([lr][fmh])_(.+)$/);
  if (!leg || leg[2] === "coxa") return "c_thorax";
  const previous = { trochanterfemur: "coxa", tibia: "trochanterfemur", tarsus1: "tibia", tarsus2: "tarsus1", tarsus3: "tarsus2", tarsus4: "tarsus3", tarsus5: "tarsus4" };
  return leg[1] + "_" + previous[leg[2]];
}

const specimen = new THREE.Group();
specimen.name = "NeuroMechFly";
specimen.scale.setScalar(0.001);
specimen.userData = { source: "https://github.com/NeLy-EPFL/flygym", revision, license: "Apache-2.0", units: "metres", description: "Scan-derived anatomy in the upstream neutral pose. Barfly retargets these meshes to its theatrical rig." };
const nodes = new Map();
for (const [name, transform] of Object.entries(rig)) {
  const sourceName = name.replace(/^r/, "l");
  const geometry = geometries.get(sourceName);
  if (!geometry) throw new Error(`Missing mesh: ${sourceName}`);
  const mat = new THREE.MeshStandardMaterial({
    color: name.endsWith("eye") ? "#a52a20" : name.includes("abdomen") ? "#9b713e" : "#b48a4e",
    roughness: 0.48,
    ...(name.endsWith("wing") ? { color: "#c7d1d8", transparent: true, opacity: 0.35, side: THREE.DoubleSide } : {}),
  });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  if (name.startsWith("r")) mesh.scale.y = -1;
  const joint = new THREE.Group();
  joint.name = name + "_joint";
  joint.position.fromArray(transform.pos);
  const [w, x, y, z] = transform.quat;
  joint.quaternion.set(x, y, z, w).normalize();
  const parent = parentOf(name);
  for (const [axis, vector] of [["yaw", [0, 0, 1]], ["pitch", [0, 1, 0]], ["roll", [1, 0, 0]]]) {
    const sourceJoint = `${parent}-${name}-${axis}`.replace(/r([fmh])_/g, "l$1_");
    let angle = angles[sourceJoint] ?? 0;
    if (name.startsWith("r") && axis !== "pitch") angle = -angle;
    joint.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...vector), THREE.MathUtils.degToRad(angle)));
  }
  joint.add(mesh);
  nodes.set(name, joint);
}
for (const [name, joint] of nodes) {
  const parent = parentOf(name);
  (parent ? nodes.get(parent) : specimen).add(joint);
}

// GLTFExporter only needs this browser API to read the binary buffer, not a DOM.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
const glb = await new GLTFExporter().parseAsync(specimen, { binary: true });
await writeFile(new URL("fruit-fly.glb", output), Buffer.from(glb));
await writeFile(new URL("LICENSE-NeuroMechFly.txt", output), await download(upstream + "LICENSE"));

const wood = await fetch("https://api.polyhaven.com/files/wood_table").then(r => r.json());
console.log("Material maps:", Object.keys(wood).join(", "));
for (const [kind, filename] of [["Diffuse", "wood-color.jpg"], ["nor_gl", "wood-normal.jpg"], ["Rough", "wood-roughness.jpg"]]) {
  const file = wood[kind]?.["1k"]?.jpg;
  if (!file) throw new Error(`Missing wood material map: ${kind}`);
  const data = await download(file.url);
  if (createHash("md5").update(data).digest("hex") !== file.md5) throw new Error(`Material checksum failed: ${filename}`);
  await writeFile(new URL(filename, output), data);
}
await writeFile(new URL("sources.json", output), JSON.stringify({
  anatomy: { project: "NeuroMechFly / FlyGym", revision, license: "Apache-2.0", source: "https://neuromechfly.org/", modifications: "STL converted to millimetres, welded and lightly smoothed for stylized rendering, assembled using upstream rigging and neutral pose, packed as GLB. Barfly rescales individual meshes to its existing animation rig." },
  wood: { asset: "Wood Table", author: "Dimitrios Savva", license: "CC0", source: "https://polyhaven.com/a/wood_table", resolution: "1K" },
  downloads: sources,
}, null, 2) + "\n");
console.log(`Saved fruit-fly.glb (${glb.byteLength.toLocaleString()} bytes) and wood materials.`);
