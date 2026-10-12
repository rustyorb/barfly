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
  ctx.fillText(title, 128, 114);
  ctx.font = "18px Georgia";
  ctx.fillText(subtitle, 128, 153);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
