import Swup from "swup";
import SwupHeadPlugin from "@swup/head-plugin";
import { gsap } from "gsap";
import initThreeScene from "./main";

const swup = new Swup({
  containers: ["#swup"],
  animation: { animate: false },
  plugins: [new SwupHeadPlugin()],
});

let scene = await initThreeScene();

// 離脱: 旧シーン破棄 → 旧コンテンツのDOMをそのままbodyに退避
swup.hooks.on("animation:out:await", async () => {
  // lil-gui等を含む旧シーンを先に破棄
  if (scene) {
    console.log(scene);
    scene.destroy();
    scene = null;
  }

  const container = document.querySelector("#swup");
  const ghost = document.createElement("div");
  ghost.id = "swup-ghost";
  ghost.style.cssText = "position:fixed;inset:0;z-index:0;pointer-events:none;";

  while (container.firstChild) {
    ghost.appendChild(container.firstChild);
  }
  document.body.appendChild(ghost);
  container.style.opacity = "0";
});

// 進入: 新ページが下からスライドして被さる
swup.hooks.on("animation:in:await", async () => {
  const container = document.querySelector("#swup");
  // initThreeScene 内でコンテナの有無を判定するため、常に呼ぶだけでOK
  scene = await initThreeScene();

  const ghost = document.getElementById("swup-ghost");

  gsap.set(container, { y: "100%", opacity: 1 });
  const tl = gsap.timeline();
  if (ghost) {
    await tl
      .to(ghost, {
        opacity: 0,
        duration: 0.4,
      })
      .to(container, {
        y: "0%",
        duration: 1.3,
        ease: "expo.inOut",
      });
  }

  // ghost除去
  if (ghost) ghost.remove();
});
