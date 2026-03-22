import * as THREE from "three";

import Config from "./Config";

export default class BaseCanvas {
  /**
   * @param {Object} options
   * @param {string}  options.containerId  - コンテナ要素のID (default: "CanvasContainer")
   * @param {number}  options.fov          - カメラFOV (default: Config.fov)
   * @param {number}  options.cameraZ      - カメラZ位置 (default: Config.cameraZ)
   * @param {Object}  options.renderer     - WebGLRenderer に渡すオプション
   * @param {number}  options.clearColor   - クリアカラー (default: 0xffffff)
   */
  constructor(options = {}) {
    // canvasの親要素を取得
    this.container = document.getElementById(options.containerId || "maincanvas");
    this.setConfig(options);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(options.fov ?? Config.fov, Config.aspectRatio, 0.1, 1000);
    this.camera.position.set(0, 0, options.cameraZ ?? Config.cameraZ);

    const defaultRendererOpts = {
      canvas: this.container.querySelector("canvas"),
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    };
    this.renderer = new THREE.WebGLRenderer({
      ...defaultRendererOpts,
      ...options.renderer,
      // canvas は常にコンテナ内の要素を使う
      canvas: this.container.querySelector("canvas"),
    });

    if (options.clearColor !== undefined) {
      this.renderer.setClearColor(options.clearColor);
    } else {
      this.renderer.setClearColor(0xffffff);
    }

    if (options.autoClear !== undefined) {
      this.renderer.autoClear = options.autoClear;
    }

    if (options.outputColorSpace) {
      this.renderer.outputColorSpace = options.outputColorSpace;
    }

    this.renderer.setSize(Config.width, Config.height);
    this.renderer.setPixelRatio(Config.dpr);
  }

  setConfig() {
    // canvasの親要素からサイズを取得
    const { width, height } = this.container.getBoundingClientRect();

    Config.dpr = Math.min(window.devicePixelRatio, 2);
    Config.width = width;
    Config.height = height;
    Config.halfWidth = Config.width / 2;
    Config.halfHeight = Config.height / 2;
    Config.aspectRatio = Config.width / Config.height;
  }
  resizeScene() {
    // PerspectiveCameraのfovからシーンの可視領域を計算
    const fovRad = (Config.fov * Math.PI) / 180;
    Config.sceneHeight = 2 * Math.tan(fovRad / 2) * Config.cameraZ;
    Config.sceneWidth = Config.sceneHeight * Config.aspectRatio;

    this.camera.aspect = Config.aspectRatio;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(Config.width, Config.height);
  }
}
