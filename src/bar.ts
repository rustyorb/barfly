// The bar: one stool, one mug, one door. Seen from the bartender's side of the counter.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FlyModel } from "./fly3d/fly.ts";
import { bartenderHand, dressRegularCorner, dressRoom, labelTexture, useScannedHand, woodMaterial } from "./bar-art.ts";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export interface BarState {
  /** 0..1 from the proboscis motor neurons */
  proboscis: number;
  /** 0..1 from the giant-fibre escape neurons */
  startle: number;
  /** 0..1 beer left in the mug */
  beer: number;
  /** 0..1 how far the door is open */
  door: number;
  /** beers on the tab, which sets the length of the receipt */
  tab: number;
  /** 0..1 the made-up buzz meter */
  drunk: number;
  /** true while his voice is playing */
  talking: boolean;
  /** true while the visitor on the next stool is speaking */
  guestTalking: boolean;
}

/** stool seat height; the fly's feet rest at this y */
const SEAT = 1.5;
/** counter top, a little above the seat so his front legs rest on it */
const COUNTER = SEAT + 0.12;
const MUG_H = 0.4;
/** the cigarette resting on the lip of the ashtray, ember over the dish */
const CIG_REST = new THREE.Vector3(-0.9, COUNTER + 0.13, -0.95);
const CIG_REST_TILT = Math.PI / 2 - 0.25;
/** the cigarette at his mouth: filter end at his face, ember out to his left */
const CIG_AT_MOUTH = new THREE.Vector3(-0.27, SEAT + 0.9, -0.8);
/** a visitor flies in from the doorway, over the floor, to the stool between him and the door */
const GUEST_DOOR = new THREE.Vector3(5.6, 2.7, 5.5);
const GUEST_OVER = new THREE.Vector3(4.6, SEAT + 2.4, 2.4);
const GUEST_SEAT = new THREE.Vector3(2.6, SEAT, 0);
const GUEST_HOVER = new THREE.Vector3(2.6, SEAT + 0.8, 0);
/** how he sits: at the bar, turned a little toward the regular */
const GUEST_YAW = 0.55;
const GUEST_FLY_S = 2.4;
const GUEST_SETTLE_S = 0.5;
const GUEST_RECOVER_S = 1.7;
const GUEST_MISS = new THREE.Vector3(1.75, SEAT + 0.5, -0.6);
/** the beer arrives from the bartender's side of the bar, which is where we are standing */
const SERVE_FROM = new THREE.Vector3(-0.9, COUNTER + 0.7, -5.6);
const SERVE_MUG_START = new THREE.Vector3(-0.25, COUNTER + 0.55, -2.3);
/** the hand reaches away from us: its forearm points back toward the camera */
const SERVE_YAW = Math.PI / 2 - 0.18;

const MUG_REST = new THREE.Vector3(0, COUNTER, -0.72);

function signTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 320;
  const g = c.getContext("2d")!;
  g.fillStyle = "#14231c";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#9c7841";
  g.lineWidth = 7;
  g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.strokeRect(32, 32, c.width - 64, c.height - 64);
  g.font = "bold 174px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "#ffb347";
  g.shadowBlur = 14;
  g.fillStyle = "#ffd68a";
  g.fillText("BARFLY", c.width / 2, 145);
  g.shadowBlur = 0;
  g.font = "24px Georgia, serif";
  g.fillStyle = "#bfa477";
  g.fillText("A STOOL. A SMOKE. A BOTTOMLESS TAB.", c.width / 2, 254);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function receiptTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#efe6cf";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#3a2c1c";
  g.font = "bold 18px Georgia";
  g.textAlign = "center";
  g.fillText("UNPAID", c.width / 2, 24);
  for (let y = 44; y < c.height; y += 18) g.fillRect(12, y, 30 + ((y * 37) % 70), 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function smokeTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,0.5)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function streetTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const sky = ctx.createLinearGradient(0, 0, 0, 1024);
  sky.addColorStop(0, "#0b1924");
  sky.addColorStop(0.65, "#284351");
  sky.addColorStop(1, "#10202c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 8; i++) {
    const x = i * 76 - 40;
    const top = 160 + ((i * 173) % 260);
    ctx.fillStyle = i % 2 ? "#17242d" : "#0e1c26";
    ctx.fillRect(x, top, 64, 670 - top);
    for (let row = 0; row < 5; row++) {
      ctx.fillStyle = (i + row) % 3 ? "#2a3b40" : "#b58e52";
      ctx.fillRect(x + 18, top + 30 + row * 45, 12, 19);
    }
  }
  for (const x of [110, 390]) {
    const glow = ctx.createRadialGradient(x, 550, 4, x, 550, 105);
    glow.addColorStop(0, "#f1d8a0");
    glow.addColorStop(0.1, "#c3a76b80");
    glow.addColorStop(1, "#c3a76b00");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 105, 445, 210, 210);
    const reflection = ctx.createLinearGradient(0, 660, 0, 1024);
    reflection.addColorStop(0, "#b6a16b88");
    reflection.addColorStop(1, "#b6a16b00");
    ctx.fillStyle = reflection;
    ctx.fillRect(x - 8, 660, 16, 364);
  }
  ctx.strokeStyle = "#a0c7db35";
  ctx.lineWidth = 1;
  for (let i = 0; i < 120; i++) {
    const x = (i * 131) % 512, y = (i * 227) % 1024;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 6, y + 28);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class BarScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly composer: EffectComposer;
  private readonly fly = new FlyModel();
  private readonly mug = new THREE.Group();
  private readonly bartender = bartenderHand();
  private readonly spill: THREE.Group;
  private bartenderT = -1;
  private served: (() => void) | null = null;
  private handLoomed = false;
  onBartenderLoom: () => void = () => {};
  private readonly beer: THREE.Mesh;
  private readonly foam: THREE.Mesh;
  private readonly doorHinge = new THREE.Group();
  private readonly rainLight: THREE.PointLight;
  private readonly receipt: THREE.Mesh;
  private readonly receiptMap: THREE.Texture;
  private readonly smoke: THREE.Sprite[] = [];
  private readonly cig = new THREE.Group();
  private readonly ember: THREE.Mesh;
  /** the smoke he blows out after a drag */
  private readonly puffs: { sprite: THREE.Sprite; vel: THREE.Vector3; age: number; life: number }[] = [];
  /** called once each time he takes a drag, so the page can note it */
  onDrag: () => void = () => {};
  /** seconds until he next reaches for the cigarette */
  private smokeIn = 9;
  /** seconds into the current cigarette break, or -1 when he is not smoking */
  private smokeT = -1;
  private dragged = false;
  private exhaled = false;
  private smokeFumble = false;
  private fumbled = false;
  onCigaretteMishap: () => void = () => {};
  /** whoever came in: a second fly, hidden until someone arrives */
  private readonly guest = new FlyModel();
  private readonly guestColors: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
  private guestPhase: "away" | "in" | "sit" | "out" = "away";
  private guestT = 0;
  private guestFraming = 0;
  private guestLanded: (() => void) | null = null;
  private readonly restL: THREE.Vector3;
  private readonly restR: THREE.Vector3;
  private readonly canvas: HTMLCanvasElement;
  private t = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color("#101510");
    this.scene.fog = new THREE.Fog("#101510", 14, 32);
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(environment, 0.04).texture;
    this.scene.environmentIntensity = 0.1;
    environment.dispose();
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
    this.camera.position.set(-3.5, SEAT + 2.1, -7.6);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0.9, SEAT + 1.1, 1.0);
    this.controls.enablePan = false;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 14;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.update();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.08, 0.35, 2));
    this.composer.addPass(new OutputPass());

    const wood = woodMaterial();
    const darkWood = wood.clone();
    darkWood.color.set("#403126");
    darkWood.roughness = 0.8;
    const wall = new THREE.MeshStandardMaterial({ color: "#314038", roughness: 0.95 });
    const leather = new THREE.MeshPhysicalMaterial({ color: "#4c2321", roughness: 0.66, sheen: 0.25 });
    const steel = new THREE.MeshStandardMaterial({ color: "#655a4c", roughness: 0.42, metalness: 0.8 });
    const brass = new THREE.MeshStandardMaterial({ color: "#b39458", roughness: 0.36, metalness: 0.85 });

    // room
    const floorMat = darkWood.clone();
    floorMat.map = wood.map!.clone();
    floorMat.map.repeat.set(12, 12);
    floorMat.normalMap = null;
    floorMat.roughnessMap = null;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), wall);
    back.position.set(0, 6, 6);
    back.rotation.y = Math.PI;
    this.scene.add(back);
    dressRoom(this.scene, wood, brass);

    // counter: a slab that overhangs a recessed base
    const slab = new THREE.Mesh(new THREE.BoxGeometry(16, 0.14, 1.9), wood);
    slab.position.set(0, COUNTER - 0.07, -1.4);
    slab.receiveShadow = true;
    slab.castShadow = true;
    this.scene.add(slab);
    const base = new THREE.Mesh(new THREE.BoxGeometry(16, COUNTER - 0.14, 1.2), darkWood);
    base.position.set(0, (COUNTER - 0.14) / 2, -1.7);
    this.scene.add(base);
    const nosing = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 16, 20), wood);
    nosing.rotation.z = Math.PI / 2;
    nosing.position.set(0, COUNTER - 0.07, -2.34);
    this.scene.add(nosing);
    const footRail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 16, 16), brass);
    footRail.rotation.z = Math.PI / 2;
    footRail.position.set(0, 0.38, -0.77);
    this.scene.add(footRail);

    // stools along the bar; his is the one at x = 0
    for (let i = -2; i <= 3; i++) {
      const stool = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.0, 0.22, 40), leather);
      seat.position.y = SEAT - 0.11;
      seat.castShadow = true;
      seat.receiveShadow = true;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, SEAT - 0.22, 16), steel);
      post.position.y = (SEAT - 0.22) / 2;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.06, 32), steel);
      foot.position.y = 0.03;
      stool.add(seat, post, foot);
      const piping = new THREE.Mesh(new THREE.TorusGeometry(1.025, 0.018, 8, 48), leather);
      piping.rotation.x = Math.PI / 2;
      piping.position.y = SEAT - 0.015;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 32), steel);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.55;
      stool.add(piping, ring);
      stool.position.set(i * 2.6, 0, 0.3);
      this.scene.add(stool);
    }

    // the sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 1.22), new THREE.MeshBasicMaterial({ map: signTexture() }));
    sign.position.set(1.4, SEAT + 3.3, 5.95);
    sign.rotation.y = Math.PI;
    this.scene.add(sign);
    const signGlow = new THREE.PointLight("#ffb347", 9, 9, 2);
    signGlow.position.set(1.4, SEAT + 3.2, 5.2);
    this.scene.add(signGlow);

    // the door, in the back wall to his right, with a wet street behind it
    const doorX = 5.6;
    const street = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 4.2), new THREE.MeshBasicMaterial({ map: streetTexture() }));
    street.position.set(doorX, 2.1, 5.99);
    street.rotation.y = Math.PI;
    this.scene.add(street);
    for (const side of [-1, 1]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.45, 0.18), wood);
      frame.position.set(doorX + side * 1.08, 2.22, 5.84);
      this.scene.add(frame);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 0.18), wood);
    lintel.position.set(doorX, 4.4, 5.84);
    this.scene.add(lintel);
    this.doorHinge.position.set(doorX + 1.0, 0, 5.9);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 4.2, 0.1), new THREE.MeshStandardMaterial({ color: "#2a1a10", roughness: 0.6 }));
    leaf.position.set(-1.0, 2.1, 0);
    leaf.castShadow = true;
    this.doorHinge.add(leaf);
    const doorWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.8), new THREE.MeshPhysicalMaterial({ color: "#233c45", roughness: 0.35, metalness: 0.3, clearcoat: 1 }));
    doorWindow.position.set(-1, 2.75, -0.056);
    doorWindow.rotation.y = Math.PI;
    const doorKnob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), brass);
    doorKnob.position.set(-1.75, 1.8, -0.11);
    this.doorHinge.add(doorWindow, doorKnob);
    this.scene.add(this.doorHinge);
    this.rainLight = new THREE.PointLight("#7fb2e6", 0, 14, 1.6);
    this.rainLight.position.set(doorX, 2.4, 5.2);
    this.scene.add(this.rainLight);

    // light: one pendant over his stool, and just enough fill to read the room
    this.scene.add(new THREE.HemisphereLight("#dce2d5", "#31241b", 0.45));
    const pendant = new THREE.SpotLight("#ffe0b0", 42, 14, 0.75, 0.7, 1.6);
    pendant.position.set(-0.4, SEAT + 4.2, -1.4);
    pendant.target.position.set(0, SEAT, -0.3);
    pendant.castShadow = true;
    pendant.shadow.mapSize.set(1024, 1024);
    this.scene.add(pendant, pendant.target);
    for (const x of [-3.3, -0.4, 2.7]) {
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.33, 32, 1, true), new THREE.MeshStandardMaterial({ color: "#264139", metalness: 0.65, roughness: 0.4, side: THREE.DoubleSide }));
      shade.position.set(x, SEAT + 3.55, -1.2);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff0cf").multiplyScalar(3) }));
      bulb.position.copy(shade.position).y -= 0.15;
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.5, 6), steel);
      cable.position.set(x, SEAT + 4.95, -1.2);
      this.scene.add(shade, bulb, cable);
    }
    const face = new THREE.PointLight("#ffdfb7", 4, 6, 2);
    face.position.set(-1.2, SEAT + 1.2, -2.6);
    this.scene.add(face);
    const rimLight = new THREE.SpotLight("#aac9cc", 10, 12, 0.6, 0.85, 2);
    rimLight.position.set(2.8, SEAT + 2.8, 2.2);
    rimLight.target.position.set(0, SEAT + 1, 0);
    this.scene.add(rimLight, rimLight.target);

    // the mug, under his mouth
    const mug = this.mug;
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.19, MUG_H, 32, 1, true),
      new THREE.MeshPhysicalMaterial({ color: "#e8eee2", roughness: 0.08, transmission: 0.92, thickness: 0.035, ior: 1.48, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    );
    glass.position.y = MUG_H / 2;
    // a rim and a thick base so the empty still reads as a mug on a dark bar
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 8, 32), new THREE.MeshStandardMaterial({ color: "#e8f4f8", roughness: 0.15, metalness: 0.3 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = MUG_H;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 32), rim.material);
    foot.position.y = 0.015;
    mug.add(rim, foot);
    const beerGeo = new THREE.CylinderGeometry(0.185, 0.175, MUG_H - 0.04, 32);
    beerGeo.translate(0, (MUG_H - 0.04) / 2, 0);
    this.beer = new THREE.Mesh(beerGeo, new THREE.MeshStandardMaterial({ color: "#e09a22", roughness: 0.2, emissive: "#6b3d05", emissiveIntensity: 0.6 }));
    this.beer.position.y = 0.02;
    this.foam = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.185, 0.05, 32), new THREE.MeshStandardMaterial({ color: "#fff6dd", roughness: 0.9 }));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 10, 24, Math.PI), glass.material);
    handle.position.set(0.2, MUG_H / 2, 0);
    handle.rotation.z = -Math.PI / 2;
    mug.add(glass, this.beer, this.foam, handle);
    mug.position.copy(MUG_REST);
    this.scene.add(mug);
    this.scene.add(this.bartender);
    // a scan of a real hand, if the file is present; otherwise the built one stays
    void useScannedHand(this.bartender).catch(() => {});
    this.spill = dressRegularCorner(this.scene, COUNTER);
    const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.008, 40), new THREE.MeshStandardMaterial({ map: labelTexture("BARFLY", "RESERVED SINCE FOREVER"), color: "#c9ad7e", roughness: 1 }));
    coaster.position.set(0, COUNTER + 0.004, -0.72);
    this.scene.add(coaster);

    // smokes: ashtray, a lit cigarette, the pack
    const dish = [new THREE.Vector2(0, 0.014), new THREE.Vector2(0.23, 0.014), new THREE.Vector2(0.29, 0.075), new THREE.Vector2(0.3, 0.08), new THREE.Vector2(0.29, 0), new THREE.Vector2(0, 0)];
    const ashtray = new THREE.Mesh(new THREE.LatheGeometry(dish, 40), new THREE.MeshStandardMaterial({ color: "#879286", roughness: 0.23, metalness: 0.65 }));
    ashtray.position.set(-1.05, COUNTER + 0.004, -0.95);
    for (let i = 0; i < 28; i++) {
      const angle = i * Math.PI * 2 / 28;
      const crimp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.065, 0.018), ashtray.material);
      crimp.position.set(Math.sin(angle) * 0.29, 0.046, Math.cos(angle) * 0.29);
      crimp.rotation.y = angle;
      crimp.castShadow = true;
      ashtray.add(crimp);
    }
    ashtray.castShadow = true;
    this.scene.add(ashtray);
    // the cigarette is one piece so he can pick it up: filter at -y, ember at +y
    const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 10), new THREE.MeshStandardMaterial({ color: "#f3efe6", roughness: 0.8 }));
    this.ember = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: "#ff6a1f" }));
    this.ember.position.y = 0.21;
    this.cig.add(paper, this.ember);
    const filter = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.105, 12), new THREE.MeshStandardMaterial({ color: "#b99155", roughness: 0.8 }));
    filter.position.y = -0.16;
    this.cig.add(filter);
    this.cig.position.copy(CIG_REST);
    this.cig.rotation.z = CIG_REST_TILT;
    this.scene.add(this.cig);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: "#a31a1a", roughness: 0.6 }));
    pack.position.set(-1.6, COUNTER + 0.05, -1.25);
    pack.rotation.y = 0.4;
    this.scene.add(pack);
    const packLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.38), new THREE.MeshStandardMaterial({ map: labelTexture("LAST", "LIGHT"), roughness: 0.9 }));
    packLabel.rotation.x = -Math.PI / 2;
    packLabel.position.y = 0.051;
    pack.add(packLabel);
    const smokeMat = smokeTexture();
    for (let i = 0; i < 44; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMat, color: "#cfd6e2", transparent: true, depthWrite: false, opacity: 0 }));
      this.smoke.push(s);
      this.scene.add(s);
    }
    for (let i = 0; i < 18; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMat, color: "#d9dee6", transparent: true, depthWrite: false, opacity: 0 }));
      this.puffs.push({ sprite, vel: new THREE.Vector3(), age: 99, life: 1 });
      this.scene.add(sprite);
    }

    // the tab: a receipt that gets longer with every beer
    this.receiptMap = receiptTexture();
    const receiptGeo = new THREE.PlaneGeometry(0.34, 1);
    receiptGeo.translate(0, -0.5, 0);
    this.receipt = new THREE.Mesh(receiptGeo, new THREE.MeshStandardMaterial({ map: this.receiptMap, roughness: 0.9, side: THREE.DoubleSide }));
    this.receipt.rotation.x = -Math.PI / 2;
    this.receipt.position.set(1.1, COUNTER + 0.005, -0.55);
    this.scene.add(this.receipt);

    // him
    this.fly.root.position.set(0, SEAT, 0);
    this.scene.add(this.fly.root);
    this.fly.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = !((o as THREE.Mesh).material as THREE.Material).transparent;
    });
    // front feet rest on the counter either side of the mug (fly space)
    this.restL = new THREE.Vector3(-0.45, COUNTER - SEAT, -0.9);
    this.restR = new THREE.Vector3(0.45, COUNTER - SEAT, -0.9);

    // the visitor: the same fly, a touch smaller, tinted per visitor when he arrives
    this.guest.root.scale.setScalar(0.9);
    this.guest.root.visible = false;
    this.scene.add(this.guest.root);
    this.guest.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = !(mesh.material as THREE.Material).transparent;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.color && !this.guestColors.some((g) => g.mat === mat)) this.guestColors.push({ mat, base: mat.color.clone() });
    });

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  get serving(): boolean {
    return this.bartenderT >= 0;
  }

  serveBeer(): Promise<void> {
    this.bartenderT = 0;
    this.handLoomed = false;
    this.bartender.visible = true;
    this.mug.position.copy(SERVE_FROM);
    return new Promise(resolve => { this.served = resolve; });
  }

  private updateBartender(dt: number): void {
    if (this.bartenderT < 0) return;
    this.bartenderT += dt;
    const T = this.bartenderT;
    const ease = (x: number) => {
      const c = Math.min(1, Math.max(0, x));
      return c * c * (3 - 2 * c);
    };
    const approach = ease(T / 1.1);
    const place = ease((T - 0.8) / 0.9);
    this.mug.position.lerpVectors(SERVE_FROM, SERVE_MUG_START, approach).lerp(MUG_REST, place);
    this.mug.rotation.z = 0.04 * Math.sin(T * 5) * (1 - place);
    const handScale = (this.bartender.userData.scale as number) ?? 1;
    this.bartender.rotation.set(0, SERVE_YAW, (this.bartender.userData.tilt as number) ?? 0);
    this.bartender.scale.setScalar(handScale);
    // where the hand has to be for the mug to sit in its grip, turned to match the hand
    const offset = (this.bartender.userData.grip as THREE.Vector3).clone().multiplyScalar(handScale).applyEuler(this.bartender.rotation);
    this.bartender.position.copy(this.mug.position).add(offset);
    if (T > 0.75 && !this.handLoomed) {
      this.handLoomed = true;
      this.onBartenderLoom();
    }
    if (T >= 1.7 && this.served) {
      this.served();
      this.served = null;
    }
    const withdraw = ease((T - 2) / 1.2);
    this.bartender.position.lerp(new THREE.Vector3(SERVE_FROM.x, SERVE_FROM.y + 1.0, SERVE_FROM.z), withdraw);
    if (T >= 3.2) {
      this.bartenderT = -1;
      this.bartender.visible = false;
      this.mug.position.copy(MUG_REST);
      this.mug.rotation.z = 0;
    }
  }

  /** Someone flies in through the door and lands on the next stool. Resolves once he has landed. */
  guestArrive(tint: string): Promise<void> {
    const t = new THREE.Color(tint);
    for (const g of this.guestColors) g.mat.color.copy(g.base).lerp(t, 0.4);
    this.guestPhase = "in";
    this.guestT = 0;
    this.guest.root.visible = true;
    return new Promise((resolve) => (this.guestLanded = resolve));
  }

  /** He takes off and goes back out the way he came. */
  guestLeave(): void {
    if (this.guestPhase === "away" || this.guestPhase === "out") return;
    this.guestLanded?.();
    this.guestLanded = null;
    this.guestPhase = "out";
    this.guestT = 0;
  }

  private updateGuest(dt: number, talking: boolean): void {
    if (this.guestPhase === "away") return;
    this.guestT += dt;
    const root = this.guest.root;
    const smooth = (x: number) => {
      const c = Math.min(1, Math.max(0, x));
      return c * c * (3 - 2 * c);
    };
    // where he is along the one curve from the door to above his stool, and which way that curve points
    const along = (u: number) => {
      const a = GUEST_DOOR.clone().lerp(GUEST_OVER, u);
      const b = GUEST_OVER.clone().lerp(GUEST_HOVER, u);
      return { at: a.clone().lerp(b, u), toward: b.sub(a) };
    };
    const yawOf = (dir: THREE.Vector3) => Math.atan2(-dir.x, -dir.z);

    let wings = 1;
    const sitting = this.guestPhase === "sit";
    if (sitting) {
      root.position.copy(GUEST_SEAT);
      root.rotation.y = GUEST_YAW;
      root.rotation.z = 0;
      wings = 0;
    } else if (this.guestPhase === "in") {
      const { at, toward } = along(smooth(this.guestT / GUEST_FLY_S));
      const recovery = this.guestT - GUEST_FLY_S;
      const settle = smooth((recovery - GUEST_RECOVER_S) / GUEST_SETTLE_S);
      if (recovery > 0 && recovery < 0.55) {
        at.lerpVectors(GUEST_HOVER, GUEST_MISS, smooth(recovery / 0.55));
      } else if (recovery >= 0.55) {
        const u = smooth((recovery - 0.55) / (GUEST_RECOVER_S - 0.55));
        const loop = new THREE.Vector3(3.65, SEAT + 1.45, -0.75);
        at.copy(GUEST_MISS).lerp(loop, u).lerp(loop.clone().lerp(GUEST_HOVER, u), u);
      }
      at.y -= (GUEST_HOVER.y - GUEST_SEAT.y) * settle;
      at.y += 0.06 * Math.sin(this.t * 9) * (1 - settle);
      root.position.copy(at);
      const turn = smooth((this.guestT - GUEST_FLY_S * 0.7) / (GUEST_FLY_S * 0.3 + GUEST_RECOVER_S + GUEST_SETTLE_S));
      const heading = yawOf(toward);
      root.rotation.y = heading + (GUEST_YAW - heading) * turn;
      root.rotation.z = 0.35 * Math.sin(Math.PI * Math.min(1, Math.max(0, recovery) / GUEST_RECOVER_S)) * (1 - settle);
      wings = 1 - settle;
      if (this.guestT >= GUEST_FLY_S + GUEST_RECOVER_S + GUEST_SETTLE_S) {
        this.guestPhase = "sit";
        this.guestLanded?.();
        this.guestLanded = null;
      }
    } else {
      root.rotation.z = 0;
      // lift off the stool, then fly the same curve back to the door
      const lift = smooth(this.guestT / GUEST_SETTLE_S);
      const { at, toward } = along(1 - smooth((this.guestT - GUEST_SETTLE_S) / GUEST_FLY_S));
      at.y -= (GUEST_HOVER.y - GUEST_SEAT.y) * (1 - lift);
      at.y += 0.06 * Math.sin(this.t * 9) * lift;
      root.position.copy(at);
      const away = yawOf(toward.multiplyScalar(-1));
      root.rotation.y = GUEST_YAW + (away - GUEST_YAW) * smooth(this.guestT / (GUEST_SETTLE_S + 0.6));
      if (this.guestT >= GUEST_SETTLE_S + GUEST_FLY_S) {
        this.guestPhase = "away";
        root.visible = false;
      }
    }

    // sitting, his front feet go up on the counter like the regular's; in the air the legs hang
    let footL: THREE.Vector3 | null = null;
    let footR: THREE.Vector3 | null = null;
    if (sitting) {
      root.updateMatrixWorld();
      footL = root.worldToLocal(new THREE.Vector3(GUEST_SEAT.x - 0.75, COUNTER, -0.7));
      footR = root.worldToLocal(new THREE.Vector3(GUEST_SEAT.x + 0.05, COUNTER, -0.95));
    }
    this.guest.update(dt, {
      pressL: footL,
      pressR: footR,
      reachL: sitting ? 1 : 0,
      reachR: sitting ? 1 : 0,
      proboscis: 0,
      startle: 0.25,
      buzz: wings,
      lookX: 0,
      bob: talking && sitting ? 0.5 + 0.5 * Math.sin(this.t * 14) : 0,
      drunk: 0,
    });
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    // keep the scene centred in the space the side panel leaves free
    const panel = w > 700 ? Math.min(300, w - 32) + 16 : Math.min(110, w * 0.28);
    this.camera.fov = w > 700 ? 34 : 38;
    this.camera.aspect = (w + panel) / h;
    this.camera.setViewOffset(w + panel, h, panel, 0, w, h);
    this.camera.updateProjectionMatrix();
  }

  render(dt: number, s: BarState): void {
    this.t += dt;
    this.updateBartender(dt);
    this.spill.scale.set(1 + Math.min(0.45, s.tab * 0.035), 1, 1 + Math.min(0.25, s.tab * 0.02));

    const level = this.served ? 1 : Math.max(0, Math.min(1, s.beer));
    this.beer.scale.y = Math.max(0.001, level);
    this.beer.visible = level > 0.005;
    this.foam.visible = level > 0.02;
    this.foam.position.y = 0.02 + (MUG_H - 0.04) * level + 0.02;

    this.doorHinge.rotation.y = -s.door * 1.9;
    this.rainLight.intensity = 60 * s.door;

    // the receipt runs along the counter and then off the customer's edge
    const len = 0.6 + 0.22 * s.tab;
    this.receipt.scale.y = len;
    this.receiptMap.repeat.set(1, len);

    // He smokes on a timer, a little more often the drunker he is. This is animation, not his brain.
    // One break: reach for it, lift it, drag, put it back, blow the smoke out.
    const idle = s.proboscis < 0.15 && s.startle < 0.15 && !s.talking;
    if (this.smokeT < 0) {
      this.smokeIn -= dt;
      if (this.smokeIn <= 0 && idle) {
        this.smokeT = 0;
        this.dragged = this.exhaled = false;
        this.smokeFumble = s.drunk > 0.25 && Math.random() < 0.3 + 0.6 * s.drunk;
        this.fumbled = false;
      }
    } else {
      this.smokeT += dt;
      // a flinch makes him put it straight back down
      const putDown = this.smokeFumble ? 5.8 : 3.2;
      if (s.startle > 0.4 && this.smokeT < putDown) this.smokeT = this.smokeT < 0.8 ? putDown + 1 : putDown;
      if (this.smokeT >= (this.smokeFumble ? 7.6 : 5)) {
        this.smokeT = -1;
        this.smokeIn = (20 + Math.random() * 25) * (1 - 0.35 * s.drunk);
      }
    }
    const T = this.smokeT;
    const ease = (x: number) => {
      const c = Math.min(1, Math.max(0, x));
      return c * c * (3 - 2 * c);
    };
    const putDown = this.smokeFumble ? 5.8 : 3.2;
    const dragAt = this.smokeFumble ? 4.5 : 1.9;
    const reach = T < 0 ? 0 : ease(T / 0.8) * (1 - ease((T - putDown - 1) / 0.8));
    const lift = T < 0 ? 0 : ease((T - 0.8) / 1.0) * (1 - ease((T - putDown) / 1.0));
    const drag = T < 0 ? 0 : ease((T - dragAt) / 0.3) * (1 - ease((T - dragAt - 1) / 0.3));
    const miss = this.smokeFumble && T >= 0 ? ease((T - 1.7) / 0.25) * (1 - ease((T - 2.35) / 0.3)) : 0;
    const inspect = this.smokeFumble && T >= 0 ? ease((T - 2.35) / 0.35) * (1 - ease((T - 3.5) / 0.4)) : 0;
    if (T > 1.8 && T < 2.4 && this.smokeFumble && !this.fumbled) {
      this.fumbled = true;
      this.onCigaretteMishap();
    }
    if (T > dragAt && T < putDown && !this.dragged) {
      this.dragged = true;
      this.onDrag();
    }

    this.cig.position.lerpVectors(CIG_REST, CIG_AT_MOUTH, lift);
    this.cig.position.y += Math.sin(Math.PI * lift) * 0.15;
    this.cig.position.x -= miss * 0.2 + inspect * 0.28;
    this.cig.position.y -= miss * 0.18 + inspect * 0.1;
    this.cig.position.z -= inspect * 0.12;
    this.cig.rotation.z = CIG_REST_TILT + (Math.PI / 2 - CIG_REST_TILT) * lift + Math.PI * inspect + 0.18 * miss;
    this.cig.updateMatrixWorld(true);
    this.ember.scale.setScalar(1 + 1.4 * drag);
    (this.ember.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.42 + 0.4 * drag, 0.12 + 0.3 * drag);
    const tip = this.ember.getWorldPosition(new THREE.Vector3());
    // his left front foot follows the cigarette (fly space: he sits at the stool, unrotated)
    const grip = this.cig.position.clone().sub(this.fly.root.position);
    grip.y -= 0.02;
    const hand = this.restL.clone().lerp(grip, reach);

    if (T > putDown + 0.3 && !this.exhaled && this.dragged) {
      this.exhaled = true;
      this.puffs.forEach((p, i) => {
        p.age = -i * 0.035;
        p.life = 1.6 + Math.random() * 0.9;
        p.sprite.position.set(0, SEAT + 0.88, -0.84);
        p.vel.set((Math.random() - 0.5) * 0.5, 0.2 + Math.random() * 0.3, -(0.9 + Math.random() * 0.6));
      });
    }
    for (const p of this.puffs) {
      p.age += dt;
      const mat = p.sprite.material as THREE.SpriteMaterial;
      if (p.age < 0 || p.age > p.life) {
        mat.opacity = 0;
        continue;
      }
      p.sprite.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.max(0, 1 - 1.3 * dt));
      p.vel.y += 0.12 * dt;
      const size = 0.08 + p.age * 0.5;
      p.sprite.scale.set(size, size, 1);
      mat.opacity = 0.55 * Math.min(1, p.age * 8) * (1 - p.age / p.life);
    }

    // a thin thread off the ember that wavers, then breaks up and spreads under the lamp;
    // it thins out while the cigarette is in his hand
    this.smoke.forEach((sp, i) => {
      const life = (this.t * 0.11 + i / this.smoke.length) % 1;
      const rise = life * 3.4;
      const sway = life * life * 0.55;
      sp.position.set(
        tip.x + sway * Math.sin(rise * 2.6 + this.t * 0.7) + 0.05 * Math.sin(i * 12.9),
        tip.y + 0.02 + rise,
        tip.z + sway * 0.6 * Math.cos(rise * 2.1 + this.t * 0.5 + i),
      );
      const size = 0.05 + life * life * 0.85;
      sp.scale.set(size, size * 1.3, 1);
      (sp.material as THREE.SpriteMaterial).opacity = 0.4 * Math.min(1, life * 14) * (1 - life) ** 1.6 * (1 - 0.8 * lift);
    });

    this.fly.update(dt, {
      pressL: hand,
      pressR: this.restR,
      reachL: 1,
      reachR: 1,
      proboscis: s.proboscis,
      startle: s.startle,
      buzz: s.startle * 0.5,
      // he glances at the ashtray as he reaches for it
      lookX: -0.6 * reach * (1 - 0.7 * lift) - 0.5 * inspect,
      bob: s.talking ? 0.5 + 0.5 * Math.sin(this.t * 13) : 0,
      drunk: s.drunk,
    });

    this.updateGuest(dt, s.guestTalking);

    const compact = this.canvas.clientWidth <= 700;
    this.guestFraming += ((compact && this.guest.root.visible ? 1 : 0) - this.guestFraming) * (1 - Math.exp(-dt / 0.4));
    const fov = compact ? 38 + 20 * this.guestFraming : 34;
    if (Math.abs(this.camera.fov - fov) > 0.001) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.controls.target.x = 0.9 + 1.2 * this.guestFraming;
    this.controls.update();
    this.composer.render(dt);
  }
}
