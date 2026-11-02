// Guinho em 3D (three.js): mesmo personagem do desenho — ovo creme, boné amarelo, olhos "pie-cut",
// luvas brancas e tênis vermelhos — em estilo cartoon (toon + contorno marrom).
// Acena, pisca, olha pro dedo/mouse e dá um pulinho com giro quando tocam nele.
import * as THREE from "three";

const COR = {
  contorno: 0x3d2614,
  creme: 0xfff4dc,
  gema: 0xf5a800,
  tomate: 0xe8432f,
  branco: 0xffffff,
  rosa: 0xf7a07a,
};

export function montarGuinho(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.1, 8.4);
  camera.lookAt(0, -0.05, 0);

  cena.add(new THREE.HemisphereLight(0xffffff, 0xffe2a8, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2);
  sol.position.set(-3, 4, 5);
  cena.add(sol);

  // Toon em 3 tons: cara de desenho animado
  const rampa = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]), 3, 1);
  rampa.minFilter = rampa.magFilter = THREE.NearestFilter;
  rampa.needsUpdate = true;
  const toon = (color: number) => new THREE.MeshToonMaterial({ color, gradientMap: rampa });
  const liso = (color: number) => new THREE.MeshBasicMaterial({ color });
  const matContorno = new THREE.MeshBasicMaterial({ color: COR.contorno, side: THREE.BackSide });

  const descartaveis: { dispose(): void }[] = [rampa, matContorno];
  /** Malha com contorno (casco invertido um pouco maior) */
  const comContorno = (geo: THREE.BufferGeometry, mat: THREE.Material, espessura = 0.045) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, mat);
    const c = new THREE.Mesh(geo, matContorno);
    geo.computeBoundingSphere();
    const r = geo.boundingSphere?.radius || 1;
    c.scale.setScalar(1 + espessura / r);
    g.add(c, m);
    descartaveis.push(geo, mat);
    return g;
  };

  const guinho = new THREE.Group();
  cena.add(guinho);
  const corpoG = new THREE.Group(); // tudo que balança junto com o corpo
  guinho.add(corpoG);

  // ---------- corpo: ovo por revolução ----------
  const perfil: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40; // 0 = base, 1 = topo
    const ang = Math.PI * t;
    const y = -Math.cos(ang) * 1.25;
    const raio = Math.sin(ang) * 1.0 * (1 - 0.16 * t); // mais fino em cima
    perfil.push(new THREE.Vector2(Math.max(raio, 0.0001), y));
  }
  const corpo = comContorno(new THREE.LatheGeometry(perfil, 64), toon(COR.creme), 0.05);
  corpoG.add(corpo);

  // ---------- boné ----------
  const bone = new THREE.Group();
  const copa = comContorno(new THREE.SphereGeometry(0.86, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2.1), toon(COR.gema), 0.04);
  copa.scale.set(1, 0.82, 1);
  bone.add(copa);
  const aba = comContorno(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 40, 1, false, -Math.PI / 2.6, Math.PI / 1.3), liso(COR.contorno), 0.02);
  aba.position.set(0, 0.02, 0.42);
  aba.scale.set(1.15, 1, 1.25);
  aba.rotation.x = 0.12;
  bone.add(aba);
  const botao = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), liso(COR.contorno));
  botao.position.y = 0.72;
  bone.add(botao);
  // selo "E" na frente do boné
  const selo = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshBasicMaterial({ map: texturaSelo() }));
  selo.position.set(0, 0.36, 0.78);
  selo.rotation.x = -0.35;
  bone.add(selo);
  bone.position.y = 0.66;
  bone.rotation.x = -0.12;
  bone.rotation.z = 0.08;
  corpoG.add(bone);

  // ---------- rosto ----------
  const rosto = new THREE.Group();
  corpoG.add(rosto);
  const olhos: THREE.Group[] = [];
  for (const x of [-0.24, 0.24]) {
    const olho = new THREE.Group();
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), liso(COR.contorno));
    bola.scale.set(1, 2, 0.5);
    olho.add(bola);
    const brilho = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), liso(COR.branco));
    brilho.position.set(0.04, 0.09, 0.05);
    olho.add(brilho);
    olho.position.set(x, 0.18, 0.93);
    olho.rotation.y = x * 0.9;
    rosto.add(olho);
    olhos.push(olho);
  }
  for (const x of [-0.5, 0.5]) {
    const bochecha = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), new THREE.MeshBasicMaterial({ color: COR.rosa, transparent: true, opacity: 0.8 }));
    bochecha.scale.set(1.4, 0.8, 1);
    bochecha.position.set(x, -0.18, 0.88);
    bochecha.rotation.y = x * 1.15;
    rosto.add(bochecha);
  }
  // boca: meia-lua escura + língua vermelha + dentes
  const boca = new THREE.Group();
  const formaBoca = new THREE.Shape();
  formaBoca.moveTo(-0.3, 0);
  formaBoca.lineTo(0.3, 0);
  formaBoca.bezierCurveTo(0.26, -0.3, -0.26, -0.3, -0.3, 0);
  boca.add(new THREE.Mesh(new THREE.ShapeGeometry(formaBoca, 24), liso(COR.contorno)));
  const lingua = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), liso(COR.tomate));
  lingua.scale.set(1.2, 0.55, 1);
  lingua.position.set(0, -0.15, 0.005);
  boca.add(lingua);
  const dentes = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.06), liso(COR.branco));
  dentes.position.set(0, -0.04, 0.006);
  boca.add(dentes);
  boca.position.set(0, -0.12, 0.985);
  boca.rotation.x = -0.12;
  rosto.add(boca);

  // ---------- braços (mangueirinha) + luvas ----------
  const mangueira = (pontos: THREE.Vector3[]) => {
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pontos), 24, 0.065, 10);
    const m = new THREE.Mesh(geo, liso(COR.contorno));
    descartaveis.push(geo);
    return m;
  };
  const luva = (aberta: boolean) => {
    const g = new THREE.Group();
    const palma = comContorno(new THREE.SphereGeometry(0.2, 20, 16), toon(COR.branco), 0.035);
    palma.scale.set(1, 0.9, 0.7);
    g.add(palma);
    const dedos = aberta ? [-0.13, -0.045, 0.045, 0.13] : [];
    for (const dx of dedos) {
      const d = comContorno(new THREE.CapsuleGeometry(0.055, 0.14, 4, 10), toon(COR.branco), 0.03);
      d.position.set(dx, 0.22, 0);
      d.rotation.z = -dx * 1.2;
      g.add(d);
    }
    const punho = comContorno(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 20), toon(COR.branco), 0.03);
    punho.position.y = -0.2;
    g.add(punho);
    return g;
  };

  // braço direito (do Guinho) acenando: pivô no ombro
  const ombroD = new THREE.Group();
  ombroD.position.set(0.92, -0.25, 0.1);
  ombroD.add(mangueira([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.15, 0), new THREE.Vector3(0.48, 0.55, 0.05), new THREE.Vector3(0.45, 0.85, 0.08)]));
  const maoD = luva(true);
  maoD.position.set(0.45, 1.05, 0.08);
  maoD.rotation.z = -0.25;
  ombroD.add(maoD);
  corpoG.add(ombroD);

  // braço esquerdo: mão na cintura
  const ombroE = new THREE.Group();
  ombroE.position.set(-0.92, -0.3, 0.1);
  ombroE.add(mangueira([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.3, -0.15, 0.05), new THREE.Vector3(-0.38, -0.45, 0.1), new THREE.Vector3(-0.25, -0.62, 0.18)]));
  const maoE = luva(false);
  maoE.position.set(-0.22, -0.68, 0.2);
  ombroE.add(maoE);
  corpoG.add(ombroE);

  // ---------- pernas + tênis ----------
  const pes: THREE.Group[] = [];
  for (const lado of [-1, 1]) {
    const perna = new THREE.Group();
    perna.position.set(lado * 0.38, -1.12, 0);
    perna.add(mangueira([new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(lado * 0.04, -0.2, 0), new THREE.Vector3(lado * 0.1, -0.45, 0.02)]));
    const tenis = new THREE.Group();
    const cabedal = comContorno(new THREE.SphereGeometry(0.26, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), toon(COR.tomate), 0.035);
    cabedal.scale.set(1, 0.85, 1.45);
    tenis.add(cabedal);
    const sola = comContorno(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 24), toon(COR.branco), 0.03);
    sola.scale.set(1, 1, 1.45);
    sola.position.y = -0.02;
    tenis.add(sola);
    tenis.position.set(lado * 0.14, -0.55, 0.12);
    tenis.rotation.y = lado * 0.25;
    perna.add(tenis);
    guinho.add(perna);
    pes.push(perna);
  }

  // sombra no chão
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), new THREE.MeshBasicMaterial({ color: COR.contorno, transparent: true, opacity: 0.14 }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = -1.72;
  sombra.scale.set(1.2, 0.5, 1);
  guinho.add(sombra);

  guinho.position.y = 0.15;
  guinho.scale.setScalar(0.9);

  // ---------- interação ----------
  const alvo = { x: 0, y: 0 };
  const olhar = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    alvo.x = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.5, 1.5);
    alvo.y = THREE.MathUtils.clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1.5, 1.5);
  };
  let pulo = -1; // tempo do início do pulo
  const tocar = () => {
    if (pulo < 0) pulo = performance.now();
  };
  window.addEventListener("pointermove", olhar, { passive: true });
  canvas.addEventListener("pointerdown", tocar);

  const ajustar = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const obs = new ResizeObserver(ajustar);
  obs.observe(canvas);
  ajustar();

  // ---------- animação ----------
  let quadro = 0;
  let proximaPiscada = 1.5;
  const relogio = new THREE.Clock();
  const animar = () => {
    quadro = requestAnimationFrame(animar);
    const t = relogio.getElapsedTime();

    // respira e balança
    corpoG.position.y = Math.sin(t * 2.2) * 0.04;
    corpoG.rotation.z = Math.sin(t * 1.1) * 0.04;
    corpoG.scale.set(1 + Math.sin(t * 4.4) * 0.008, 1 - Math.sin(t * 4.4) * 0.008, 1);

    // aceno
    ombroD.rotation.z = 0.15 + Math.sin(t * 7) * 0.25;
    maoD.rotation.z = -0.25 + Math.sin(t * 7 + 0.6) * 0.35;

    // vira na direção do dedo/mouse
    guinho.rotation.y += (alvo.x * 0.45 - guinho.rotation.y) * 0.06;
    corpoG.rotation.x += (-alvo.y * 0.12 - corpoG.rotation.x) * 0.06;

    // piscada
    let escalaOlho = 2;
    if (t > proximaPiscada) {
      const p = (t - proximaPiscada) / 0.16;
      if (p >= 1) proximaPiscada = t + 2 + Math.random() * 3;
      else escalaOlho = 2 * Math.abs(1 - p * 2) + 0.12;
    }
    for (const o of olhos) o.children[0].scale.y = escalaOlho;

    // pulinho com giro quando tocam
    if (pulo >= 0) {
      const p = (performance.now() - pulo) / 900;
      if (p >= 1) {
        pulo = -1;
        guinho.position.y = 0.15;
        corpoG.rotation.y = 0;
      } else {
        guinho.position.y = 0.15 + Math.sin(p * Math.PI) * 0.7;
        corpoG.rotation.y = p * Math.PI * 2;
        for (const pe of pes) pe.rotation.x = Math.sin(p * Math.PI) * 0.5;
      }
      sombra.scale.setScalar(1 - Math.sin(Math.max(p, 0) * Math.PI) * 0.35);
      sombra.scale.x *= 1.2;
      sombra.scale.y *= 0.5;
    }

    renderer.render(cena, camera);
  };
  animar();

  return () => {
    cancelAnimationFrame(quadro);
    obs.disconnect();
    window.removeEventListener("pointermove", olhar);
    canvas.removeEventListener("pointerdown", tocar);
    cena.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material as THREE.Material & { map?: THREE.Texture | null };
        m.map?.dispose();
        m.dispose();
      }
    });
    for (const d of descartaveis) d.dispose();
    renderer.dispose();
  };
}

function texturaSelo() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#3d2614";
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFF9EC";
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3d2614";
  ctx.font = "900 70px Arial Black, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("E", 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
