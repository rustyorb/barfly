import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const meshes = new Map<string, THREE.BufferGeometry>();
const bodyFrame = new THREE.Matrix4().set(0, -1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0, 1);

export async function loadFlyAnatomy(): Promise<void> {
  const asset = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}art/fruit-fly.glb`);
  asset.scene.updateMatrixWorld(true);
  const abdomen: THREE.BufferGeometry[] = [];
  asset.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes.set(object.name, object.geometry);
    if (object.name.startsWith("c_abdomen")) {
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      abdomen.push(geometry.index ? geometry.toNonIndexed() : geometry);
    }
  });
  const joined = mergeGeometries(abdomen);
  if (joined) meshes.set("abdomen", joined);
}

export function anatomyGeometry(
  name: string,
  fallback: THREE.BufferGeometry,
  width: number,
  height: number,
  depth: number,
  frame: "body" | "leg" | "wing" = "body",
): THREE.BufferGeometry {
  const source = meshes.get(name);
  if (!source) return fallback;
  const geometry = source.clone();
  if (frame === "body") geometry.applyMatrix4(bodyFrame);
  else geometry.rotateX(Math.PI / 2);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(width / size.x, height / size.y, depth / size.z);
  if (frame === "leg") geometry.translate(0, 0.5, 0);
  if (frame === "wing") geometry.translate(0, 0, depth / 2);
  const positions = geometry.attributes.position;
  const uv = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    if (frame === "wing") {
      uv[i * 2] = z / depth;
      uv[i * 2 + 1] = x / width + 0.5;
    } else {
      uv[i * 2] = Math.atan2(x / width, y / height) / (2 * Math.PI) + 0.5;
      uv[i * 2 + 1] = z / depth + 0.5;
    }
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  fallback.dispose();
  return geometry;
}
