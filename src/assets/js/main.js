/**
 * コンテナIDと動的インポートのマッピング。
 * デモを追加する場合はここに1行足すだけでOK。
 */
const CANVAS_MAP = [
{ id: "CanvasContainer",  load: () => import("./AppCanvas/WorksCanvas") },
  { id: "maincanvas",       load: () => import("./AppCanvas") },
];

/**
 * Three.js シーンを初期化し、destroyable なオブジェクトを返す。
 * 対応するコンテナが存在しないページでは null を返す。
 * 各 Canvas クラスは動的 import で必要なページでのみ読み込まれる。
 */
export default async function initThreeScene() {
  const match = CANVAS_MAP.find((entry) => document.getElementById(entry.id));
  if (!match) return null;

  const { default: CanvasClass } = await match.load();
  const app = new CanvasClass();

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
