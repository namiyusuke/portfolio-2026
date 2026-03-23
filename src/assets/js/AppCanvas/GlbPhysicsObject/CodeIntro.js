import * as THREE from "three";

const CODE_SNIPPETS = [
  `precision highp float;

uniform sampler2D imageTexture;
uniform float time;
uniform vec2 pointer;
uniform vec2 velocity;

varying vec2 vUv;

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 permute(vec4 x) {
  return mod289(((x*34.0)+10.0)*x);
}
vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  // Permutations
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(
    dot(p0,p0), dot(p1,p1),
    dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.5 - vec4(
    dot(x0,x0), dot(x1,x1),
    dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m*m, vec4(
    dot(p0,x0), dot(p1,x1),
    dot(p2,x2), dot(p3,x3)));
}

void main() {
  vec2 uv = vUv;
  float dist = distance(uv - 0.5, -pointer * 0.5);
  float influence = smoothstep(0.5, 0.0, dist);

  float div = 20.0;
  float nx = ceil(uv.x * div) / div;
  float ny = ceil(uv.y * div) / div;
  float n = snoise(vec3(nx * 3.0, ny * 3.0, 0.0));

  float moveX = n * velocity.x * 5.0 * influence;
  float moveY = n * velocity.y * 5.0 * influence;
  uv += vec2(moveX, moveY);

  gl_FragColor = texture2D(imageTexture, uv);
}`,

  `#define TOTAL_BUBBLES 110
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uBubblePos[TOTAL_BUBBLES];
uniform float uBubbleR2[TOTAL_BUBBLES];
uniform float uThreshold;

varying vec2 vPx;

void main() {
  float sum = 0.0;
  for (int i = 0; i < TOTAL_BUBBLES; i++) {
    if (uBubbleR2[i] <= 0.0) continue;
    vec2 d = vPx - uBubblePos[i];
    float distSq = dot(d, d);
    if (distSq > 0.0) {
      float ratio = sqrt(uBubbleR2[i] / distSq);
      sum += ratio * ratio *ratio * ratio;
    }
    if (sum >= uThreshold) break;
  }
  if (sum < uThreshold) discard;
  // Cover mapping for square texture
  float drawSize = max(uResolution.x, uResolution.y);
  vec2 uv = (vPx + (vec2(drawSize) - uResolution) * 0.5) / drawSize;
  gl_FragColor = texture2D(uTexture, uv);
}

precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 uResolution;

attribute vec3 position;
attribute vec2 uv;

varying vec2 vPx;

void main() {
  vPx = uv * uResolution;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

import { Mesh } from 'three/src/objects/Mesh'
import { PlaneGeometry } from 'three/src/geometries/PlaneGeometry'
import { RawShaderMaterial } from 'three/src/materials/RawShaderMaterial'
import { Vector2 } from 'three/src/math/Vector2'
import { TextureLoader } from 'three/src/loaders/TextureLoader'

import Config from '../Config'
import vertexShader from './shader/vert.glsl'
import fragmentShader from './shader/frag.glsl'

const TOTAL_BUBBLES = 110

export default class Metaball {
  constructor() {
    this.activeBubbles = 60
    this.t = 0
    this.mx = -9999
    this.my = -9999
    this.spawnBubbles = []
    this.spawnMax = 10
  }

  async init() {
    const texture = await this.createTexture()

    const posVec = Array.from({ length: TOTAL_BUBBLES }, () => new Vector2())
    const r2Arr = new Float32Array(TOTAL_BUBBLES)

    const geometry = new PlaneGeometry(2, 2)
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
    })

    this.mesh = new Mesh(geometry, material)

    this.bubbles = Array.from({ length: TOTAL_BUBBLES }, () => ({
      x: Math.random() * Config.width,
      y: Math.random() * Config.height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      r: 28 + Math.random() * 65,
      phase: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.6,
    }))

    this.initEvents()
  }

  resize() {
    const uniforms = this.mesh.material.uniforms
    uniforms.uResolution.value.set(Config.width, Config.height)
    this.mesh.scale.set(Config.sceneWidth / 2, Config.sceneHeight / 2, 1)
  }

  update({ time, deltaTime }) {
    this.t += 0.015
    const W = Config.width
    const H = Config.height
    const uniforms = this.mesh.material.uniforms

    for (let i = 0; i < TOTAL_BUBBLES; i++) {
      const b = this.bubbles[i]
      if (i < this.activeBubbles) {
        b.vx *= 0.96
        b.vy *= 0.96
        b.x += b.vx + Math.sin(this.t * b.speed + b.phase) * 0.5
        b.y += b.vy + Math.cos(this.t * b.speed * 0.8 + b.phase) * 0.5

        uniforms.uBubblePos.value[i].set(b.x, b.y)
        uniforms.uBubbleR2.value[i] = b.r * b.r
      } else {
        uniforms.uBubbleR2.value[i] = 0
      }
    }

    this.mesh.material.uniformsNeedUpdate = true
  }
}`,
];

const KEYWORDS = new Set([
  // GLSL
  "precision",
  "highp",
  "mediump",
  "lowp",
  "float",
  "int",
  "bool",
  "uniform",
  "varying",
  "attribute",
  "void",
  "discard",
  "vec2",
  "vec3",
  "vec4",
  "mat2",
  "mat3",
  "mat4",
  "sampler2D",
  "samplerCube",
  // JS shared
  "const",
  "let",
  "return",
  "if",
  "else",
  "for",
  "while",
  "import",
  "from",
  "export",
  "default",
  "class",
  "constructor",
  "this",
  "new",
  "async",
  "await",
  "true",
  "false",
]);

export default class CodeIntro {
  constructor() {
    this.charsPerSecond = 60;
    this.fadeOutDuration = 1.0;
    this.progress = 0;
    this.opacity = 1;
    this.isComplete = false;
    this.isFadingOut = false;
    this.isDone = false;
    this.charIndex = 0;
    this.prevCharIndex = -1;
    this.elapsedTime = 0;
    this.fadeStartTime = 0;
    this.fontLoaded = false;
    this.canvas2d = document.createElement("canvas");
    this.canvas2d.width = 1024;
    this.canvas2d.height = 768;
    this.ctx = this.canvas2d.getContext("2d");

    const code = CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)];
    this.lines = code.split("\n");
    this.totalChars = code.length;

    this.texture = null;
    this.mesh = null;
    this.group = new THREE.Group();

    this._loadFont();
    this._initMesh();
  }

  _loadFont() {
    const font = new FontFace("HackGenConsoleNF", "url(/fonts/HackGenConsoleNF-Regular.ttf)");
    font.load().then((loaded) => {
      document.fonts.add(loaded);
      this.fontLoaded = true;
    });
  }

  _initMesh() {
    this.texture = new THREE.CanvasTexture(this.canvas2d);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 1,
    });

    const planeHeight = 8.0;
    const planeWidth = planeHeight * (1024 / 768);

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.z = -2;
    this.mesh.position.y = 0.4;
    this.mesh.renderOrder = 1;

    this.group.add(this.mesh);
    this._clearCanvas();
  }

  _clearCanvas() {
    this.ctx.clearRect(0, 0, 1024, 768);
  }

  _renderText() {
    this._clearCanvas();

    const ctx = this.ctx;
    const fontSize = 20;
    const lineHeight = 18;
    const paddingX = 30;
    const paddingY = 25;

    ctx.font = `${fontSize}px "HackGenConsoleNF", monospace`;
    ctx.textBaseline = "top";

    const canvasHeight = this.canvas2d.height;
    const visibleChars = this.charIndex;

    // 現在の行数を数えてスクロールオフセットを計算
    let currentLine = 0;
    let charCount = 0;
    for (let i = 0; i < this.lines.length; i++) {
      if (charCount + this.lines[i].length < visibleChars) {
        charCount += this.lines[i].length + 1;
        currentLine = i + 1;
      } else {
        currentLine = i;
        break;
      }
    }

    const cursorY = paddingY + currentLine * lineHeight;
    const scrollOffset = Math.max(0, cursorY - (canvasHeight - paddingY - lineHeight));

    charCount = 0;
    let y = paddingY - scrollOffset;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];

      if (charCount + line.length < visibleChars) {
        if (y + lineHeight > 0 && y < canvasHeight) {
          this._drawLine(ctx, line, paddingX, y);
        }
        charCount += line.length + 1;
        y += lineHeight;
      } else if (charCount < visibleChars) {
        const showCount = visibleChars - charCount;
        const partialLine = line.substring(0, showCount);
        this._drawLine(ctx, partialLine, paddingX, y);

        // カーソル
        const cursorX = paddingX + ctx.measureText(partialLine).width;
        ctx.fillStyle = "rgba(255, 200, 150, 0.8)";
        ctx.fillRect(cursorX, y, 2, fontSize);
        break;
      } else {
        break;
      }
    }

    this.texture.needsUpdate = true;
  }

  _drawLine(ctx, text, x, y) {
    const tokens = this._tokenize(text);
    let cursorX = x;

    for (const token of tokens) {
      if (token.startsWith("//")) {
        ctx.fillStyle = "rgba(120, 100, 80, 0.5)";
      } else if (KEYWORDS.has(token)) {
        ctx.fillStyle = "rgba(255, 160, 100, 0.6)";
      } else if (/^\d/.test(token)) {
        ctx.fillStyle = "rgba(255, 220, 130, 0.55)";
      } else {
        ctx.fillStyle = "rgba(255, 200, 150, 0.4)";
      }
      ctx.fillText(token, cursorX, y);
      cursorX += ctx.measureText(token).width;
    }
  }

  _tokenize(text) {
    const commentIdx = text.indexOf("//");
    if (commentIdx === 0) return [text];

    const tokens = [];
    if (commentIdx > 0) {
      tokens.push(...this._splitTokens(text.substring(0, commentIdx)));
      tokens.push(text.substring(commentIdx));
    } else {
      tokens.push(...this._splitTokens(text));
    }
    return tokens;
  }

  _splitTokens(text) {
    return text.match(/\s+|[a-zA-Z_]\w*|\d+\.?\d*|./g) || [];
  }

  update({ time, deltaTime }) {
    if (this.isDone) return;

    this.elapsedTime += deltaTime;

    if (!this.isFadingOut) {
      const newCharIndex = Math.min(Math.floor(this.elapsedTime * this.charsPerSecond), this.totalChars);

      if (newCharIndex !== this.prevCharIndex) {
        this.charIndex = newCharIndex;
        this.prevCharIndex = newCharIndex;
        this._renderText();
      }

      this.progress = this.charIndex / this.totalChars;

      if (this.charIndex >= this.totalChars) {
        this.isComplete = true;
        this.isFadingOut = false;
        this.fadeStartTime = this.elapsedTime;
      }
    } else {
      const fadeElapsed = this.elapsedTime - this.fadeStartTime;
      this.opacity = Math.max(0, 1 - fadeElapsed / this.fadeOutDuration);
      this.mesh.material.opacity = this.opacity;

      if (this.opacity <= 0) {
        this.isDone = true;
        this.group.remove(this.mesh);
        this._dispose();
      }
    }
  }

  _dispose() {
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
    this.canvas2d = null;
    this.ctx = null;
  }

  destroy() {
    this.isDone = true;
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this._dispose();
  }
}
