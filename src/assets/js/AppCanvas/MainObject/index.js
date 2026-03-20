import * as THREE from "three";
import Pointer from "Util/Pointer";
import { Tween2 } from "Util/Tween";

import Config from "../Config";
import vertexShader from "./shader/vert.glsl";
import fragmentShader from "./shader/frag.glsl";

export default class MainObject {
  constructor() {
    this.loader = new THREE.TextureLoader();
  }
  async init() {
    const imageTexture = await this.loader.loadAsync("img/cat.webp");
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.RawShaderMaterial({
      uniforms: {
        imageTexture: { value: imageTexture },
        time: { value: 0 },
        pointer: { value: new THREE.Vector2(0, 0) },
        velocity: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader,
      fragmentShader,
      transparent: false,
    });
    // const material = new THREE.MeshBasicMaterial({ color: 0x6699ff });
    this.mesh = new THREE.Mesh(geometry, material);

    // ポインターの動きをなめらかにするためのTweenを作成
    this.tween = new Tween2({ x: 0, y: 0 }, 10);
  }

  resize() {
    this.mesh.scale.set(Config.sceneWidth, Config.sceneHeight, 1);
  }

  update({ time, deltaTime }) {
    // Pointerの座標をthree.jsのシーン用に変換
    const px = -Config.sceneWidth / 2 + (Pointer.x / window.innerWidth) * Config.sceneWidth;
    const py = Config.sceneHeight / 2 - (Pointer.y / window.innerHeight) * Config.sceneHeight;
    console.log(px, py);
    this.tween.update({ x: -px, y: -py }, deltaTime);

    this.mesh.material.uniforms.time.value = time;
    this.mesh.material.uniforms.pointer.value.x = this.tween.position.x;
    this.mesh.material.uniforms.pointer.value.y = this.tween.position.y;
    this.mesh.material.uniforms.velocity.value.x = this.tween.velocity.x;
    this.mesh.material.uniforms.velocity.value.y = this.tween.velocity.y;
  }
}
