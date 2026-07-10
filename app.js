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

  // Four quadrants, clockwise from the top-right. Matches the physical
  // spinner's sequence (Right Hand -> Right Foot -> Left Hand -> Left Foot),
  // rotated so Right Hand sits in the top-right.
  //   q0 = top-right, q1 = bottom-right, q2 = bottom-left, q3 = top-left
  const QUADRANTS = [
    { label: "Right Hand", part: "hand", side: "right" },
    { label: "Right Foot", part: "foot", side: "right" },
    { label: "Left Hand",  part: "hand", side: "left"  },
    { label: "Left Foot",  part: "foot", side: "left"  },
  ];

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

  const CX = 200, CY = 200, R = 192, DOT_R = 17;
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

  // White icon for a special spot, centered on the dot at p.
  //  - "air":    a puffy cloud (overlapping white circles)
  //  - "choice": a spinner pointer (white kite + hub), like the real spinner
  function specialIcon(type, p, dotFill) {
    const g = el("g", { fill: "#fff" });
    if (type === "air") {
      g.appendChild(el("ellipse", { cx: p.x, cy: p.y + 3, rx: 11, ry: 6 }));
      g.appendChild(el("circle", { cx: p.x - 6, cy: p.y + 1, r: 5 }));
      g.appendChild(el("circle", { cx: p.x, cy: p.y - 4, r: 7 }));
      g.appendChild(el("circle", { cx: p.x + 6, cy: p.y + 1, r: 5 }));
    } else {
      g.appendChild(el("path", {
        d: `M ${p.x} ${p.y - 11} L ${p.x + 4.5} ${p.y + 4} L ${p.x} ${p.y + 8} L ${p.x - 4.5} ${p.y + 4} Z`,
      }));
      g.appendChild(el("circle", { cx: p.x, cy: p.y + 4.5, r: 2.8, fill: dotFill }));
    }
    return g;
  }

  // Red open-hand silhouette, fingers pointing up (-y). Inherits fill.
  function handShape() {
    const g = el("g", {});
    const cap = (x, y, w, h) => el("rect", { x, y, width: w, height: h, rx: w / 2, ry: w / 2 });
    g.appendChild(el("rect", { x: -13, y: -6, width: 26, height: 22, rx: 10, ry: 10 })); // palm
    g.appendChild(cap(-12.5, -27, 6.5, 25)); // index
    g.appendChild(cap(-5, -33, 6.5, 31));     // middle (longest)
    g.appendChild(cap(2.5, -30, 6.5, 28));    // ring
    g.appendChild(cap(10, -22, 6, 20));       // pinky
    const thumb = cap(-3, -10, 6.5, 20);      // thumb, angled off lower-left
    thumb.setAttribute("transform", "translate(-13 12) rotate(38)");
    g.appendChild(thumb);
    return g;
  }

  // Red footprint silhouette, toes pointing up (-y). Inherits fill.
  function footShape() {
    const g = el("g", {});
    g.appendChild(el("path", {
      d: "M 0 -15 C 12 -15 12 0 9 9 C 7 17 5 23 0 23 C -5 23 -7 17 -9 9 C -12 0 -12 -15 0 -15 Z",
    }));
    [[-9, -19, 3.4], [-3.8, -23, 3.9], [1.2, -23, 3.7], [5.8, -21, 3.1], [9.2, -18, 2.6]]
      .forEach(([x, y, r]) => g.appendChild(el("circle", { cx: x, cy: y, r })));
    return g;
  }

  // Red hand/foot silhouette for a quadrant, rotated so it points outward.
  function limbIcon(meta, mid) {
    const c = polar(mid, 86);
    const mirror = meta.side === "left" ? -1 : 1;
    const g = el("g", {
      fill: "var(--red)",
      transform: `translate(${c.x} ${c.y}) rotate(${mid}) scale(${0.92 * mirror} 0.92)`,
    });
    g.appendChild(meta.part === "hand" ? handShape() : footShape());
    return g;
  }

  // Curved quadrant label following the rim arc, centered on the mid angle.
  function curvedLabel(text, mid) {
    const LR = 150, SPAN = 40;
    const s = polar(mid - SPAN, LR), e = polar(mid + SPAN, LR);
    const id = "arc" + Math.round(mid);
    wheel.appendChild(el("path", {
      id, fill: "none", d: `M ${s.x} ${s.y} A ${LR} ${LR} 0 0 1 ${e.x} ${e.y}`,
    }));
    const t = el("text", {
      "font-size": 17, "font-weight": 800, "letter-spacing": 1.5, fill: "var(--red)",
    });
    const tp = el("textPath", {
      href: "#" + id, "xlink:href": "#" + id, startOffset: "50%", "text-anchor": "middle",
    });
    tp.setAttribute("dominant-baseline", "middle");
    tp.textContent = text.toUpperCase();
    t.appendChild(tp);
    wheel.appendChild(t);
  }

  // Small red "Twister" wordmark near the center (one upright, one flipped).
  function wordmark(cy, flip) {
    const t = el("text", {
      x: CX, y: cy, "text-anchor": "middle", "dominant-baseline": "middle",
      "font-size": 16, "font-weight": 800, "font-style": "italic", fill: "var(--red)",
    });
    if (flip) t.setAttribute("transform", `rotate(180 ${CX} ${cy})`);
    t.textContent = "Twister";
    return t;
  }

  // Draw the wheel to resemble the real Twister spinner.
  function buildWheel() {
    // Base disk: white rim + light-gray face with faint concentric rings.
    wheel.appendChild(el("circle", { cx: CX, cy: CY, r: R + 4, fill: "#ffffff" }));
    wheel.appendChild(el("circle", { cx: CX, cy: CY, r: R, fill: "#ececeb" }));
    for (const rr of [38, 72, 106, 140, 174]) {
      wheel.appendChild(el("circle", {
        cx: CX, cy: CY, r: rr, fill: "none", stroke: "#e2e2df", "stroke-width": 7,
      }));
    }

    // Thin cross dividers.
    for (const a of [0, 90]) {
      const p1 = polar(a, R), p2 = polar(a + 180, R);
      wheel.appendChild(el("line", {
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: "#b7b7b3", "stroke-width": 1.5,
      }));
    }

    // Per-quadrant curved label + limb silhouette.
    for (let q = 0; q < 4; q++) {
      const mid = q * 90 + 45;
      curvedLabel(QUADRANTS[q].label, mid);
      wheel.appendChild(limbIcon(QUADRANTS[q], mid));
    }

    // Center "Twister" wordmarks.
    wheel.appendChild(wordmark(CY - 46, false));
    wheel.appendChild(wordmark(CY + 46, true));

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
        wheel.appendChild(specialIcon(type, p, fill));
      }

      dots.push({ angleDeg: angle, limb: QUADRANTS[q].label, type });
    }

    wheel.appendChild(el("circle", { cx: CX, cy: CY, r: 9, fill: "#ffffff", stroke: "#b7b7b3", "stroke-width": 2 }));
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
