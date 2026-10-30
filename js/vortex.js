/* Particle vortex in the background. Spins slowly on its own, faster while you scroll.
   Kept light: drawn at CSS-pixel resolution, ~30 fps when idle, fewer particles on
   phones, and the core glow is a small pre-drawn sprite. */
(function () {
  const canvas = document.getElementById("vortex");
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = matchMedia("(max-width: 720px)");
  const BINS = 16;

  let cfg = {};
  let W = 0, H = 0;
  let n = 0, rn, ang, size, speed;
  let bins = [];          // particle indices grouped by colour
  let palette = [];
  let rot = 0, boost = 0;
  let lastY = window.scrollY, lastT = performance.now();

  const rand = Math.random;
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;

  function spawn(i, edge) {
    rn[i] = edge ? 0.85 + rand() * 0.15 : Math.pow(rand(), 0.7);
    const arm = Math.floor(rand() * cfg.arms);
    ang[i] = (arm / cfg.arms) * Math.PI * 2 + gauss() * (0.55 / Math.sqrt(cfg.arms));
  }

  function init() {
    n = Math.round(cfg.particleCount * (phone.matches ? 0.5 : 1));
    rn = new Float32Array(n);
    ang = new Float32Array(n);
    size = new Float32Array(n);
    speed = new Float32Array(n);
    bins = Array.from({ length: BINS }, () => []);
    for (let i = 0; i < n; i++) {
      spawn(i, false);
      size[i] = 0.4 + rand() * rand() * 2.2;
      speed[i] = 0.5 + rand();
      bins[Math.floor(rand() * BINS)].push(i);
    }
  }

  const hex = (h) => {
    const m = String(h || "#000").replace("#", "");
    const f = m.length === 3 ? m.split("").map((c) => c + c).join("") : m.padEnd(6, "0");
    return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0);
  };
  const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
  let cOuter, cCore, cBg, blend = "lighter", glow = null;

  function buildPalette() {
    cOuter = hex(cfg.particleOuter);
    cCore = hex(cfg.particleCore);
    cBg = hex(cfg.colorBg);
    // light backgrounds: additive light would wash particles out to white, so darken-blend instead
    const lum = (0.2126 * cBg[0] + 0.7152 * cBg[1] + 0.0722 * cBg[2]) / 255;
    blend = lum > 0.5 ? "multiply" : "lighter";
    palette = [];
    for (let b = 0; b < BINS; b++) {
      const t = b / (BINS - 1);
      palette.push(rgba(cOuter.map((v, i) => Math.round(v + (cCore[i] - v) * t)), 1));
    }
    // the core glow, drawn once
    glow = glow || document.createElement("canvas");
    glow.width = glow.height = 256;
    const g = glow.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, rgba(cCore, 1));
    grad.addColorStop(0.35, rgba(cOuter.map((v, i) => (v + cCore[i]) >> 1), 0.45));
    grad.addColorStop(1, rgba(cOuter, 0));
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }

  const bg = (alpha) => rgba(cBg, alpha);

  function resize() {
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
    ctx.fillStyle = bg(1);
    ctx.fillRect(0, 0, W, H);
  }

  let odd = false;
  function frame(t) {
    requestAnimationFrame(frame);
    // idle: draw every other frame — the slow spin looks the same at 30 fps
    odd = !odd;
    if (odd && Math.abs(boost) < 0.02) return;
    const dt = Math.min((t - lastT) / 1000, 0.07);
    lastT = t;

    const y = window.scrollY;
    boost += ((y - lastY) / Math.max(innerHeight, 1)) * 14;
    lastY = y;
    boost *= Math.pow(0.04, dt);

    const motion = reduced ? 0.2 : 1;
    rot += dt * motion * (cfg.spinSpeed + boost * cfg.scrollSpin);

    // fade the previous frame → short trails
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = bg(1 - cfg.trail);
    ctx.fillRect(0, 0, W, H);
    if (cfg.particlesOff) return;

    const cx = cfg.centerX * W, cy = cfg.centerY * H;
    const R = Math.hypot(W, H) * 0.5 * cfg.radius;
    ctx.globalCompositeOperation = blend;

    if (cfg.glow > 0) {
      const gr = R * 0.55;
      ctx.globalAlpha = Math.min(1, cfg.glow * (1 - cfg.trail) * 0.9);
      ctx.drawImage(glow, cx - gr, cy - gr, gr * 2, gr * 2);
      ctx.globalAlpha = 1;
    }

    const inflow = dt * motion * cfg.inflow * 0.06 * (1 + Math.abs(boost) * 3);
    const twist = cfg.twist * Math.PI * 0.5;
    const ps = cfg.particleSize;
    for (let b = 0; b < BINS; b++) {
      ctx.fillStyle = palette[b];
      const list = bins[b];
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        let r = rn[i] - inflow * speed[i] * (0.25 + rn[i]);
        if (r < 0.015) { spawn(i, true); r = rn[i]; }
        rn[i] = r;
        const th = ang[i] + r * twist + rot;
        const s = size[i] * ps * (0.45 + r);
        ctx.fillRect(cx + Math.cos(th) * r * R, cy + Math.sin(th) * r * R, s, s);
      }
    }
  }

  window.addEventListener("resize", resize);

  window.Vortex = {
    configure(next) {
      const needInit = !n || next.particleCount !== cfg.particleCount || next.arms !== cfg.arms;
      cfg = Object.assign({}, next);
      cfg.arms = Math.max(1, Math.round(cfg.arms));
      buildPalette();
      if (needInit) init();
    },
    start() {
      resize();
      requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(frame); });
    }
  };
})();
