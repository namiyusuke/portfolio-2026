import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import Pointer from "Util/Pointer";
import { PHYSICS } from "./PhysicsConfig";

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const zAxis = new THREE.Vector3(0, 0, 1);
const stretchAxis = new THREE.Vector3();
const tQuat = new THREE.Quaternion();
const iQuat = new THREE.Quaternion();

function smoothstep01(v) {
  return v * v * (3 - 2 * v);
}

function fitModelToRadius(obj, targetRadius) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) obj.scale.multiplyScalar((targetRadius * 2) / maxDim);
  const center = new THREE.Vector3();
  new THREE.Box3().setFromObject(obj).getCenter(center);
  obj.position.sub(center);
}

export default class GlbPhysicsObject {
  constructor() {
    this.loader = new GLTFLoader();
    this.group = new THREE.Group();
    this.balls = [];
    this.modelTemplates = [];
    this.currentModelIndex = 0;

    // 固定タイムステップ用
    this.lastTime = 0;
    this.dtOff = 0;

    // モデル切り替えタイマー
    this.switchTimer = 0;

    // マウスインタラクション用
    this.mouseNdc = new THREE.Vector2(0, 0);
    this.mouseWorld = new THREE.Vector3(999, 999, 0);
    this.raycaster = new THREE.Raycaster();
    this.interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.effectiveMouseStrength = 0;
    this.hasMouseMoved = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;

    // カメラ参照
    this.camera = null;

    // イントロ制御
    this.introComplete = false;
  }

  async init() {
    const gltfs = await Promise.all(PHYSICS.glbUrls.map((url) => this.loader.loadAsync(url)));
    this.modelTemplates = gltfs.map((g) => g.scene);
    this._initBalls();
  }

  setCamera(camera) {
    this.camera = camera;
  }

  _createBall(modelTemplate, x, z) {
    const root = new THREE.Group();
    const deform = new THREE.Group();
    root.add(deform);
    const visual = modelTemplate.clone();
    fitModelToRadius(visual, 1);
    visual.rotation.y = Math.random() * Math.PI * 2;
    deform.add(visual);
    root.position.set(x, 0, z);
    this.group.add(root);

    const spinSpeed = (0.3 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
    return {
      mesh: root,
      deform,
      visual,
      spinSpeed,
      radius: 1,
      invMass: 1,
      position: new THREE.Vector3(x, 0, z),
      prevPosition: new THREE.Vector3(x, 0, z),
      target: new THREE.Vector3(x, 0, z),
      velocity: new THREE.Vector3(),
      softPrevPosition: new THREE.Vector3(x, 0, z),
      softOffset: new THREE.Vector3(),
      softVelocity: new THREE.Vector3(),
      stretchBlend: 0,
      breathingBlend: 0,
      breathingPhase: Math.random() * Math.PI * 2,
      popScale: 0,
      visible: false,
    };
  }

  _initBalls() {
    const D = PHYSICS.initialCenterDistance;
    const Z = PHYSICS.initialDepthOffset;
    const modelTemplate = this.modelTemplates[0];

    const xHalf = Math.sqrt(D * D - Z * 2 * (Z * 2)) * 0.1;
    const xHalf2 = Math.sqrt(D * D - Z * 2 * (Z * 2)) * 0.4;

    this.balls = [
      this._createBall(modelTemplate, -xHalf, -Z),
      this._createBall(modelTemplate, xHalf, Z),
      this._createBall(modelTemplate, xHalf2, Z),
      this._createBall(modelTemplate, -xHalf2, Z),
    ];
  }

  _switchModel() {
    this.currentModelIndex = (this.currentModelIndex + 1) % this.modelTemplates.length;
    const newTemplate = this.modelTemplates[this.currentModelIndex];
    for (const b of this.balls) {
      b.deform.remove(b.visual);
      const newVisual = newTemplate.clone();
      fitModelToRadius(newVisual, 1);
      newVisual.rotation.y = Math.random() * Math.PI * 2;
      b.deform.add(newVisual);
      b.visual = newVisual;
      b.popScale = 0.01;
    }
  }

  showBallAtProgress(progress) {
    const thresholds = [0.15, 0.35, 0.60, 0.85];
    for (let i = 0; i < this.balls.length; i++) {
      if (!this.balls[i].visible && progress >= thresholds[i]) {
        this.balls[i].visible = true;
        this.balls[i].popScale = 0.01;
      }
    }
  }

  resize() {
    // 3D物理シーンでは特別なリサイズ処理は不要
  }

  update({ time, deltaTime }) {
    if (!this.camera || this.balls.length === 0) return;

    // Pointerの変化を検知
    const px = Pointer.x;
    const py = Pointer.y;
    if (px !== this.lastPointerX || py !== this.lastPointerY) {
      this.hasMouseMoved = true;
      this.lastPointerX = px;
      this.lastPointerY = py;
      const r = this.camera;
      this.mouseNdc.x = (px / window.innerWidth) * 2 - 1;
      this.mouseNdc.y = -(py / window.innerHeight) * 2 + 1;
    }

    // 固定タイムステップ物理演算
    const frameDtMs = Math.min(deltaTime * 1000, PHYSICS.maxFrameDtMs);
    this.dtOff += frameDtMs;
    let steps = 0;
    while (this.dtOff >= PHYSICS.fixedDtMs && steps < PHYSICS.maxCatchupSteps) {
      this._fixedUpdate();
      this.dtOff -= PHYSICS.fixedDtMs;
      steps++;
    }
    if (steps >= PHYSICS.maxCatchupSteps) this.dtOff = 0;

    // レンダリング用の補間
    this._render(this.dtOff / PHYSICS.fixedDtMs, time);

    // モデル切り替え（イントロ完了後のみ）
    if (this.introComplete) {
      this.switchTimer += deltaTime * 1000;
      if (this.switchTimer >= PHYSICS.modelSwitchInterval) {
        this.switchTimer = 0;
        this._switchModel();
      }
    }
  }

  _fixedUpdate() {
    // マウスワールド座標の更新
    if (this.hasMouseMoved) {
      this.raycaster.setFromCamera(this.mouseNdc, this.camera);
      this.raycaster.ray.intersectPlane(this.interactionPlane, this.mouseWorld);
      this.effectiveMouseStrength +=
        (PHYSICS.mouseStrength - this.effectiveMouseStrength) * 0.16;
    } else {
      this.effectiveMouseStrength *= 0.92;
    }
    this.hasMouseMoved = false;

    // スプリング力（ターゲットへの復元）
    for (const b of this.balls) {
      tmpA.copy(b.target).sub(b.position);
      b.velocity.addScaledVector(tmpA, PHYSICS.springK);
    }

    // マウス反発力
    if (this.effectiveMouseStrength > 0.0005) {
      for (const b of this.balls) {
        const dx = b.position.x - this.mouseWorld.x;
        const dy = b.position.y - this.mouseWorld.y;
        const dSq = dx * dx + dy * dy;
        const rad = PHYSICS.mouseRadius + b.radius;
        if (dSq >= rad * rad || dSq <= 1e-4) continue;
        const d = Math.sqrt(dSq);
        const a = smoothstep01(1 - d / rad);
        const imp = a * this.effectiveMouseStrength * b.invMass;
        b.velocity.x += (dx / d) * imp;
        b.velocity.y += (dy / d) * imp;
        b.velocity.multiplyScalar(1 - a * 0.15);
      }
    }

    // 速度制限・位置更新・減衰
    const msSq = PHYSICS.maxSpeed * PHYSICS.maxSpeed;
    for (const b of this.balls) {
      b.prevPosition.copy(b.position);
      const sSq = b.velocity.lengthSq();
      if (sSq > msSq) b.velocity.multiplyScalar(PHYSICS.maxSpeed / Math.sqrt(sSq));
      b.position.add(b.velocity);
      b.velocity.multiplyScalar(PHYSICS.damping);
      if (Math.abs(b.velocity.x) < 1e-4) b.velocity.x = 0;
      if (Math.abs(b.velocity.y) < 1e-4) b.velocity.y = 0;
      if (Math.abs(b.velocity.z) < 1e-4) b.velocity.z = 0;
    }

    // ボール間衝突
    for (let iter = 0; iter < PHYSICS.iterations; iter++) {
      for (let i = 0; i < this.balls.length; i++) {
        for (let j = i + 1; j < this.balls.length; j++) {
          const a = this.balls[i];
          const b = this.balls[j];
          const nx = b.position.x - a.position.x;
          const ny = b.position.y - a.position.y;
          const nz = b.position.z - a.position.z;
          const dSq = nx * nx + ny * ny + nz * nz;
          const minD = a.radius + b.radius + PHYSICS.minSeparation;
          if (dSq >= minD * minD) continue;
          const dist = Math.sqrt(dSq) || 0.001;
          const pen = minD - dist;
          const inv = 1 / dist;
          const ux = nx * inv;
          const uy = ny * inv;
          const uz = nz * inv;
          const iSum = a.invMass + b.invMass;
          const wa = a.invMass / iSum;
          const wb = b.invMass / iSum;
          const corr = Math.min(pen * PHYSICS.separationStrength, 0.05);
          a.position.x -= ux * corr * wa;
          a.position.y -= uy * corr * wa;
          a.position.z -= uz * corr * wa;
          b.position.x += ux * corr * wb;
          b.position.y += uy * corr * wb;
          b.position.z += uz * corr * wb;
          const rDot =
            (a.velocity.x - b.velocity.x) * ux +
            (a.velocity.y - b.velocity.y) * uy +
            (a.velocity.z - b.velocity.z) * uz;
          if (rDot > 0) {
            const imp = rDot * PHYSICS.restitution;
            a.velocity.x -= ux * imp * wa;
            a.velocity.y -= uy * imp * wa;
            a.velocity.z -= uz * imp * wa;
            b.velocity.x += ux * imp * wb;
            b.velocity.y += uy * imp * wb;
            b.velocity.z += uz * imp * wb;
          }
        }
      }
    }

    // ソフトボディ内部スプリング
    for (const b of this.balls) {
      const dx = b.position.x - b.softPrevPosition.x;
      const dy = b.position.y - b.softPrevPosition.y;
      const dz = b.position.z - b.softPrevPosition.z;
      b.softVelocity.x += (dx - b.softOffset.x) * PHYSICS.springStiffness;
      b.softVelocity.y += (dy - b.softOffset.y) * PHYSICS.springStiffness;
      b.softVelocity.z += (dz - b.softOffset.z) * PHYSICS.springStiffness;
      b.softVelocity.multiplyScalar(PHYSICS.springDamping);
      b.softOffset.add(b.softVelocity);
      b.softPrevPosition.copy(b.position);
    }
  }

  _render(alpha, time) {
    const t = time;
    for (const b of this.balls) {
      if (!b.visible) {
        b.mesh.visible = false;
        continue;
      }
      b.mesh.visible = true;

      tmpB.copy(b.prevPosition).lerp(b.position, alpha);
      b.mesh.position.copy(tmpB);

      const dx = b.softOffset.x;
      const dy = b.softOffset.y;
      const dz = b.softOffset.z;
      const sLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
      b.stretchBlend += ((sLen > 0.001 ? 1 : 0) - b.stretchBlend) * 0.1;
      if (sLen < 8e-4) b.breathingBlend += (1 - b.breathingBlend) * 0.05;
      else if (sLen > 0.002) b.breathingBlend *= 0.9;

      const breath =
        b.breathingBlend > 0.01
          ? 1 +
            Math.sin(t * PHYSICS.breathingSpeed + b.breathingPhase) *
              PHYSICS.breathingAmplitude *
              b.breathingBlend
          : 1;

      // ポップアニメーション
      b.popScale += (1 - b.popScale) * 0.08;

      if (b.stretchBlend > 0.01 && sLen > 1e-4) {
        const sf = 1 + Math.min(sLen / 0.15, 1) * PHYSICS.stretchAmount * b.stretchBlend;
        const pp = 1 / Math.sqrt(sf);
        stretchAxis.set(dx / sLen, dy / sLen, dz / sLen);
        tQuat.setFromUnitVectors(zAxis, stretchAxis);
        b.deform.quaternion.slerp(tQuat, 0.25);
        b.deform.scale.set(
          breath * pp * b.popScale,
          breath * pp * b.popScale,
          breath * sf * b.popScale,
        );
      } else {
        b.deform.quaternion.slerp(iQuat, 0.12);
        b.deform.scale.setScalar(breath * b.popScale);
      }
    }
  }

  destroy() {
    // ボールのメッシュをグループから除去
    for (const b of this.balls) {
      this.group.remove(b.mesh);
    }
    this.balls = [];

    // オリジナルモデルテンプレートのリソース解放
    for (const template of this.modelTemplates) {
      template.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      });
    }
    this.modelTemplates = [];
  }
}
