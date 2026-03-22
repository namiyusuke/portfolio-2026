export const PHYSICS = {
  // 固定タイムステップ (ミリ秒 → 秒変換用)
  fixedDtMs: 8,
  maxFrameDtMs: 100,
  maxCatchupSteps: 6,

  // 初期配置
  initialCenterDistance: 2.2,
  initialDepthOffset: 0.15,

  // GLBモデルURL
  glbUrls: ["/models/Duck.glb", "/models/Avocado.glb"],
  modelSwitchInterval: 5000, // ミリ秒

  // 物理パラメータ
  springK: 0.0005,
  damping: 0.99,
  restitution: 0.1,
  maxSpeed: 0.13,
  separationStrength: 0.25,
  minSeparation: 0.1,
  iterations: 14,
  mouseRadius: 1.0,
  mouseStrength: 0.185,

  // ソフトボディ
  stretchAmount: 1.6,
  springStiffness: 1.22,
  springDamping: 0.15,
  breathingAmplitude: 0.035,
  breathingSpeed: 1.35,
};
