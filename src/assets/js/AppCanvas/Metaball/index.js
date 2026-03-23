import { Mesh } from "three/src/objects/Mesh";
import { PlaneGeometry } from "three/src/geometries/PlaneGeometry";
import { RawShaderMaterial } from "three/src/materials/RawShaderMaterial";
import { Vector2 } from "three/src/math/Vector2";
import { TextureLoader } from "three/src/loaders/TextureLoader";

import Config from "../Config";
import vertexShader from "./shader/vert.glsl";
import fragmentShader from "./shader/frag.glsl";

const TOTAL_BUBBLES = 110;

export default class Metaball {
  constructor() {
    this.activeBubbles = 60;
    this.t = 0;
    this.mx = -9999;
    this.my = -9999;
    this.spawnBubbles = [];
    this.spawnMax = 10;
  }

  async init() {
    const texture = await this.createTexture();

    const posVec = Array.from({ length: TOTAL_BUBBLES }, () => new Vector2());
    const r2Arr = new Float32Array(TOTAL_BUBBLES);

    const geometry = new PlaneGeometry(2, 2);
    const material = new RawShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uResolution: { value: new Vector2(Config.width, Config.height) },
        uBubblePos: { value: posVec },
        uBubbleR2: { value: r2Arr },
        uThreshold: { value: 3.5 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
    });

    this.mesh = new Mesh(geometry, material);

    this.bubbles = Array.from({ length: TOTAL_BUBBLES }, () => ({
      x: Math.random() * Config.width,
      y: Math.random() * Config.height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      r: 28 + Math.random() * 65,
      phase: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.6,
    }));

    this.initEvents();
  }

  initEvents() {
    this._onPointerMove = (e) => {
      const rect = document.querySelector("#maincanvas").getBoundingClientRect();
      this.mx = e.clientX - rect.left;
      this.my = Config.height - (e.clientY - rect.top);
      this.spawnBubbles.push({ x: this.mx, y: this.my, r: 40, life: 2.0 });
      if (this.spawnBubbles.length > this.spawnMax) {
        this.spawnBubbles.shift();
      }
    };
    this._onPointerLeave = () => {
      this.mx = -9999;
      this.my = -9999;
    };
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerleave", this._onPointerLeave);
  }

  async createTexture() {
    const loader = new TextureLoader();
    const texture = await loader.loadAsync("img/cat.webp");
    return texture;
  }

  resize() {
    const uniforms = this.mesh.material.uniforms;
    uniforms.uResolution.value.set(Config.width, Config.height);
    this.mesh.scale.set(Config.sceneWidth / 2, Config.sceneHeight / 2, 1);
  }

  update({ time, deltaTime }) {
    this.t += 0.015;

    const W = Config.width;
    const H = Config.height;
    const uniforms = this.mesh.material.uniforms;

    for (let i = 0; i < TOTAL_BUBBLES; i++) {
      const b = this.bubbles[i];
      if (i < this.activeBubbles) {
        b.vx *= 0.96;
        b.vy *= 0.96;
        b.x += b.vx + Math.sin(this.t * b.speed + b.phase) * 0.5;
        b.y += b.vy + Math.cos(this.t * b.speed * 0.8 + b.phase) * 0.5;

        uniforms.uBubblePos.value[i].set(b.x, b.y);
        uniforms.uBubbleR2.value[i] = b.r * b.r;
      } else {
        uniforms.uBubbleR2.value[i] = 0;
      }
    }

    // 一時バブルの更新
    const spawnStart = TOTAL_BUBBLES - this.spawnMax;
    for (let j = 0; j < this.spawnMax; j++) {
      const idx = spawnStart + j;
      const sb = this.spawnBubbles[j];
      if (sb && sb.life > 0) {
        sb.life -= 0.09;
        const r = sb.r * sb.life;
        uniforms.uBubblePos.value[idx].set(sb.x, sb.y);
        uniforms.uBubbleR2.value[idx] = r * r;
      } else {
        uniforms.uBubbleR2.value[idx] = 0;
      }
    }

    this.mesh.material.uniformsNeedUpdate = true;
  }

  destroy() {
    if (this._onPointerMove) {
      window.removeEventListener("pointermove", this._onPointerMove);
      window.removeEventListener("pointerleave", this._onPointerLeave);
    }
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      const tex = this.mesh.material.uniforms.uTexture?.value;
      if (tex) tex.dispose();
    }
  }
}
