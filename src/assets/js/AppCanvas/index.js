import * as THREE from "three";
import BaseCanvas from "./BaseCanvas";
import GlbPhysicsObject from "./GlbPhysicsObject";
import CodeIntro from "./GlbPhysicsObject/CodeIntro";

export default class AppCanvas extends BaseCanvas {
  constructor() {
    super({
      fov: 45,
      cameraZ: 8.5,
      renderer: {
        antialias: true,
        depth: true,
        stencil: false,
      },
      clearColor: 0x1a1108,
      outputColorSpace: THREE.SRGBColorSpace,
    });

    this.isReady = false;
    this.camera.position.y = 0.4;

    // トーンマッピング
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this._initLights();
    this.init();
  }

  async init() {
    // コードイントロを先にシーンに追加
    this.codeIntro = new CodeIntro();
    this.scene.add(this.codeIntro.group);

    this.mainObject = new GlbPhysicsObject();
    await this.mainObject.init();
    this.mainObject.setCamera(this.camera);
    this.scene.add(this.mainObject.group);
    this.resize();
    this.isReady = true;
  }

  _initLights() {
    const hemiLight = new THREE.HemisphereLight(0xfff1e5, 0xffd8bf, 1.8);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(0, 10.4, 0);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffb994, 0.85);
    rimLight.position.set(-3.6, 2.2, -2.1);
    this.scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xff8f63, 1.3, 20, 2);
    fillLight.position.set(0.4, -0.6, 1.8);
    this.scene.add(fillLight);

    this.lights = [hemiLight, keyLight, rimLight, fillLight];
  }

  resize() {
    this.setConfig();
    this.resizeScene();
    if (this.mainObject) {
      this.mainObject.resize();
    }
  }

  update({ time, deltaTime }) {
    if (!this.isReady) return;

    // コードイントロの更新とボール出現制御
    if (this.codeIntro && !this.codeIntro.isDone) {
      this.codeIntro.update({ time, deltaTime });
      this.mainObject.showBallAtProgress(this.codeIntro.progress);

      if (this.codeIntro.isDone) {
        this.mainObject.introComplete = true;
        this.scene.remove(this.codeIntro.group);
        this.codeIntro = null;
      }
    }

    this.mainObject.update({ time, deltaTime });
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.isReady = false;
    if (this.codeIntro) {
      this.codeIntro.destroy();
      this.scene.remove(this.codeIntro.group);
      this.codeIntro = null;
    }
    if (this.mainObject) {
      this.mainObject.destroy();
      this.scene.remove(this.mainObject.group);
    }
    if (this.lights) {
      this.lights.forEach((l) => this.scene.remove(l));
    }
    this.renderer.dispose();
  }
}
