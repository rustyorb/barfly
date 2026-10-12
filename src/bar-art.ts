import * as THREE from "three";

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

export function bartenderHand(): THREE.Group {
  const hand = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({ color: "#bd8c6d", roughness: 0.7, sheen: 0.18 });
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), skin);
  palm.scale.set(0.46, 0.23, 0.37);
  hand.add(palm);
  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.9, 8, 16), skin);
  wrist.rotation.z = -Math.PI / 2;
  wrist.position.x = 0.72;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.26, 0.25, 24), new THREE.MeshStandardMaterial({ color: "#e0d8bc", roughness: 0.85 }));
  sleeve.rotation.z = Math.PI / 2;
  sleeve.position.x = 0.89;
  hand.add(wrist, sleeve);
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Group();
    finger.position.set(-0.29, 0, -0.27 + i * 0.17);
    const length = 0.32 + Math.sin((i + 1) * Math.PI / 5) * 0.11;
    const first = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, length, 6, 12), skin);
    first.rotation.z = Math.PI / 2 + 0.15;
    first.position.x = -length / 2;
    const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.19, 6, 12), skin);
    tip.rotation.z = -0.45;
    tip.position.set(-length, -0.15, 0);
    finger.add(first, tip);
    hand.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 8, 16), skin);
  thumb.rotation.set(0.45, 0, -0.65);
  thumb.position.set(-0.22, -0.2, 0.38);
  hand.add(thumb);
  hand.scale.setScalar(1.65);
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
