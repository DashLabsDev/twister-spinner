// Twister Spinner — honest random spinner for the game Twister.
// Picks a limb + color, and occasionally "Air" or "Spinner's Choice".

(() => {
  "use strict";

  const COLORS = {
    red:    { label: "Red",    css: "var(--red)" },
    green:  { label: "Green",  css: "var(--green)" },
    blue:   { label: "Blue",   css: "var(--blue)" },
    yellow: { label: "Yellow", css: "var(--yellow)" },
  };

  // Four quadrants, matching the physical spinner's layout (clockwise from top).
  const QUADRANTS = ["Left Hand", "Left Foot", "Right Hand", "Right Foot"];

  // 6 spots per quadrant: four colors + two special spots (Air, Spinner's Choice).
  const QUAD_PATTERN = [
    ["red", "air", "yellow", "blue", "choice", "green"],
    ["blue", "green", "air", "red", "yellow", "choice"],
    ["yellow", "choice", "blue", "green", "air", "red"],
    ["green", "red", "choice", "yellow", "blue", "air"],
  ];

  const wheel = document.getElementById("wheel");
  const needle = document.getElementById("needle");
  const spinBtn = document.getElementById("spinBtn");
  const soundBtn = document.getElementById("soundBtn");
  const resultEl = document.getElementById("result");
  const resultLimb = document.getElementById("resultLimb");
  const resultColor = document.getElementById("resultColor");

  const CX = 200, CY = 200, R = 192, DOT_R = 17, LABEL_R = 96;
  const NS = "http://www.w3.org/2000/svg";
  const dots = [];
  let currentDeg = 0;
  let spinning = false;
  let soundOn = true;

  // Convert a clockwise-from-top angle (deg) to an SVG x/y at a given radius.
  function polar(angleDeg, radius) {
    const a = (angleDeg - 90) * Math.PI / 180;
    return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
  }

  function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  // Draw the wheel: 4 quadrant wedges, dividing lines, limb labels, and 24 spots.
  function buildWheel() {
    wheel.appendChild(el("circle", { cx: CX, cy: CY, r: R + 4, fill: "#fdfdfb" }));

    const wedgeTints = ["#f7f7ff", "#eef7f0", "#eef4fb", "#fbf7ec"];
    for (let q = 0; q < 4; q++) {
      const start = polar(q * 90, R);
      const end = polar((q + 1) * 90, R);
      const path = `M ${CX} ${CY} L ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y} Z`;
      wheel.appendChild(el("path", { d: path, fill: wedgeTints[q] }));
    }

    // Cross dividers.
    for (const a of [0, 90]) {
      const p1 = polar(a, R), p2 = polar(a + 180, R);
      wheel.appendChild(el("line", {
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        stroke: "#cdd0d8", "stroke-width": 2,
      }));
    }

    // Limb labels, centered in each quadrant.
    for (let q = 0; q < 4; q++) {
      const mid = q * 90 + 45;
      const p = polar(mid, LABEL_R);
      const t = el("text", {
        x: p.x, y: p.y, "text-anchor": "middle", "dominant-baseline": "middle",
        "font-size": 15, "font-weight": 800, fill: "#c62b22",
        transform: `rotate(${mid > 90 && mid < 270 ? mid + 180 : mid} ${p.x} ${p.y})`,
      });
      QUADRANTS[q].split(" ").forEach((word, i, arr) => {
        const ts = el("tspan", { x: p.x, dy: i === 0 ? -(arr.length - 1) * 8 : 16 });
        ts.textContent = word.toUpperCase();
        t.appendChild(ts);
      });
      wheel.appendChild(t);
    }

    // 24 spots around the rim.
    for (let i = 0; i < 24; i++) {
      const angle = 7.5 + i * 15;              // centered within 15° slots
      const q = Math.floor(angle / 90);
      const type = QUAD_PATTERN[q][i % 6];
      const p = polar(angle, R - DOT_R - 6);
      const isColor = !!COLORS[type];
      const fill = isColor ? COLORS[type].css : "var(--purple)";

      wheel.appendChild(el("circle", {
        cx: p.x, cy: p.y, r: DOT_R, fill,
        stroke: "#ffffff", "stroke-width": 3,
      }));

      if (!isColor) {
        const icon = el("text", {
          x: p.x, y: p.y + 1, "text-anchor": "middle", "dominant-baseline": "central",
          "font-size": 16, fill: "#fff", "font-weight": 800,
        });
        icon.textContent = type === "air" ? "☁" : "★";
        wheel.appendChild(icon);
      }

      dots.push({ angleDeg: angle, limb: QUADRANTS[q], type });
    }

    wheel.appendChild(el("circle", { cx: CX, cy: CY, r: 10, fill: "#2a2a2a" }));
  }

  // ---- Sound (WebAudio) ----
  let audioCtx = null;
  function ac() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }
  function tone(freq, when, dur, type, gain) {
    const ctx = ac();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain || 0.12, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }
  function playSpinTicks(duration) {
    const ctx = ac();
    if (!ctx || !soundOn) return;
    let t = 0, gap = 0.05;
    const start = ctx.currentTime;
    while (t < duration) {
      tone(880, start + t, 0.03, "square", 0.05);
      gap *= 1.12;                 // ticks slow down as it winds down
      t += gap;
    }
  }
  function playDing() {
    const ctx = ac();
    if (!ctx || !soundOn) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) =>
      tone(f, now + i * 0.09, 0.5, "triangle", 0.14));
  }

  // ---- Result display ----
  function showResult(dot) {
    resultEl.classList.remove("pop");
    void resultEl.offsetWidth;
    resultEl.classList.add("pop");

    if (COLORS[dot.type]) {
      resultLimb.textContent = dot.limb;
      resultColor.textContent = COLORS[dot.type].label;
      resultColor.style.color = COLORS[dot.type].css;
    } else if (dot.type === "air") {
      resultLimb.textContent = dot.limb;
      resultColor.textContent = "AIR — raise it up!";
      resultColor.style.color = "var(--purple)";
    } else {
      resultLimb.textContent = "Spinner's Choice";
      resultColor.textContent = "you pick the move!";
      resultColor.style.color = "var(--purple)";
    }
    if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
  }

  // ---- Spin ----
  function spin() {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;

    const idx = Math.floor(Math.random() * dots.length);
    const dot = dots[idx];

    const base = ((currentDeg % 360) + 360) % 360;
    const jitter = Math.random() * 6 - 3;                // stay within the slot
    const forward = ((dot.angleDeg + jitter - base) % 360 + 360) % 360;
    const total = 360 * (5 + Math.floor(Math.random() * 3)) + forward;
    currentDeg += total;

    const duration = 4;
    needle.style.transition = `transform ${duration}s cubic-bezier(0.17,0.67,0.12,0.99)`;
    needle.style.transform = `rotate(${currentDeg}deg)`;

    if (soundOn && ac() && ac().state === "suspended") ac().resume();
    playSpinTicks(duration - 0.3);

    const done = () => {
      needle.removeEventListener("transitionend", done);
      spinning = false;
      spinBtn.disabled = false;
      showResult(dot);
      playDing();
    };
    needle.addEventListener("transitionend", done, { once: true });
  }

  spinBtn.addEventListener("click", spin);
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.setAttribute("aria-pressed", String(soundOn));
    soundBtn.textContent = soundOn ? "🔊" : "🔇";
    if (soundOn) ac() && ac().resume && ac().resume();
  });

  buildWheel();

  // Register the offline service worker.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
