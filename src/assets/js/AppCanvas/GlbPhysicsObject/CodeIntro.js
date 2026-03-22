import * as THREE from "three";

const GLSL_CODE = `precision highp float;

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
}`;

const KEYWORDS = new Set([
  "precision", "highp", "mediump", "lowp", "float", "int", "bool",
  "uniform", "varying", "attribute", "const", "void", "return",
  "if", "else", "for", "while", "discard",
  "vec2", "vec3", "vec4", "mat2", "mat3", "mat4",
  "sampler2D", "samplerCube",
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

    this.canvas2d = document.createElement("canvas");
    this.canvas2d.width = 1024;
    this.canvas2d.height = 768;
    this.ctx = this.canvas2d.getContext("2d");

    this.lines = GLSL_CODE.split("\n");
    this.totalChars = GLSL_CODE.length;

    this.texture = null;
    this.mesh = null;
    this.group = new THREE.Group();

    this._initMesh();
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
    this.mesh.renderOrder = -1;

    this.group.add(this.mesh);
    this._clearCanvas();
  }

  _clearCanvas() {
    this.ctx.clearRect(0, 0, 1024, 768);
  }

  _renderText() {
    this._clearCanvas();

    const ctx = this.ctx;
    const fontSize = 13;
    const lineHeight = 18;
    const paddingX = 30;
    const paddingY = 25;

    ctx.font = `${fontSize}px "SFMono-Regular", Consolas, "Liberation Mono", "Courier New", monospace`;
    ctx.textBaseline = "top";

    const visibleChars = this.charIndex;
    let charCount = 0;
    let y = paddingY;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];

      if (charCount + line.length < visibleChars) {
        this._drawLine(ctx, line, paddingX, y);
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
      const newCharIndex = Math.min(
        Math.floor(this.elapsedTime * this.charsPerSecond),
        this.totalChars,
      );

      if (newCharIndex !== this.prevCharIndex) {
        this.charIndex = newCharIndex;
        this.prevCharIndex = newCharIndex;
        this._renderText();
      }

      this.progress = this.charIndex / this.totalChars;

      if (this.charIndex >= this.totalChars) {
        this.isComplete = true;
        this.isFadingOut = true;
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
