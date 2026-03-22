import * as THREE from "three";
import GUI from "lil-gui";
import BaseCanvas from "./BaseCanvas";
import CardGallery from "./CardGallery";

// ============================================================
// Background — Simplex noise gradient shader
// ============================================================
const bgFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 v_uv;
  uniform float u_time;
  uniform float u_speed;
  uniform float u_scale;
  uniform float u_softness;
  uniform vec2  u_resolution;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4  j  = p - 49.0 * floor(p * ns.z * ns.z);
    vec4  x_ = floor(j * ns.z);
    vec4  y_ = floor(j - 7.0 * x_);
    vec4  x  = x_ * ns.x + ns.yyyy;
    vec4  y  = y_ * ns.x + ns.yyyy;
    vec4  h  = 1.0 - abs(x) - abs(y);
    vec4  b0 = vec4(x.xy, y.xy);
    vec4  b1 = vec4(x.zw, y.zw);
    vec4  s0 = floor(b0) * 2.0 + 1.0;
    vec4  s1 = floor(b1) * 2.0 + 1.0;
    vec4  sh = -step(h, vec4(0.0));
    vec4  a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4  a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3  p0 = vec3(a0.xy, h.x);
    vec3  p1 = vec3(a0.zw, h.y);
    vec3  p2 = vec3(a1.xy, h.z);
    vec3  p3 = vec3(a1.zw, h.w);
    vec4  norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4  m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    float aspect = u_resolution.x / u_resolution.y;
    vec2 uv = v_uv;
    uv.x *= aspect;
    float t = u_time * u_speed;
    vec2 st = uv * u_scale;
    float n1 = snoise(vec3(st, t));
    float n2 = snoise(vec3(st * 0.8 + vec2(17.1, 31.7), t * 0.7));
    float n3 = snoise(vec3(st * 0.6 + vec2(53.4, 89.2), t * 0.5));
    float n = (n1 * 0.45 + n2 * 0.35 + n3 * 0.2);
    n = n * 0.35 + 0.5;
    float lo = 0.5 - u_softness * 0.5;
    float hi = 0.5 + u_softness * 0.5;
    n = smoothstep(lo, hi, n);
    n = n * n * (3.0 - 2.0 * n);
    vec3 black = vec3(0.04, 0.04, 0.05);
    vec3 white = vec3(0.96, 0.95, 0.93);
    vec3 color = mix(black, white, n);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export default class WorksCanvas extends BaseCanvas {
  constructor() {
    super({
      containerId: "CanvasContainer",
      fov: 50,
      cameraZ: 1,
      renderer: {
        antialias: true,
        powerPreference: "high-performance",
        depth: true,
        stencil: true,
      },
      autoClear: false,
      outputColorSpace: THREE.SRGBColorSpace,
    });

    this.isReady = false;
    this._initBgScene();
    this._initGUI();
    this.init();
  }

  async init() {
    this.cardGallery = new CardGallery();
    await this.cardGallery.init();
    this.scene.add(this.cardGallery.group);

    // GUI: brightness
    this.gui.add({ brightness: 1.0 }, "brightness", 0, 3, 0.05).name("brightness").onChange((v) => {
      this.cardGallery.setBrightness(v);
    });

    this.resize();
    this.isReady = true;
  }

  resize() {
    this.setConfig();
    this.resizeScene();
    if (this.cardGallery) {
      this.cardGallery.resize();
    }
    this.bgUniforms.u_resolution.value.set(
      window.innerWidth * this.renderer.getPixelRatio(),
      window.innerHeight * this.renderer.getPixelRatio(),
    );
  }

  destroy() {
    this.isReady = false;

    // GUI破棄（最優先）
    if (this.gui) {
      this.gui.destroy();
      this.gui = null;
    }

    // CardGallery 破棄
    if (this.cardGallery) {
      this.cardGallery.destroy();
      this.scene.remove(this.cardGallery.group);
    }

    // BG破棄
    if (this.bgMesh) {
      this.bgMesh.geometry.dispose();
      this.bgMesh.material.dispose();
    }

    // Renderer破棄
    this.renderer.dispose();
  }

  update({ time, deltaTime }) {
    if (!this.isReady) return;

    // CardGallery 更新（camera を渡して sway も任せる）
    this.cardGallery.update({ time, deltaTime }, this.camera);

    // Background
    this.bgUniforms.u_time.value = time;

    // Multi-pass render
    this.renderer.clear();
    this.renderer.render(this.bgScene, this.bgCamera);
    this.renderer.render(this.scene, this.camera);
  }

  // ----------------------------------------------------------
  // PRIVATE
  // ----------------------------------------------------------
  _initBgScene() {
    this.bgScene = new THREE.Scene();
    this.bgCamera = new THREE.Camera();

    this.bgUniforms = {
      u_time: { value: 0 },
      u_speed: { value: 0.16 },
      u_scale: { value: 0.5 },
      u_softness: { value: 0.9 },
      u_resolution: {
        value: new THREE.Vector2(
          window.innerWidth * this.renderer.getPixelRatio(),
          window.innerHeight * this.renderer.getPixelRatio(),
        ),
      },
    };

    this.bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: this.bgUniforms,
        vertexShader: /* glsl */ `
          varying vec2 v_uv;
          void main() {
            v_uv = uv;
            gl_Position = vec4(position.xy, 1.0, 1.0);
          }
        `,
        fragmentShader: bgFragmentShader,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.bgScene.add(this.bgMesh);
  }

  _initGUI() {
    this.gui = new GUI();
    this.gui.add(this.bgUniforms.u_time, "value").min(0).max(10).step(0.1).name("u_time");
    this.gui.add(this.bgUniforms.u_speed, "value").min(0).max(1).step(0.1).name("u_speed");
    this.gui.add(this.bgUniforms.u_scale, "value").min(0).max(1).step(0.1).name("u_scale");
    this.gui.add(this.bgUniforms.u_softness, "value").min(0).max(1).step(0.1).name("u_softness");
  }
}
