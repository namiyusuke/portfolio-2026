import BaseCanvas from "./BaseCanvas";
import MainObject from "./MainObject";

export default class AppCanvas extends BaseCanvas {
  constructor() {
    super();
    this.isReady = false;
    this.init();
  }
  async init() {
    // Meshを作成してシーンに追加
    this.mainObject = new MainObject();
    await this.mainObject.init();
    this.scene.add(this.mainObject.mesh);
    // リサイズをしておいて準備完了
    this.resize();
    this.isReady = true;
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

    // MeshとRendererを更新
    this.mainObject.update({ time, deltaTime });
    this.renderer.render(this.scene, this.camera);
  }
}
