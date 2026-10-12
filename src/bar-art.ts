import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export function woodMaterial(): THREE.MeshStandardMaterial {
  const loader = new THREE.TextureLoader();
  const texture = (name: string, color = false) => {
    const map = loader.load(`${import.meta.env.BASE_URL}art/${name}.jpg`);
    if (color) map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(6, 1);
    map.anisotropy = 8;
    return map;
  };
  return new THREE.MeshStandardMaterial({
    map: texture("wood-color", true),
    normalMap: texture("wood-normal"),
    color: "#967859",
    roughness: 0.68,
    normalScale: new THREE.Vector2(0.3, 0.3),
  });
}

export function labelTexture(title: string, subtitle: string, color = "#eadbc0", ink = "#3b2a20"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#60503b";
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, 228, 228);
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.font = "bold 42px Georgia";
  ctx.fillText(title, 128, 114, 224);
  ctx.font = "18px Georgia";
  ctx.fillText(subtitle, 128, 153, 224);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function dressRegularCorner(scene: THREE.Scene, counter: number): THREE.Group {
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowCtx = shadowCanvas.getContext("2d")!;
  const shade = shadowCtx.createRadialGradient(64, 64, 8, 64, 64, 64);
  shade.addColorStop(0, "#0009");
  shade.addColorStop(0.55, "#0005");
  shade.addColorStop(1, "#0000");
  shadowCtx.fillStyle = shade;
  shadowCtx.fillRect(0, 0, 128, 128);
  const shadowMap = new THREE.CanvasTexture(shadowCanvas);
  for (const [x, z, width, depth] of [[0, -0.72, 0.8, 0.65], [-1.05, -0.95, 0.8, 0.65], [-1.6, -1.25, 0.58, 0.72], [0.85, -1.4, 0.85, 0.45]]) {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, counter + 0.001, z);
    scene.add(shadow);
  }

  const tent = new THREE.Group();
  tent.position.set(0.85, counter, -1.4);
  tent.rotation.y = -0.15;
  const brass = new THREE.MeshStandardMaterial({ color: "#b8995f", metalness: 0.75, roughness: 0.4 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.018, 0.29), brass);
  base.position.y = 0.009;
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.27, 0.012), brass);
  front.position.set(0, 0.14, -0.04);
  front.rotation.x = -0.42;
  const nameCanvas = document.createElement("canvas");
  nameCanvas.width = 1024;
  nameCanvas.height = 320;
  const nameCtx = nameCanvas.getContext("2d")!;
  nameCtx.fillStyle = "#243b30";
  nameCtx.fillRect(0, 0, 1024, 320);
  nameCtx.strokeStyle = nameCtx.fillStyle = "#e6ce92";
  nameCtx.lineWidth = 6;
  nameCtx.strokeRect(18, 18, 988, 284);
  nameCtx.textAlign = "center";
  nameCtx.font = "bold 112px Georgia";
  nameCtx.fillText("RESERVED", 512, 153, 920);
  nameCtx.font = "44px Georgia";
  nameCtx.fillText("HE LIVES HERE", 512, 252);
  const nameMap = new THREE.CanvasTexture(nameCanvas);
  nameMap.colorSpace = THREE.SRGBColorSpace;
  const name = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.23), new THREE.MeshStandardMaterial({ map: nameMap, roughness: 0.6 }));
  name.position.z = -0.008;
  name.rotation.y = Math.PI;
  front.add(name);
  const back = front.clone();
  back.clear();
  back.position.z = 0.06;
  back.rotation.x = 0.42;
  tent.add(base, front, back);
  tent.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  scene.add(tent);

  const stainMap = document.createElement("canvas");
  stainMap.width = stainMap.height = 256;
  const stainCtx = stainMap.getContext("2d")!;
  stainCtx.strokeStyle = "#693d1a66";
  stainCtx.lineWidth = 8;
  stainCtx.beginPath();
  stainCtx.ellipse(128, 128, 90, 87, 0.1, 0, Math.PI * 2);
  stainCtx.stroke();
  stainCtx.fillStyle = "#70431944";
  stainCtx.fillRect(72, 150, 34, 11);
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.56), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(stainMap), transparent: true, depthWrite: false }));
  stain.rotation.x = -Math.PI / 2;
  stain.position.set(0, counter + 0.009, -0.72);
  scene.add(stain);

  const spillCanvas = document.createElement("canvas");
  spillCanvas.width = 512;
  spillCanvas.height = 256;
  const ctx = spillCanvas.getContext("2d")!;
  ctx.fillStyle = "#bd7927aa";
  ctx.beginPath();
  ctx.moveTo(35, 137);
  ctx.bezierCurveTo(4, 38, 170, 17, 211, 72);
  ctx.bezierCurveTo(304, 35, 501, 67, 476, 143);
  ctx.bezierCurveTo(503, 224, 379, 241, 326, 194);
  ctx.bezierCurveTo(264, 229, 56, 244, 35, 137);
  ctx.fill();
  ctx.globalCompositeOperation = "source-atop";
  const shine = ctx.createLinearGradient(0, 30, 0, 170);
  shine.addColorStop(0, "#fff2b300");
  shine.addColorStop(0.45, "#fff2b3aa");
  shine.addColorStop(1, "#fff2b300");
  ctx.fillStyle = shine;
  for (const [x, width] of [[146, 5], [177, 13], [336, 7]]) ctx.fillRect(x, 24, width, 180);
  const spillMap = new THREE.CanvasTexture(spillCanvas);
  spillMap.colorSpace = THREE.SRGBColorSpace;
  const spill = new THREE.Group();
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.5), new THREE.MeshPhysicalMaterial({ map: spillMap, transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.13, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 }));
  wet.rotation.x = -Math.PI / 2;
  spill.add(wet);
  spill.position.set(0.3, counter + 0.003, -1.07);
  spill.rotation.y = -0.3;
  scene.add(spill);
  return spill;
}

/**
 * The bartender's hand: a palm, four jointed fingers with knuckles and nails, a thumb, a forearm and a
 * shirt cuff. It is a person's hand, so it is huge next to his mug, and it carries the mug the only way
 * it can: pinched between forefinger and thumb, little finger out.
 *
 * Local frame: the forearm runs off toward +x, the fingers point toward -x, and positive curl bends a
 * joint downward (toward -y). `userData.grip` is where the hand sits relative to the mug's base.
 */
export function bartenderHand(): THREE.Group {
  const hand = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({ color: "#c08f6f", roughness: 0.62, sheen: 0.25, sheenColor: new THREE.Color("#e8b89a") });
  const nail = new THREE.MeshStandardMaterial({ color: "#ecd2c2", roughness: 0.35 });
  const cloth = new THREE.MeshStandardMaterial({ color: "#e6dfc8", roughness: 0.9 });
  const garter = new THREE.MeshStandardMaterial({ color: "#16130f", roughness: 0.5 });

  // a bone: a capsule lying along -x from the joint it hangs off
  const bone = (r: number, len: number) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - r), 6, 14), skin);
    m.rotation.z = Math.PI / 2;
    m.position.x = -len / 2;
    return m;
  };

  // a digit: three bones, each hanging off the end of the last, each bent by its own curl
  const digit = (r: number, lens: number[], curls: number[]) => {
    const root = new THREE.Group();
    let joint = root;
    lens.forEach((len, k) => {
      if (k > 0) {
        const next = new THREE.Group();
        next.position.x = -lens[k - 1];
        joint.add(next);
        joint = next;
      }
      joint.rotation.z = curls[k];
      const taper = 1 - 0.09 * k;
      joint.add(bone(r * taper, len));
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(r * taper * 1.12, 14, 10), skin);
      joint.add(knuckle);
      if (k === lens.length - 1) {
        const plate = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), nail);
        plate.scale.set(len * 0.3, r * 0.18, r * 0.72);
        plate.position.set(-len * 0.66, r * taper * 0.86, 0);
        joint.add(plate);
      }
    });
    return root;
  };

  // palm: a slab, a little thicker at the heel
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), skin);
  palm.scale.set(0.52, 0.17, 0.46);
  hand.add(palm);
  const heel = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin);
  heel.scale.set(0.3, 0.19, 0.4);
  heel.position.set(0.3, -0.03, 0);
  hand.add(heel);

  // fingers, from the thumb side (toward the camera, -z) to the little finger
  const fingers: [number, number, number, number[], number[]][] = [
    [-0.4, -0.3, 0.085, [0.42, 0.3, 0.24], [0.9, 0.5, 0.3]], // forefinger: down onto the mug
    [-0.43, -0.1, 0.09, [0.46, 0.32, 0.25], [1.45, 1.55, 1.1]], // middle: tucked away
    [-0.41, 0.1, 0.085, [0.42, 0.3, 0.24], [1.4, 1.5, 1.1]], // ring: tucked away
    [-0.35, 0.29, 0.07, [0.33, 0.23, 0.2], [-0.3, 0.12, 0.1]], // little finger: out, like he was raised right
  ];
  for (const [x, z, r, lens, curls] of fingers) {
    const f = digit(r, lens, curls);
    f.position.set(x, 0, z);
    hand.add(f);
  }

  // thumb: comes off the side of the heel and reaches under to meet the forefinger across the mug
  const thumb = digit(0.1, [0.5, 0.42], [0, 0.28]);
  thumb.position.set(0.18, -0.04, -0.4);
  thumb.quaternion.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-0.42, -0.88, 0.2).normalize());
  hand.add(thumb);

  // wrist and forearm, rising back toward wherever the bartender is standing
  const arm = new THREE.Group();
  arm.position.x = 0.42;
  arm.rotation.z = -0.3;
  const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.5, 8, 18), skin);
  forearm.rotation.z = Math.PI / 2;
  forearm.scale.set(1, 1, 0.86);
  forearm.position.x = 0.85;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.31, 0.34, 28), cloth);
  cuff.rotation.z = Math.PI / 2;
  cuff.position.x = 1.25;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 3.2, 28), cloth);
  sleeve.rotation.z = Math.PI / 2;
  sleeve.position.x = 3.0;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 8, 28), garter);
  band.rotation.y = Math.PI / 2;
  band.position.x = 2.6;
  arm.add(forearm, cuff, sleeve, band);
  hand.add(arm);

  // the mug hangs between the tips of the forefinger and thumb; this is the hand's place relative to its base
  hand.userData.grip = new THREE.Vector3(0.52, 1.14, 0.3);
  hand.userData.scale = 0.8;
  hand.userData.tilt = 0;
  hand.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  hand.visible = false;
  return hand;
}

export function dressRoom(scene: THREE.Scene, wood: THREE.MeshStandardMaterial, brass: THREE.Material): void {
  const panelWood = wood.clone();
  panelWood.color.set("#4c3929");
  panelWood.roughness = 0.75;
  const addBox = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };
  // Wainscoting and its rails give the distant wall scale without competing with the fly.
  addBox(24, 2.1, 0.09, 0, 1.05, 5.89, panelWood);
  addBox(24, 0.09, 0.16, 0, 2.13, 5.8, wood);
  addBox(24, 0.12, 0.18, 0, 0.12, 5.78, panelWood);
  for (let x = -11; x < 5; x += 0.85) addBox(0.04, 1.9, 0.07, x, 1.05, 5.8, wood);

  const bottleProfile = [
    [0.11, 0], [0.15, 0.025], [0.15, 0.42], [0.135, 0.47], [0.055, 0.54], [0.05, 0.74], [0.065, 0.76],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bottleGeometry = new THREE.LatheGeometry(bottleProfile, 24);
  const shades = ["#3d6248", "#785128", "#304f53", "#69412c"];
  const labels = [labelTexture("NIGHT", "HOUSE RESERVE"), labelTexture("NO. 6", "BITTER & SWEET"), labelTexture("LAST", "CALL")];
  for (let shelf = 0; shelf < 2; shelf++) {
    const y = 2.2 + shelf * 0.95;
    addBox(2.5, 0.11, 0.58, 3.3, y, 5.55, wood);
    for (const x of [2.3, 4.3]) addBox(0.06, 0.28, 0.35, x, y - 0.18, 5.69, brass);
    for (let i = 0; i < 5; i++) {
      const bottle = new THREE.Group();
      const glass = new THREE.Mesh(bottleGeometry, new THREE.MeshPhysicalMaterial({ color: shades[(i + shelf) % shades.length], roughness: 0.2, metalness: 0.1, clearcoat: 1 }));
      glass.castShadow = true;
      bottle.add(glass);
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.24, 24, 1, true), new THREE.MeshStandardMaterial({ map: labels[i % labels.length], roughness: 0.9 }));
      label.position.y = 0.27;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 16), brass);
      cap.position.y = 0.78;
      bottle.add(label, cap);
      bottle.position.set(2.3 + i * 0.49, y + 0.055, 5.45);
      bottle.scale.y = 0.83 + (i % 3) * 0.12;
      scene.add(bottle);
    }
    const glow = new THREE.PointLight("#ffbc7a", 4, 4, 2);
    glow.position.set(3.3, y + 0.85, 5.15);
    scene.add(glow);
    addBox(2.3, 0.025, 0.025, 3.3, y + 0.1, 5.28, new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffc386").multiplyScalar(1.2) }));
  }

  const chalk = labelTexture("TONIGHT", "SAME AS LAST NIGHT", "#253b34", "#d0d3b9");
  addBox(1.65, 1.9, 0.08, -6.5, 3.35, 5.85, wood);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.48, 1.72), new THREE.MeshStandardMaterial({ map: chalk, roughness: 1 }));
  board.position.set(-6.5, 3.35, 5.79);
  board.rotation.y = Math.PI;
  scene.add(board);
}

/** how long the scanned hand and forearm are in the scene, fingertip to cut end */
const SCAN_LENGTH = 3.3;
/** which way the scan's palm faces in its own file: +1 for +z, -1 for -z */
const SCAN_PALM = 1;

/**
 * Swap the built hand for a scan of a real one, if the file is there. "Hand-arm" by Thunk3D scanner
 * (CC BY 4.0), reduced from 3.1 million triangles to about 63,000. It is an open, flat hand, so it
 * does not pick the mug up: it slides it across the bar with its fingertips.
 *
 * The hand keeps the same frame as the built one: forearm toward +x, fingers toward -x, palm down.
 * Its origin is at the fingertips.
 */
export async function useScannedHand(hand: THREE.Group): Promise<void> {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}art/hand-arm.glb`);
  const scan = gltf.scene;
  // the scan's own material is half metal; skin is not
  const skin = new THREE.MeshPhysicalMaterial({ color: "#c69473", roughness: 0.58, sheen: 0.3, sheenColor: new THREE.Color("#f0c2a4") });
  scan.traverse(o => {
    if (o instanceof THREE.Mesh) {
      o.material = skin;
      o.castShadow = true;
    }
  });

  // In the file the fingers point up (+y) and the palm faces along z. Lay it down: fingers to -x, palm to the bar.
  const laid = new THREE.Group();
  laid.add(scan);
  const layDown = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(1, 0, 0), (SCAN_PALM * Math.PI) / 2)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
  laid.quaternion.copy(layDown);

  // every vertex of the scan, in the laid-down frame
  const points = (): THREE.Vector3[] => {
    laid.updateMatrixWorld(true);
    const out: THREE.Vector3[] = [];
    scan.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      const pos = o.geometry.getAttribute("position");
      for (let n = 0; n < pos.count; n += 3) out.push(new THREE.Vector3().fromBufferAttribute(pos, n).applyMatrix4(o.matrixWorld));
    });
    return out;
  };
  const centroid = (list: THREE.Vector3[]) => list.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(Math.max(1, list.length));
  const ends = (list: THREE.Vector3[]) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of list) {
      lo = Math.min(lo, v.x);
      hi = Math.max(hi, v.x);
    }
    const slab = (hi - lo) * 0.06;
    return { lo, hi, tips: list.filter(v => v.x < lo + slab), cut: list.filter(v => v.x > hi - slab) };
  };

  // the arm was scanned at a lean; straighten it so fingertips-to-forearm runs dead along +x
  const first = ends(points());
  const lean = centroid(first.cut).sub(centroid(first.tips)).normalize();
  laid.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(lean, new THREE.Vector3(1, 0, 0)).multiply(layDown));

  const all = points();
  const { lo, hi, tips } = ends(all);
  const k = SCAN_LENGTH / (hi - lo);
  const tip = centroid(tips);
  const tipFloor = Math.min(...tips.map(v => v.y));
  // how thick the forearm is near its cut end, so the sleeve fits it
  const girth = new THREE.Box3();
  for (const v of all) if (v.x > hi - (hi - lo) * 0.15) girth.expandByPoint(v);
  const fitted = new THREE.Group();
  fitted.add(laid);
  fitted.scale.setScalar(k);
  // the fingertips at the origin, their undersides resting at y = 0
  fitted.position.set(-lo * k, -tipFloor * k, -tip.z * k);
  const cut = centroid(ends(all).cut).multiplyScalar(k).add(fitted.position);
  const thick = Math.max(girth.max.y - girth.min.y, girth.max.z - girth.min.z) * k;

  // a rolled shirt sleeve over the cut end of the forearm
  const cloth = new THREE.MeshStandardMaterial({ color: "#e6dfc8", roughness: 0.9 });
  const sleeve = new THREE.Group();
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.6, thick * 0.57, 0.3, 28), cloth);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.7, thick * 0.62, 1.8, 28), cloth);
  arm.position.y = 1.0;
  const band = new THREE.Mesh(new THREE.TorusGeometry(thick * 0.66, 0.03, 8, 28), new THREE.MeshStandardMaterial({ color: "#16130f", roughness: 0.5 }));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.8;
  sleeve.add(cuff, arm, band);
  sleeve.rotation.z = -Math.PI / 2;
  sleeve.position.set(cut.x - 0.3, cut.y, cut.z);
  sleeve.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });

  for (const child of [...hand.children]) hand.remove(child);
  hand.add(fitted, sleeve);
  // fingertips against the side of the mug nearest us, a little above the bar
  hand.userData.grip = new THREE.Vector3(0.2, 0.06, 0);
  hand.userData.scale = 1;
  // wrist higher than the fingertips, the way an arm reaches down onto a counter
  hand.userData.tilt = 0.16;
}
