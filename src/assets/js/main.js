import WorksCanvas from "./AppCanvas/WorksCanvas";

/**
 * Three.js シーンを初期化し、destroyable なオブジェクトを返す。
 * CanvasContainer が存在しないページでは null を返す。
 */
export default function initThreeScene() {
  if (!document.getElementById("CanvasContainer")) return null;

  const app = new WorksCanvas();
  let lastUpdateTime = performance.now() * 0.001;
  let rafId = null;

  const resize = {
    prevSize: { w: 0, h: 0 },
    checkTime: 0,
    interval: 500 * 0.001,
  };

  function update() {
    rafId = requestAnimationFrame(update);

    const time = performance.now() * 0.001;
    if (checkResize(time)) {
      app.resize();
    }

    const deltaTime = time - lastUpdateTime;
    lastUpdateTime = time;

    app.update({ time, deltaTime });
  }

  function checkResize(time) {
    if (time - resize.checkTime < resize.interval) return false;
    resize.checkTime = time;

    if (window.innerWidth !== resize.prevSize.w || window.innerHeight !== resize.prevSize.h) {
      resize.prevSize.w = window.innerWidth;
      resize.prevSize.h = window.innerHeight;
      return true;
    }

    return false;
  }

  update();

  return {
    destroy() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      app.destroy();
    },
  };
}
