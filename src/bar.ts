// The bar: one stool, one mug, one door. Seen from the bartender's side of the counter.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FlyModel } from "./fly3d/fly.ts";

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

function signTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 320;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2a0d0a";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#b3261c";
  g.lineWidth = 18;
  g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.font = "bold 210px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "#ffb347";
  g.shadowBlur = 40;
  g.fillStyle = "#ffd68a";
  g.fillText("BARFLY", c.width / 2, c.height / 2 + 10);
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
  for (let y = 14; y < c.height; y += 18) g.fillRect(12, y, 30 + ((y * 37) % 70), 3);
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

export class BarScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly fly = new FlyModel();
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
  private readonly restL: THREE.Vector3;
  private readonly restR: THREE.Vector3;
  private readonly canvas: HTMLCanvasElement;
  private t = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color("#0b0705");
    this.scene.fog = new THREE.Fog("#0b0705", 9, 22);

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
    this.camera.position.set(-3.6, SEAT + 2.3, -7.2);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(1.2, SEAT + 1.0, 1.0);
    this.controls.enablePan = false;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 14;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.update();

    const wood = new THREE.MeshStandardMaterial({ color: "#3b2113", roughness: 0.35, metalness: 0.1 });
    const darkWood = new THREE.MeshStandardMaterial({ color: "#1f120b", roughness: 0.7 });
    const wall = new THREE.MeshStandardMaterial({ color: "#1c2a22", roughness: 0.95 });
    const leather = new THREE.MeshStandardMaterial({ color: "#5a1414", roughness: 0.5 });
    const steel = new THREE.MeshStandardMaterial({ color: "#3a3532", roughness: 0.4, metalness: 0.8 });

    // room
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: "#16100c", roughness: 0.25, metalness: 0.3 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), wall);
    back.position.set(0, 6, 6);
    back.rotation.y = Math.PI;
    this.scene.add(back);

    // counter: a slab that overhangs a recessed base
    const slab = new THREE.Mesh(new THREE.BoxGeometry(16, 0.14, 1.9), wood);
    slab.position.set(0, COUNTER - 0.07, -1.4);
    slab.receiveShadow = true;
    slab.castShadow = true;
    this.scene.add(slab);
    const base = new THREE.Mesh(new THREE.BoxGeometry(16, COUNTER - 0.14, 1.2), darkWood);
    base.position.set(0, (COUNTER - 0.14) / 2, -1.7);
    this.scene.add(base);

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
      stool.position.set(i * 2.6, 0, 0.3);
      this.scene.add(stool);
    }

    // the sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.6), new THREE.MeshBasicMaterial({ map: signTexture() }));
    sign.position.set(1.4, SEAT + 3.3, 5.95);
    sign.rotation.y = Math.PI;
    this.scene.add(sign);
    const signGlow = new THREE.PointLight("#ffb347", 14, 9, 2);
    signGlow.position.set(1.4, SEAT + 3.2, 5.2);
    this.scene.add(signGlow);

    // the door, in the back wall to his right, with a wet street behind it
    const doorX = 5.6;
    const street = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 4.2), new THREE.MeshBasicMaterial({ color: "#3d6ea8" }));
    street.position.set(doorX, 2.1, 5.99);
    street.rotation.y = Math.PI;
    this.scene.add(street);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 4.5, 0.12), darkWood);
    frame.position.set(doorX, 2.25, 6.02);
    this.scene.add(frame);
    this.doorHinge.position.set(doorX + 1.0, 0, 5.9);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 4.2, 0.1), new THREE.MeshStandardMaterial({ color: "#2a1a10", roughness: 0.6 }));
    leaf.position.set(-1.0, 2.1, 0);
    leaf.castShadow = true;
    this.doorHinge.add(leaf);
    this.scene.add(this.doorHinge);
    this.rainLight = new THREE.PointLight("#7fb2e6", 0, 14, 1.6);
    this.rainLight.position.set(doorX, 2.4, 5.2);
    this.scene.add(this.rainLight);

    // light: one pendant over his stool, and just enough fill to read the room
    this.scene.add(new THREE.HemisphereLight("#ffd9a8", "#120a06", 0.35));
    const pendant = new THREE.SpotLight("#ffc27a", 90, 14, 0.75, 0.6, 1.6);
    pendant.position.set(-0.4, SEAT + 4.2, -1.4);
    pendant.target.position.set(0, SEAT, -0.3);
    pendant.castShadow = true;
    pendant.shadow.mapSize.set(1024, 1024);
    this.scene.add(pendant, pendant.target);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.45, 24, 1, true), steel);
    shade.position.copy(pendant.position);
    this.scene.add(shade);
    const face = new THREE.PointLight("#ffb070", 5, 6, 2);
    face.position.set(-1.2, SEAT + 1.2, -2.6);
    this.scene.add(face);

    // the mug, under his mouth
    const mug = new THREE.Group();
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.19, MUG_H, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: "#cfe3ea", roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
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
    mug.position.set(0, COUNTER, -0.72);
    this.scene.add(mug);

    // smokes: ashtray, a lit cigarette, the pack
    const ashtray = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.08, 28), new THREE.MeshStandardMaterial({ color: "#15130f", roughness: 0.3, metalness: 0.6 }));
    ashtray.position.set(-1.05, COUNTER + 0.04, -0.95);
    this.scene.add(ashtray);
    // the cigarette is one piece so he can pick it up: filter at -y, ember at +y
    const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 10), new THREE.MeshStandardMaterial({ color: "#f3efe6", roughness: 0.8 }));
    this.ember = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: "#ff6a1f" }));
    this.ember.position.y = 0.21;
    this.cig.add(paper, this.ember);
    this.cig.position.copy(CIG_REST);
    this.cig.rotation.z = CIG_REST_TILT;
    this.scene.add(this.cig);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: "#a31a1a", roughness: 0.6 }));
    pack.position.set(-1.6, COUNTER + 0.05, -1.25);
    pack.rotation.y = 0.4;
    this.scene.add(pack);
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
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    // front feet rest on the counter either side of the mug (fly space)
    this.restL = new THREE.Vector3(-0.45, COUNTER - SEAT, -0.9);
    this.restR = new THREE.Vector3(0.45, COUNTER - SEAT, -0.9);

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    // keep the scene centred in the space the side panel leaves free
    const panel = w > 700 ? Math.min(300, w - 32) + 16 : 0;
    this.camera.aspect = (w + panel) / h;
    this.camera.setViewOffset(w + panel, h, panel, 0, w, h);
    this.camera.updateProjectionMatrix();
  }

  render(dt: number, s: BarState): void {
    this.t += dt;

    const level = Math.max(0, Math.min(1, s.beer));
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
      }
    } else {
      this.smokeT += dt;
      // a flinch makes him put it straight back down
      if (s.startle > 0.4 && this.smokeT < 3.2) this.smokeT = this.smokeT < 0.8 ? 4.2 : 3.2;
      if (this.smokeT >= 5) {
        this.smokeT = -1;
        this.smokeIn = (20 + Math.random() * 25) * (1 - 0.35 * s.drunk);
      }
    }
    const T = this.smokeT;
    const ease = (x: number) => {
      const c = Math.min(1, Math.max(0, x));
      return c * c * (3 - 2 * c);
    };
    const reach = T < 0 ? 0 : ease(T / 0.8) * (1 - ease((T - 4.2) / 0.8)); // his foot is on the cigarette
    const lift = T < 0 ? 0 : ease((T - 0.8) / 1.0) * (1 - ease((T - 3.2) / 1.0)); // the cigarette is at his mouth
    const drag = T < 0 ? 0 : ease((T - 1.9) / 0.3) * (1 - ease((T - 2.9) / 0.3));
    if (T > 1.9 && T < 3.2 && !this.dragged) {
      this.dragged = true;
      this.onDrag();
    }

    this.cig.position.lerpVectors(CIG_REST, CIG_AT_MOUTH, lift);
    this.cig.position.y += Math.sin(Math.PI * lift) * 0.15;
    this.cig.rotation.z = CIG_REST_TILT + (Math.PI / 2 - CIG_REST_TILT) * lift;
    this.cig.updateMatrixWorld(true);
    this.ember.scale.setScalar(1 + 1.4 * drag);
    (this.ember.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.42 + 0.4 * drag, 0.12 + 0.3 * drag);
    const tip = this.ember.getWorldPosition(new THREE.Vector3());
    // his left front foot follows the cigarette (fly space: he sits at the stool, unrotated)
    const grip = this.cig.position.clone().sub(this.fly.root.position);
    grip.y -= 0.02;
    const hand = this.restL.clone().lerp(grip, reach);

    if (T > 3.5 && !this.exhaled && this.dragged) {
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
      const size = 0.05 + life * life * 1.3;
      sp.scale.set(size, size * 1.3, 1);
      (sp.material as THREE.SpriteMaterial).opacity = 0.7 * Math.min(1, life * 14) * (1 - life) ** 1.6 * (1 - 0.8 * lift);
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
      lookX: -0.6 * reach * (1 - 0.7 * lift),
      bob: s.talking ? 0.5 + 0.5 * Math.sin(this.t * 13) : 0,
      drunk: s.drunk,
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
