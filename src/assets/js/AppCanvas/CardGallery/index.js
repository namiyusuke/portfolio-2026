import * as THREE from "three";
import Config from "../Config";

// ============================================================
// CARD GALLERY CONFIG
// ============================================================
const CFG = {
  radius: 5.5,
  arcAngle: 2 * Math.asin((5.0 * (540 / 400)) / (2 * 5.5)),
  cardHeight: 5.0,
  cardGap: 1.0,
  segmentsX: 300,
  segmentsY: 300,
  scrollSpeed: 0.005,
  scrollLerp: 0.065,
  cameraFov: 50,
  parallaxMin: 1.0,
  parallaxMax: 1.0,
  bendStart: 2.0,
  bendRadius: 1.0,
};

// ============================================================
// PROJECTS
// ============================================================
const projects = [
  { title: "photoire", category: "", date: "", image: "/img/photoire.webp", link: "/about/" },
  { title: "arcraft", category: "", date: "", image: "/img/arcraft.webp", link: "/about2/" },
  { title: "attcraft aniversary", category: "", date: "", image: "/img/aniversary.webp", link: "/about3/" },
];

const totalCards = projects.length;
const cardStep = CFG.cardHeight + CFG.cardGap;
const totalLoopHeight = totalCards * cardStep;
const bendArcLength = (Math.PI / 2) * CFG.bendRadius;
const COPIES = 3;

// ============================================================
// SHADERS
// ============================================================
const cardVertexShader = /* glsl */ `
  uniform float uCardY;
  uniform float uBendStart;
  uniform float uBendRadius;
  uniform float uBendArc;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying float vElevation;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float ly  = uCardY + pos.y;
    float aly = abs(ly);
    float sly = ly >= 0.0 ? 1.0 : -1.0;
    float bY, bZ;
    if (aly <= uBendStart) {
      bY = ly;
      bZ = 0.0;
    } else if (aly <= uBendStart + uBendArc) {
      float a = (aly - uBendStart) / uBendRadius;
      bY = sly * (uBendStart + uBendRadius * sin(a));
      bZ = -uBendRadius * (1.0 - cos(a));
    } else {
      float ex = aly - uBendStart - uBendArc;
      bY = sly * (uBendStart + uBendRadius);
      bZ = -uBendRadius - ex;
    }
    pos.y += bY - ly;
    pos.z += bZ;

    vec3 n = normal;
    float bendAngle = 0.0;
    if (aly > uBendStart) {
      bendAngle = aly <= uBendStart + uBendArc
        ? (aly - uBendStart) / uBendRadius
        : 3.14159265 / 2.0;
    }
    float ba = -sly * bendAngle;
    float c = cos(ba), s = sin(ba);
    n = vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c);

    vNormal = normalize(normalMatrix * n);
    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
    float elevation = sin(modelPosition.x * 1.0 + uTime * 2.0) * 0.2;
    elevation += sin(modelPosition.y * 1.0 + uTime * 2.0) * 0.02;
    modelPosition.z += elevation;
    vElevation = elevation;
    vec4 mvPos = viewMatrix * modelPosition;
    vViewPos = mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const cardFragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform vec2 uUvOffset;
  varying float vElevation;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;

  void main() {
    vec2 uv = vUv + uUvOffset;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
    vec4 texColor = texture2D(map, uv);
    vec3 color = texColor.rgb * uBrightness * max(1.0, 1.0 + vElevation * 2.0);
    gl_FragColor = vec4(color, texColor.a * uOpacity);
  }
`;

// ============================================================
// HELPERS
// ============================================================
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mod(n, m) {
  return ((n % m) + m) % m;
}

// ============================================================
// CardGallery — MainObject と同じ init/resize/update パターン
// ============================================================
export default class CardGallery {
  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.cards = [];
    this.group = new THREE.Group();
    this.group.rotation.z = Math.PI * 0.1;

    // scroll
    this.scrollTarget = 0;
    this.scrollCurrent = 0;
    this.scrollVelocity = 0;

    // cursor
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this.cursorX = this.mouseX;
    this.cursorY = this.mouseY;

    // raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouseNDC = new THREE.Vector2();
    this.hoveredCard = null;

    // label
    this.currentCenterProject = null;

    // brightness (GUI用)
    this.brightness = 1.0;

    // destroy用にバインド済みハンドラを保持
    this._onWheel = null;
    this._onTouchStart = null;
    this._onTouchMove = null;
    this._onMouseMove = null;
  }

  async init() {
    // DOM要素
    this.cursorEl = document.querySelector(".cursor");
    this.projectLabelEl = document.getElementById("project-label");
    this.projectTitleEl = this.projectLabelEl?.querySelector(".title") ?? null;
    this.projectCategoryEl = this.projectLabelEl?.querySelector(".category") ?? null;
    this.projectLinkEl = this.projectLabelEl?.querySelector(".link") ?? null;
    // geometry（共有）
    const cardWidth = 2 * CFG.radius * Math.sin(CFG.arcAngle / 2);
    const sharedGeo = new THREE.PlaneGeometry(cardWidth, CFG.cardHeight, CFG.segmentsX, CFG.segmentsY);

    // カード生成
    for (let copy = 0; copy < COPIES; copy++) {
      for (let i = 0; i < totalCards; i++) {
        const proj = projects[i];
        const tex = this._loadTexture(proj.image);
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            map: { value: tex },
            uOpacity: { value: 2.0 },
            uUvOffset: { value: new THREE.Vector2(0, 0) },
            uCardY: { value: 0.0 },
            uBendStart: { value: CFG.bendStart },
            uBendRadius: { value: CFG.bendRadius },
            uBendArc: { value: bendArcLength },
            uTime: { value: 0 },
            uBrightness: { value: 1.0 },
          },
          vertexShader: cardVertexShader,
          fragmentShader: cardFragmentShader,
          side: THREE.DoubleSide,
          transparent: true,
        });

        const mesh = new THREE.Mesh(sharedGeo, mat);
        const baseY = i * cardStep + copy * totalLoopHeight;
        mesh.position.y = baseY;
        mesh.userData = {
          baseY,
          parallaxFactor: CFG.parallaxMin + Math.random() * (CFG.parallaxMax - CFG.parallaxMin),
          project: proj,
        };
        this.group.add(mesh);
        this.cards.push(mesh);
      }
    }

    // イベント
    this._bindEvents();
  }

  resize() {
    // 特にカード側で必要なリサイズ処理があればここに
  }

  update({ time, deltaTime }, camera) {
    // --- scroll ---
    const prev = this.scrollCurrent;
    this.scrollCurrent = lerp(this.scrollCurrent, this.scrollTarget, CFG.scrollLerp);
    this.scrollVelocity = this.scrollCurrent - prev;

    // --- cards ---
    const loopTotal = totalLoopHeight * COPIES;
    const halfLoop = totalLoopHeight * 1.5;

    this.cards.forEach((card) => {
      card.material.uniforms.uTime.value = time;
      let y = card.userData.baseY - this.scrollCurrent * card.userData.parallaxFactor;
      y = mod(y + halfLoop, loopTotal) - halfLoop;

      const dist = Math.abs(y);
      const fadeStart = 3;
      const fadeEnd = 10;
      card.material.uniforms.uOpacity.value =
        dist < fadeStart ? 1 : Math.max(0, 1 - (dist - fadeStart) / (fadeEnd - fadeStart));

      card.position.y = y;
      card.position.z = -CFG.radius;
      card.rotation.x = this.scrollVelocity * 0.35;
      card.material.uniforms.uCardY.value = y;
    });

    // --- center card label ---
    this._updateLabel();

    // --- camera sway ---
    const mx = this.mouseX / window.innerWidth - 0.5;
    const my = this.mouseY / window.innerHeight - 0.5;
    camera.rotation.y = lerp(camera.rotation.y, -mx * 0.08, 0.04);
    camera.rotation.x = lerp(camera.rotation.x, -my * 0.04, 0.04);

    // --- cursor ---
    if (this.cursorEl) {
      this.cursorX = lerp(this.cursorX, this.mouseX, 0.12);
      this.cursorY = lerp(this.cursorY, this.mouseY, 0.12);
      this.cursorEl.style.left = this.cursorX + "px";
      this.cursorEl.style.top = this.cursorY + "px";
    }

    // --- hover ---
    this.mouseNDC.x = (this.mouseX / window.innerWidth) * 2 - 1;
    this.mouseNDC.y = -(this.mouseY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouseNDC, camera);
    const hits = this.raycaster.intersectObjects(this.cards);

    // if (hits.length > 0) {
    //   const card = hits[0].object;
    //   if (card !== this.hoveredCard) {
    //     this.hoveredCard = card;
    //     this.cursorEl.classList.add("hovering");
    //   }
    // } else if (this.hoveredCard) {
    //   this.hoveredCard = null;
    //   this.cursorEl.classList.remove("hovering");
    // }
  }

  // ----------------------------------------------------------
  // GUI用: brightness を一括変更
  // ----------------------------------------------------------
  setBrightness(v) {
    this.brightness = v;
    this.cards.forEach((c) => {
      c.material.uniforms.uBrightness.value = v;
    });
  }

  // ----------------------------------------------------------
  // PRIVATE
  // ----------------------------------------------------------
  _loadTexture(imagePath) {
    const isVideo = /\.(mp4|webm|ogg)$/i.test(imagePath);
    if (isVideo) {
      const video = document.createElement("video");
      video.src = imagePath;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.play();
      const tex = new THREE.VideoTexture(video);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }
    const tex = this.textureLoader.load(imagePath);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  destroy() {
    // イベントリスナー解除
    window.removeEventListener("wheel", this._onWheel);
    window.removeEventListener("touchstart", this._onTouchStart);
    window.removeEventListener("touchmove", this._onTouchMove);
    window.removeEventListener("mousemove", this._onMouseMove);

    // テクスチャ・マテリアル・ジオメトリを破棄
    this.cards.forEach((mesh) => {
      const tex = mesh.material.uniforms.map.value;
      if (tex) tex.dispose();
      mesh.material.dispose();
    });
    if (this.cards.length > 0) {
      this.cards[0].geometry.dispose();
    }
    this.cards = [];
  }

  _bindEvents() {
    let touchPrev = 0;

    this._onWheel = (e) => {
      this.scrollTarget -= e.deltaY * CFG.scrollSpeed;
    };
    this._onTouchStart = (e) => {
      touchPrev = e.touches[0].clientY;
    };
    this._onTouchMove = (e) => {
      const y = e.touches[0].clientY;
      this.scrollTarget -= (touchPrev - y) * CFG.scrollSpeed * 2.5;
      touchPrev = y;
    };
    this._onMouseMove = (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    };

    window.addEventListener("wheel", this._onWheel, { passive: true });
    window.addEventListener("touchstart", this._onTouchStart);
    window.addEventListener("touchmove", this._onTouchMove);
    window.addEventListener("mousemove", this._onMouseMove);
  }

  _updateLabel() {
    let closestDist = Infinity;
    let closestCard = null;
    this.cards.forEach((card) => {
      const d = Math.abs(card.position.y);
      if (d < closestDist) {
        closestDist = d;
        closestCard = card;
      }
    });

    const centerThreshold = cardStep * 0.5;
    if (closestCard && closestDist < centerThreshold) {
      const proj = closestCard.userData.project;
      if (proj !== this.currentCenterProject) {
        this.currentCenterProject = proj;
        if (this.projectTitleEl) {
          this.projectTitleEl.innerHTML = [...proj.title]
            .map((ch, i) => `<span style="animation-delay:${i * 0.04}s">${ch === " " ? "&nbsp;" : ch}</span>`)
            .join("");
        }
        if (this.projectCategoryEl) this.projectCategoryEl.textContent = proj.category;
        if (this.projectLinkEl) this.projectLinkEl.setAttribute("href", proj.link);
      }
      if (this.projectLabelEl) {
        this.projectLabelEl.style.opacity = 1;
        this.projectLabelEl.classList.add("visible");
      }
    } else {
      if (this.projectLabelEl) this.projectLabelEl.classList.remove("visible");
      this.currentCenterProject = null;
    }
  }
}
