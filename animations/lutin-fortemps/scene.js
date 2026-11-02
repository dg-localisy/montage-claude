// Scène 3D : un lutin en bois peint tire une corde ; au bout, une luge apporte le bon cadeau Fortemps.
// Tout est une fonction du temps t (secondes) : window.rendre(t) dessine l'image exacte de cet instant.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 1080, H = 1920;
const Y = new THREE.Vector3(0, 1, 0);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
const lerp = (a, b, t) => a + (b - a) * t;
const lisse = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

// ------------------------------------------------------------------ chronologie
export const T = {
  x0: 2.05, v1: 0.72, decA: 0.7,      // entrée par la droite, arrêt au centre
  pause: 2.2,                          // regarde la caméra et fait coucou
  accB: 0.6, v2: 0.95, decB: 2.3,      // repart, sort à gauche ; la luge s'arrête au centre
  ecartLuge: 5.0,                      // distance lutin -> luge (la corde)
  carteX: 0.0,
};
const S3 = (u) => u * u * u - u * u * u * u / 2;              // intégrale de smoothstep
T.dA = T.x0;
T.tcA = (T.dA - T.v1 * T.decA / 2) / T.v1;
T.tStop = T.tcA + T.decA;
T.tB = T.tStop + T.pause;
T.xFin = T.carteX - 0.05 - T.ecartLuge;
T.dB = 0 - T.xFin;
T.tcB = (T.dB - T.v2 * T.accB / 2 - T.v2 * T.decB / 2) / T.v2;
T.tFin = T.tB + T.accB + T.tcB + T.decB;

function distance(t) {
  if (t < 0) return T.v1 * t;
  if (t < T.tcA) return T.v1 * t;
  if (t < T.tStop) { const u = (t - T.tcA) / T.decA; return T.v1 * T.tcA + T.v1 * T.decA * (u - S3(u)); }
  if (t < T.tB) return T.dA;
  let d = T.dA, s = t - T.tB;
  if (s < T.accB) return d + T.v2 * T.accB * S3(s / T.accB);
  d += T.v2 * T.accB / 2; s -= T.accB;
  if (s < T.tcB) return d + T.v2 * s;
  d += T.v2 * T.tcB; s -= T.tcB;
  if (s < T.decB) { const u = s / T.decB; return d + T.v2 * T.decB * (u - u * u / 2); } // freinage linéaire : petit à-coup final
  return T.dA + T.dB;
}
const vitesse = (t) => (distance(t + 1e-3) - distance(t - 1e-3)) / 2e-3;
const accel = (t) => (distance(t + 1e-2) - 2 * distance(t) + distance(t - 1e-2)) / 1e-4;
const bassinX = (t) => T.x0 - distance(t);

// poids des différentes attitudes
const poidsTour = (t) => lisse(T.tStop - 0.15, T.tStop + 0.4, t) * (1 - lisse(T.tB - 0.5, T.tB + 0.05, t));
const poidsCoucou = (t) => lisse(T.tStop + 0.35, T.tStop + 0.65, t) * (1 - lisse(T.tB - 0.85, T.tB - 0.5, t));
const tensionCorde = (t) => 1 - Math.max(poidsTour(t), lisse(T.tFin - 0.05, T.tFin + 0.7, t));

// ressorts simulés (bonnet du lutin, inclinaison de la carte) : précalculés à 240 Hz
const DT = 1 / 240, DUREE = 20;
const simBonnet = [], simCarte = [];
(() => {
  let u = 0, du = 0, c = 0, dc = 0;
  for (let i = 0; i <= DUREE / DT; i++) {
    const t = i * DT;
    const ax = -accel(t);                 // accélération vers -x positive
    const bob = Math.sin(2 * Math.PI * (distance(t) / 0.5)) * clamp(vitesse(t), 0, 1);
    const w1 = 2 * Math.PI * 1.6, w2 = 2 * Math.PI * 1.7;
    du += (-w1 * w1 * u - 2 * 0.18 * w1 * du + 1.4 * ax + 6 * bob) * DT; u += du * DT;
    dc += (-w2 * w2 * c - 2 * 0.12 * w2 * dc - 13.0 * accel(t)) * DT; c += dc * DT;
    simBonnet.push(u); simCarte.push(c);
  }
})();
const echantillon = (tab, t) => { const f = clamp(t / DT, 0, tab.length - 2); const i = Math.floor(f); return lerp(tab[i], tab[i + 1], f - i); };

// ------------------------------------------------------------------ rendu, caméra, lumières
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(22, W / H, 0.1, 100);
camera.position.set(0, 1.2, 11);
camera.lookAt(0, 1.2, 0);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

scene.add(new THREE.HemisphereLight(0xfff1e2, 0xcfc3b6, 0.55));
const cle = new THREE.DirectionalLight(0xfff0de, 2.7);
cle.position.set(-5, 7.5, 7);
cle.target.position.set(0, 0.6, 0);
cle.castShadow = true;
cle.shadow.mapSize.set(2048, 2048);
Object.assign(cle.shadow.camera, { left: -4.5, right: 4.5, top: 4, bottom: -4, near: 1, far: 30 });
cle.shadow.radius = 7; cle.shadow.blurSamples = 20; cle.shadow.bias = -0.0004;
scene.add(cle, cle.target);
const contre = new THREE.DirectionalLight(0xffbf72, 2.4);      // lumière chaude du sapin, par derrière
contre.position.set(3, 4, -6);
const contre2 = new THREE.DirectionalLight(0xffa860, 1.3);
contre2.position.set(-4, 3, -5);
const remplissage = new THREE.DirectionalLight(0xe8eeff, 0.45);
remplissage.position.set(6, 2, 5);
scene.add(contre, contre2, remplissage);

// sol invisible qui ne garde que les ombres
const sol = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: 0x3a2618, opacity: 0.42 }));
sol.rotation.x = -Math.PI / 2;
sol.receiveShadow = true;
scene.add(sol);

// ------------------------------------------------------------------ matières
const peinture = (couleur, rugosite = 0.36, extra = {}) => new THREE.MeshPhysicalMaterial({
  color: couleur, roughness: rugosite, clearcoat: 0.75, clearcoatRoughness: 0.16, ...extra });
function texCanvas(w, h, dessin, rep = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  dessin(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const texRayures = texCanvas(64, 256, (g, w, h) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f6f1ea' : '#c3172a'; g.fillRect(0, i * h / 8, w, h / 8); }
});
const texCorde = texCanvas(64, 64, (g, w, h) => {
  g.fillStyle = '#f4efe6'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#c3172a';
  for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32 + 16, 0); g.lineTo(k * 32 + 16 + 64, h); g.lineTo(k * 32 + 64, h); g.fill(); }
});
const texCordeRelief = texCanvas(64, 64, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 32, 32);
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  for (let k = -2; k < 6; k++) {
    const x = k * 16; const l = g.createLinearGradient(x, 0, x + 16, 0);
    l.addColorStop(0, '#303030'); l.addColorStop(0.5, '#ffffff'); l.addColorStop(1, '#303030');
    g.save(); g.transform(1, 0, 1, 1, 0, 0); g.fillStyle = l; g.fillRect(x - 64, 0, 16, h); g.restore();
  }
}, [1, 1], false);
const texBois = texCanvas(512, 64, (g, w, h) => {
  g.fillStyle = '#c58b55'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(${90 + Math.random() * 40},${50 + Math.random() * 20},20,${0.15 + Math.random() * 0.25})`;
    g.lineWidth = 0.6 + Math.random() * 1.8; g.beginPath();
    const y = Math.random() * h; g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / 70 + i) * 2.5);
    g.stroke();
  }
});
const texOmbre = texCanvas(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(45,28,18,0.85)'); r.addColorStop(0.45, 'rgba(45,28,18,0.45)'); r.addColorStop(1, 'rgba(45,28,18,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
texOmbre.wrapS = texOmbre.wrapT = THREE.ClampToEdgeWrapping;

const M = {
  vert: peinture(0x1d7a3c),
  vertFonce: peinture(0x125a2b),
  rouge: peinture(0xc8182b),
  peau: peinture(0xf3c3a0, 0.42, { clearcoat: 0.45 }),
  nez: peinture(0xf2a38a, 0.4),
  joue: new THREE.MeshPhysicalMaterial({ color: 0xf2878a, roughness: 0.55, transparent: true, opacity: 0.85 }),
  noir: peinture(0x141414, 0.25),
  bouche: peinture(0x7a1820, 0.35),
  sourcil: peinture(0x8a3b1c, 0.5),
  cheveux: peinture(0xc4592a, 0.45),
  or: new THREE.MeshPhysicalMaterial({ color: 0xe0ac45, metalness: 1, roughness: 0.22 }),
  fourrure: new THREE.MeshPhysicalMaterial({ color: 0xf8f4ee, roughness: 0.95, sheen: 1, sheenColor: 0xffffff, sheenRoughness: 0.6 }),
  feutre: new THREE.MeshPhysicalMaterial({ color: 0xc8182b, roughness: 0.62, sheen: 0.8, sheenColor: 0xff6a6a, sheenRoughness: 0.5 }),
  rayures: peinture(0xffffff, 0.4, { map: texRayures }),
  oeilBrillant: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  bois: new THREE.MeshPhysicalMaterial({ map: texBois, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
  corde: new THREE.MeshPhysicalMaterial({ map: texCorde, bumpMap: texCordeRelief, bumpScale: 1.2, roughness: 0.7 }),
  ombre: new THREE.MeshBasicMaterial({ map: texOmbre, transparent: true, depthWrite: false, toneMapped: false }),
};

function maille(geo, mat, parent = scene, ombre = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = ombre; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function entre(mesh, a, b) {           // place un cylindre de hauteur 1 entre deux points
  const d = V().subVectors(b, a); const l = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(Y, d.divideScalar(l));
  mesh.scale.set(1, l, 1);
}
function ik2(racine, cible, l1, l2, pole) {
  const dir = V().subVectors(cible, racine); let d = dir.length();
  d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4); dir.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const p = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  return { mil: racine.clone().addScaledVector(dir, a).addScaledVector(p, h), fin: racine.clone().addScaledVector(dir, d) };
}
function ombreSol(sx, sz) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.ombre.clone());
  m.rotation.x = -Math.PI / 2; m.scale.set(sx, sz, 1); m.renderOrder = 1;
  scene.add(m); return m;
}

// ------------------------------------------------------------------ le lutin
const HANCHE = 0.46, CUISSE = 0.215, TIBIA = 0.215, CHEVILLE = 0.07;
const BRAS = 0.2, AVANTBRAS = 0.19, FOULEE = 0.5, APPUI = 0.56;

class Lutin {
  constructor() {
    this.bassin = new THREE.Group(); this.bassin.rotation.order = 'ZYX'; scene.add(this.bassin);
    // tunique (tour) avec un ourlet en dents de scie
    const prof = [[0.0, 0.40], [0.272, 0.40], [0.275, 0.43], [0.255, 0.50], [0.218, 0.58], [0.196, 0.655], [0.2, 0.76],
      [0.207, 0.86], [0.192, 0.93], [0.152, 0.99], [0.09, 1.035], [0.0, 1.05]].map(([r, y]) => new THREE.Vector2(r, y - HANCHE));
    const tun = new THREE.LatheGeometry(prof, 64, Math.PI, Math.PI * 2);
    const pos = tun.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (y < 0.44 - HANCHE) {
        const th = Math.atan2(x, z) / (2 * Math.PI) * 9;
        const zig = 1 - Math.abs(((th % 1) + 1) % 1 * 2 - 1);
        pos.setY(i, y + 0.05 * zig);
      }
      pos.setZ(i, z * 0.86);
    }
    tun.computeVertexNormals();
    maille(tun, M.vert, this.bassin);
    const rz = (y) => { // rayon de la tunique à la hauteur y (repère racine)
      for (let i = 1; i < prof.length; i++) if (prof[i].y + HANCHE >= y) { const a = prof[i - 1], b = prof[i]; return lerp(a.x, b.x, (y - a.y - HANCHE) / (b.y - a.y)); }
      return 0.1;
    };
    // ceinture et boucle
    const ceint = maille(new THREE.CylinderGeometry(0.204, 0.204, 0.06, 64, 1, true), M.noir, this.bassin);
    ceint.position.y = 0.65 - HANCHE; ceint.scale.z = 0.88;
    const boucle = maille(new THREE.TorusGeometry(0.045, 0.012, 8, 4), M.or, this.bassin);
    boucle.rotation.z = Math.PI / 4; boucle.position.set(0, 0.65 - HANCHE, 0.204 * 0.88 + 0.008); boucle.scale.set(1.1, 0.9, 0.6);
    for (const y of [0.77, 0.88]) {
      const b = maille(new THREE.SphereGeometry(0.022, 16, 12), M.or, this.bassin);
      b.position.set(0, y - HANCHE, rz(y) * 0.86 + 0.006);
    }
    // col en pointes avec grelots
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      const dir = V(Math.sin(a) * 0.82, -0.55, Math.cos(a) * 0.82).normalize();
      const base = V(Math.sin(a) * 0.1, 1.0 - HANCHE, Math.cos(a) * 0.09);
      const c = maille(new THREE.ConeGeometry(0.048, 0.14, 12), M.rouge, this.bassin);
      c.position.copy(base).addScaledVector(dir, 0.07); c.quaternion.setFromUnitVectors(Y, dir);
      const g = maille(new THREE.SphereGeometry(0.017, 12, 10), M.or, this.bassin);
      g.position.copy(base).addScaledVector(dir, 0.145);
    }
    const cou = maille(new THREE.CylinderGeometry(0.062, 0.066, 0.1, 20), M.peau, this.bassin);
    cou.position.y = 1.07 - HANCHE;

    // tête
    this.tete = new THREE.Group(); this.tete.rotation.order = 'YXZ';
    this.tete.position.set(0, 1.07 - HANCHE, 0);
    this.bassin.add(this.tete);
    const R = 0.19, C = V(0, 0.155, 0);
    const surf = (th, ph, k = 1) => V(Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)).multiplyScalar(R * k).add(C);
    const crane = maille(new THREE.SphereGeometry(R, 48, 36), M.peau, this.tete);
    crane.position.copy(C); crane.scale.set(1, 1.02, 0.96);
    this.yeux = [];
    for (const s of [-1, 1]) {
      const o = maille(new THREE.SphereGeometry(0.03, 20, 16), M.noir, this.tete, false);
      o.position.copy(surf(s * 0.36, 0.07, 0.93)); o.scale.set(0.85, 1.15, 0.6);
      o.lookAt(o.position.clone().sub(C).multiplyScalar(5).add(C)); o.rotateZ(0);
      const b = maille(new THREE.SphereGeometry(0.0075, 10, 8), M.oeilBrillant, this.tete, false);
      b.position.copy(surf(s * 0.36 - 0.06, 0.11, 1.0));
      this.yeux.push(o, b);
      const sc = maille(new THREE.CapsuleGeometry(0.009, 0.05, 4, 8), M.sourcil, this.tete, false);
      sc.position.copy(surf(s * 0.37, 0.3, 0.99)); sc.rotation.set(-0.3, s * 0.36, Math.PI / 2 - s * 0.22);
      const j = maille(new THREE.SphereGeometry(0.05, 20, 16), M.joue, this.tete, false);
      j.position.copy(surf(s * 0.58, -0.13, 0.9)); j.scale.set(1, 0.75, 0.55); j.lookAt(j.position.clone().sub(C).multiplyScalar(3).add(C));
      // oreilles pointues
      const or = maille(new THREE.ConeGeometry(0.056, 0.21, 20), M.peau, this.tete);
      const dir = V(s * 0.86, 0.42, -0.26).normalize();
      or.position.copy(surf(s * Math.PI / 2, 0.04, 0.93)).addScaledVector(dir, 0.09);
      or.quaternion.setFromUnitVectors(Y, dir); or.scale.set(1, 1, 0.45);
    }
    const nez = maille(new THREE.SphereGeometry(0.037, 20, 16), M.nez, this.tete);
    nez.position.copy(surf(0, -0.03, 1.0));
    const sourire = [];
    for (let i = 0; i <= 16; i++) { const th = -0.32 + 0.64 * i / 16; sourire.push(surf(th, -0.215 - 0.075 * (1 - (th / 0.32) ** 2), 1.0)); }
    this.bouche = maille(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sourire), 40, 0.011, 10), M.bouche, this.tete, false);
    this.boucheOuverte = maille(new THREE.CircleGeometry(0.05, 24, Math.PI, Math.PI), M.bouche, this.tete, false);
    this.boucheOuverte.position.copy(surf(0, -0.235, 0.985)); this.boucheOuverte.rotation.set(-0.22, 0, 0);
    for (const [th, ph] of [[1.3, 0.3], [-1.3, 0.3], [2.0, 0.16], [-2.0, 0.16], [2.4, 0.12], [-2.4, 0.12], [2.8, 0.12], [-2.8, 0.12], [Math.PI, 0.14]]) {
      const ch = maille(new THREE.SphereGeometry(0.036, 16, 12), M.cheveux, this.tete);
      ch.position.copy(surf(th, ph, 0.93));
    }
    // bonnet : bord en fourrure + cône qui retombe + pompon
    const bord = maille(new THREE.TorusGeometry(0.178, 0.05, 16, 48), M.fourrure, this.tete);
    bord.position.copy(C).add(V(0, 0.125, -0.012)); bord.rotation.set(Math.PI / 2 - 0.16, 0, 0);
    this.bonnetBase = new THREE.Group(); this.bonnetBase.position.copy(bord.position); this.bonnetBase.rotation.x = -0.16;
    this.tete.add(this.bonnetBase);
    const HB = 0.56, pts = [];
    for (let i = 0; i <= 14; i++) { const h = (i / 14) * HB; pts.push(new THREE.Vector2(0.172 * Math.pow(1 - h / HB, 0.85) + 0.004, h)); }
    this.bonnetGeo = new THREE.LatheGeometry(pts, 40);
    this.bonnetRef = this.bonnetGeo.attributes.position.array.slice();
    this.HB = HB;
    maille(this.bonnetGeo, M.feutre, this.bonnetBase);
    this.pompon = maille(new THREE.SphereGeometry(0.068, 24, 18), M.fourrure, this.bonnetBase);

    // bras et jambes (placés à chaque image)
    const mk = (geo, mat) => maille(geo, mat);
    this.membres = {};
    for (const c of ['G', 'D']) {
      this.membres['epaule' + c] = mk(new THREE.SphereGeometry(0.056, 20, 16), M.vert);
      this.membres['bras' + c] = mk(new THREE.CylinderGeometry(0.05, 0.044, 1, 20), M.vert);
      this.membres['coude' + c] = mk(new THREE.SphereGeometry(0.045, 16, 12), M.vert);
      this.membres['avbras' + c] = mk(new THREE.CylinderGeometry(0.044, 0.04, 1, 20), M.vert);
      this.membres['manchette' + c] = mk(new THREE.TorusGeometry(0.043, 0.02, 12, 24), M.fourrure);
      this.membres['main' + c] = mk(new THREE.SphereGeometry(0.052, 20, 16), M.peau);
      this.membres['cuisse' + c] = mk(new THREE.CylinderGeometry(0.056, 0.05, 1, 20), M.rayures);
      this.membres['genou' + c] = mk(new THREE.SphereGeometry(0.05, 16, 12), M.rayures);
      this.membres['tibia' + c] = mk(new THREE.CylinderGeometry(0.05, 0.045, 1, 20), M.rayures);
      const pied = new THREE.Group(); scene.add(pied); this.membres['pied' + c] = pied;
      const semelle = maille(new THREE.SphereGeometry(1, 28, 20), M.vertFonce, pied);
      semelle.scale.set(0.075, 0.058, 0.16); semelle.position.set(0, -0.012, 0.05);
      const bout = maille(new THREE.TorusGeometry(0.05, 0.02, 10, 20, Math.PI * 1.15), M.vertFonce, pied);
      bout.rotation.set(0, -Math.PI / 2, 0); bout.position.set(0, 0.035, 0.175);
      const grelot = maille(new THREE.SphereGeometry(0.022, 14, 10), M.or, pied);
      grelot.position.set(0, 0.075, 0.15);
      this.membres['ombrePied' + c] = ombreSol(0.3, 0.42);
    }
    this.ombreCorps = ombreSol(0.9, 0.7);
  }

  pose(t) {
    const x = bassinX(t), v = vitesse(t);
    const marche = clamp(Math.abs(v) / 0.35, 0, 1);
    const tour = poidsTour(t), coucou = poidsCoucou(t);
    const lacet = lerp(0.95, 0.3, tour);
    const avant = V(Math.sin(lacet), 0, Math.cos(lacet));
    const gauche = V(Math.cos(lacet), 0, -Math.sin(lacet));      // sa main gauche (loin de la caméra)
    const d = distance(t);
    // pieds
    const pieds = {};
    for (const [c, dec, cote] of [['G', 0, 1], ['D', 0.5, -1]]) {
      const phi = d / FOULEE + dec, n = Math.floor(phi), f = phi - n;
      const plant = (k) => (k + APPUI / 2 - dec) * FOULEE;
      let dist = plant(n), lev = 0;
      if (f >= APPUI) { const u = (f - APPUI) / (1 - APPUI); const e = u * u * (3 - 2 * u); dist = lerp(plant(n), plant(n + 1), e); lev = Math.sin(Math.PI * u); }
      const xMarche = T.x0 - dist + 0.07;
      const xDebout = x + 0.07 + cote * 0.02;
      const px = lerp(xDebout, xMarche, marche);
      const p = V(px, CHEVILLE + 0.085 * lev * marche, 0).addScaledVector(gauche, cote * 0.1);
      pieds[c] = { p, lev: lev * marche };
    }
    // hauteur du bassin : la plus haute possible pour que les jambes atteignent le sol
    let h = HANCHE;
    for (const c of ['G', 'D']) {
      const hip = V(x, 0, 0).addScaledVector(gauche, c === 'G' ? 0.085 : -0.085);
      const dx = Math.hypot(pieds[c].p.x - hip.x, pieds[c].p.z - hip.z);
      const L = (CUISSE + TIBIA) * 0.975;
      h = Math.min(h, Math.sqrt(Math.max(L * L - dx * dx, 0.01)) + pieds[c].p.y);
    }
    const tirage = 1 - tour;
    const pas = Math.sin(2 * Math.PI * d / FOULEE * 2);
    this.bassin.position.set(x, h, 0);
    this.bassin.rotation.y = lacet;
    this.bassin.rotation.z = 0.2 * tirage + 0.025 * pas * marche;
    this.bassin.rotation.x = 0.03 * Math.sin(2 * Math.PI * d / FOULEE) * marche;
    // tête : regarde la corde en marchant, la caméra pendant la pause
    this.tete.rotation.y = lerp(0.1, -0.3 + 0.04 * Math.sin(t * 2.1), tour);
    this.tete.rotation.x = lerp(0.08, -0.06, tour);
    this.tete.rotation.z = lerp(-0.12, 0.16 * coucou, tour) + 0.03 * pas * marche;
    this.bassin.updateMatrixWorld(true);
    // clignements
    const clign = [1.5, 3.55, 4.75, 6.6, 9.0].some((tc) => Math.abs(t - tc) < 0.06);
    for (const o of this.yeux) o.scale.y = clign ? (o.geometry.parameters.radius > 0.01 ? 0.12 : 0.01) : (o.geometry.parameters.radius > 0.01 ? 1.15 : 1);
    this.boucheOuverte.visible = coucou >= 0.5;
    // bonnet qui ballotte
    const sw = echantillon(simBonnet, t);
    const swLocal = V(sw, 0, 0).applyQuaternion(this.tete.getWorldQuaternion(new THREE.Quaternion()).invert());
    const B = 0.2 + 0.25 * clamp(swLocal.z * -1, -0.4, 0.4), S = -0.07 + 0.25 * clamp(swLocal.x, -0.4, 0.4);
    const pa = this.bonnetGeo.attributes.position, ref = this.bonnetRef;
    for (let i = 0; i < pa.count; i++) {
      const hx = ref[3 * i], hy = ref[3 * i + 1], hz = ref[3 * i + 2], u = hy / this.HB;
      pa.setXYZ(i, hx + S * u * u, hy - 0.55 * Math.abs(B) * u * u * u, hz - B * u * u);
    }
    pa.needsUpdate = true; this.bonnetGeo.computeVertexNormals();
    this.pompon.position.set(S, this.HB - 0.55 * Math.abs(B), -B);
    // jambes
    const m = this.membres;
    for (const [c, cote] of [['G', 1], ['D', -1]]) {
      const hip = this.bassin.localToWorld(V(cote * 0.085, 0, 0));
      const ik = ik2(hip, pieds[c].p, CUISSE, TIBIA, avant.clone().addScaledVector(gauche, cote * 0.2));
      entre(m['cuisse' + c], hip, ik.mil); entre(m['tibia' + c], ik.mil, ik.fin);
      m['genou' + c].position.copy(ik.mil);
      const pied = m['pied' + c]; pied.position.copy(ik.fin); pied.rotation.set(-0.35 * pieds[c].lev, lacet, 0, 'YXZ');
      const o = m['ombrePied' + c]; o.position.set(ik.fin.x + avant.x * 0.05, 0.003, ik.fin.z + avant.z * 0.05);
      o.rotation.z = -lacet; o.material.opacity = 0.85 * (1 - 0.7 * pieds[c].lev);
    }
    this.ombreCorps.position.set(x + 0.04, 0.002, 0); this.ombreCorps.material.opacity = 0.55;
    // bras : les mains tiennent la corde (ou font coucou)
    const corde = cordeEtat(t, this);
    const mains = { G: corde.prise1, D: corde.prise2 };
    const epD = this.bassin.localToWorld(V(-0.205, 0.94 - HANCHE, 0));
    const salut = epD.clone().add(V(0, 0.31, 0)).addScaledVector(avant, 0.12).addScaledVector(gauche, -0.2)
      .add(V(0.075 * Math.sin(t * 2 * Math.PI * 2.2), 0.015 * Math.cos(t * 2 * Math.PI * 4.4), 0));
    mains.D = mains.D.clone().lerp(salut, coucou);
    for (const [c, cote] of [['G', 1], ['D', -1]]) {
      const ep = this.bassin.localToWorld(V(cote * 0.205, 0.94 - HANCHE, 0));
      const pole = V(0, -1, 0).addScaledVector(gauche, cote * 0.6).addScaledVector(avant, -0.4);
      if (c === 'D') pole.lerp(V(0, -0.3, 0).addScaledVector(gauche, -1), coucou);
      const ik = ik2(ep, mains[c], BRAS, AVANTBRAS, pole);
      m['epaule' + c].position.copy(ep);
      entre(m['bras' + c], ep, ik.mil); entre(m['avbras' + c], ik.mil, ik.fin);
      m['coude' + c].position.copy(ik.mil);
      const dirAv = V().subVectors(ik.fin, ik.mil).normalize();
      m['manchette' + c].position.copy(ik.fin).addScaledVector(dirAv, -0.01);
      m['manchette' + c].quaternion.setFromUnitVectors(V(0, 0, 1), dirAv);
      m['main' + c].position.copy(ik.fin).addScaledVector(dirAv, 0.035);
    }
  }
}

// ------------------------------------------------------------------ la luge et la carte
class Luge {
  constructor(texCarte) {
    this.g = new THREE.Group(); scene.add(this.g);
    for (const z of [-0.25, 0.25]) {
      const c = new THREE.CatmullRomCurve3([V(0.86, 0.09, z), V(0.78, 0.035, z), V(0.3, 0.03, z), V(-0.4, 0.03, z), V(-0.74, 0.035, z),
        V(-0.9, 0.1, z), V(-0.95, 0.22, z), V(-0.9, 0.31, z), V(-0.8, 0.33, z), V(-0.74, 0.29, z)]);
      maille(new THREE.TubeGeometry(c, 120, 0.028, 14), M.rouge, this.g);
      for (const x of [-0.5, 0.05, 0.6]) {
        const s = maille(new THREE.CylinderGeometry(0.02, 0.02, 1, 12), M.rouge, this.g);
        entre(s, V(x, 0.03, z), V(x, 0.18, z));
      }
    }
    for (const z of [-0.19, -0.063, 0.063, 0.19]) {
      const l = maille(new THREE.BoxGeometry(1.62, 0.035, 0.11), M.bois, this.g);
      l.position.set(0.06, 0.195, z);
    }
    const barre = maille(new THREE.CylinderGeometry(0.022, 0.022, 0.56, 14), M.or, this.g);
    barre.rotation.x = Math.PI / 2; barre.position.set(-0.9, 0.29, 0);
    this.attache = V(-0.92, 0.29, 0);
    // la carte : rectangle arrondi épais, image sur la face avant
    const LC = 1.65, HC = LC * 582 / 900, RC = LC * 50 / 900;
    const f = new THREE.Shape();
    f.moveTo(RC, 0); f.lineTo(LC - RC, 0); f.quadraticCurveTo(LC, 0, LC, RC); f.lineTo(LC, HC - RC); f.quadraticCurveTo(LC, HC, LC - RC, HC);
    f.lineTo(RC, HC); f.quadraticCurveTo(0, HC, 0, HC - RC); f.lineTo(0, RC); f.quadraticCurveTo(0, 0, RC, 0);
    const ep = 0.024;
    const geo = new THREE.ExtrudeGeometry(f, { depth: ep, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 24 });
    const uv = geo.attributes.uv, p = geo.attributes.position, g0 = geo.groups[0];
    for (let i = g0.start; i < g0.start + g0.count; i++) uv.setXY(i, p.getX(i) / LC, p.getY(i) / HC);
    geo.translate(-LC / 2, 0, -ep / 2);
    this.pivotCarte = new THREE.Group(); this.pivotCarte.position.set(0.06, 0.212, 0); this.g.add(this.pivotCarte);
    const matFace = new THREE.MeshPhysicalMaterial({ map: texCarte, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.25 });
    const matBord = peinture(0x5f9630, 0.4);
    this.carte = maille(geo, [matFace, matBord], this.pivotCarte);
    this.dimCarte = { LC, HC };
    for (const x of [-0.6, 0.6]) {
      const s = maille(new THREE.BoxGeometry(0.16, 0.07, 0.13), M.bois, this.g);
      s.position.set(0.06 + x, 0.245, 0);
    }
    this.ombre = ombreSol(2.3, 0.95);
  }
  pose(t) {
    const x = bassinX(t) + T.ecartLuge;
    this.g.position.set(x, 0, 0);
    this.pivotCarte.rotation.z = echantillon(simCarte, t);
    this.ombre.position.set(x + 0.08, 0.002, 0.02); this.ombre.material.opacity = 0.7;
  }
  coinsEcran() {
    const { LC, HC } = this.dimCarte;
    this.g.updateMatrixWorld(true);
    return [[-LC / 2, 0], [LC / 2, 0], [LC / 2, HC], [-LC / 2, HC]].map(([a, b]) => {
      const p = this.pivotCarte.localToWorld(V(a, b, 0.016)).project(camera);
      return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H];
    });
  }
}

// ------------------------------------------------------------------ la corde
function cordeEtat(t, lutin) {
  const x = bassinX(t);
  const lacet = lerp(0.95, 0.3, poidsTour(t));
  const avant = V(Math.sin(lacet), 0, Math.cos(lacet));
  const H0 = V(x + T.ecartLuge, 0, 0).add(luge.attache);
  const tir = 1 - poidsTour(t);
  const rythme = 0.035 * Math.sin(2 * Math.PI * distance(t) / FOULEE * 2) * tir;
  const prise1 = V(x + 0.17, h0(t) + 0.33, 0.12).addScaledVector(avant, 0.06).add(V(rythme, 0, 0));
  prise1.y -= 0.04 * poidsTour(t);
  const dir = V().subVectors(H0, prise1).normalize();
  const prise2 = prise1.clone().addScaledVector(dir, 0.13);
  return { prise1, prise2, attache: H0, dir };
}
function h0(t) { return lutin ? lutin.bassin.position.y : HANCHE; }

let cordeMesh = null, noeud = null;
function poseCorde(t) {
  const e = cordeEtat(t, lutin);
  const affaissement = lerp(0.03, 0.75, 1 - tensionCorde(t));
  const pts = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const p = V().lerpVectors(e.attache, e.prise2, u);
    p.y -= 4 * affaissement * u * (1 - u);
    p.y = Math.max(p.y, 0.02);
    pts.push(p);
  }
  pts.push(e.prise1.clone(), e.prise1.clone().addScaledVector(e.dir, -0.06).add(V(0, -0.03, 0)));
  const courbe = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const longueur = courbe.getLength();
  if (cordeMesh) { cordeMesh.geometry.dispose(); }
  else { cordeMesh = maille(new THREE.BufferGeometry(), M.corde); noeud = maille(new THREE.SphereGeometry(0.03, 14, 10), M.corde); }
  cordeMesh.geometry = new THREE.TubeGeometry(courbe, 500, 0.02, 10, false);
  M.corde.map.repeat.set(longueur / 0.09, 1);
  M.corde.bumpMap.repeat.set(longueur / 0.09, 1);
  noeud.position.copy(pts[pts.length - 1]);
}

// ------------------------------------------------------------------ démarrage
let lutin = null, luge = null;
const chargeur = new THREE.TextureLoader();
async function preparer() {
  const fond = await chargeur.loadAsync('./fond.png');
  fond.colorSpace = THREE.SRGBColorSpace;
  scene.background = fond;
  const carte = await chargeur.loadAsync('./carte_texture.png');
  carte.colorSpace = THREE.SRGBColorSpace; carte.anisotropy = renderer.capabilities.getMaxAnisotropy();
  luge = new Luge(carte);
  lutin = new Lutin();
  return { tFin: T.tFin, tStop: T.tStop, tB: T.tB };
}
function rendre(t) {
  luge.pose(t);
  lutin.pose(t);
  poseCorde(t);
  renderer.render(scene, camera);
  return luge.coinsEcran();
}
window.preparer = preparer;
window.rendre = rendre;
window.T = T;
window.pret = true;
