/* ============================================================
   Delhi Society of Hematology (DSH) — Multi-Window Portal
   Custom WebGL Blood Stream · DNA Helix · Single-Window Suite
   ============================================================ */

(function () {
  "use strict";

  const qs = (s, el) => (el || document).querySelector(s);
  const qsa = (s, el) => Array.from((el || document).querySelectorAll(s));

  /* ---------------- Safe Escaping & Formatting ---------------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const fmtN = (n) => "DSH/LM/" + String(n).padStart(3, "0");
  const validEmail = (em) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(em || "").trim());

  function getInitials(name) {
    const clean = String(name || "").replace(/^(Lt\. Col\. \(Dr\)|Col\. \(Dr\)|Dr\. \(Mrs\.\)|Dr\.|Prof\.|Mr\.|Ms\.)\s*/i, "").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (!parts.length) return "DR";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const telHref = (m) => {
    const raw = (m.mob || m.ph || "").split(/[\s,/]+/)[0];
    let d = raw.replace(/[^\d+]/g, "");
    if (!d) return "";
    if (d.startsWith("+")) return d;
    d = d.replace(/^0+/, "");
    return "+91" + d;
  };

  /* ---------------- Theme Engine ---------------- */
  function currentTheme() {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }

  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    const m = qs("#metaTheme");
    if (m) m.content = t === "light" ? "#f9f7f2" : "#0b0d11";
    const btn = qs("#themeToggle");
    if (btn) {
      btn.setAttribute("aria-label", t === "light" ? "Switch to dark theme" : "Switch to light theme");
      btn.setAttribute("title", t === "light" ? "Dark mode" : "Light mode");
    }
  }

  function initTheme() {
    applyTheme(currentTheme());
    const btn = qs("#themeToggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const next = currentTheme() === "light" ? "dark" : "light";
        applyTheme(next);
        try { localStorage.setItem("dsh-theme", next); } catch (e) { /* private mode */ }
      });
    }
  }

  /* ---------------- Matrix Math Helper for 3D Shaders ---------------- */
  const m4 = {
    persp(out, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
      out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
      out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
      out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
      return out;
    },
    lookAt(out, eye, c, up) {
      let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
      z0 = eye[0] - c[0]; z1 = eye[1] - c[1]; z2 = eye[2] - c[2];
      len = 1 / Math.hypot(z0, z1, z2); z0 *= len; z1 *= len; z2 *= len;
      x0 = up[1] * z2 - up[2] * z1; x1 = up[2] * z0 - up[0] * z2; x2 = up[0] * z1 - up[1] * z0;
      len = Math.hypot(x0, x1, x2);
      if (!len) { x0 = 0; x1 = 0; x2 = 0; } else { len = 1 / len; x0 *= len; x1 *= len; x2 *= len; }
      y0 = z1 * x2 - z2 * x1; y1 = z2 * x0 - z0 * x2; y2 = z0 * x1 - z1 * x0;
      out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
      out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
      out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
      out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
      out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
      out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
      out[15] = 1;
      return out;
    },
    mul(out, a, b) {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          out[i * 4 + j] =
            a[0 * 4 + j] * b[i * 4 + 0] +
            a[1 * 4 + j] * b[i * 4 + 1] +
            a[2 * 4 + j] * b[i * 4 + 2] +
            a[3 * 4 + j] * b[i * 4 + 3];
        }
      }
      return out;
    }
  };

  /* ---------------- WebGL 3D Blood Stream Hero ---------------- */
  let resizeHeroGL = null;
  let resumeHeroGL = null;
  function heroFallback() {
    const hero = qs("header.hero");
    if (!hero || qs(".hero-fallback", hero)) return;
    const layer = document.createElement("div");
    layer.className = "hero-fallback";
    for (let i = 0; i < 20; i++) {
      const c = document.createElement("span");
      c.className = "hb-cell";
      const s = (10 + Math.random() * 26).toFixed(0);
      c.style.left = (Math.random() * 92).toFixed(1) + "%";
      c.style.top = (Math.random() * 88).toFixed(1) + "%";
      c.style.width = c.style.height = s + "px";
      c.style.animationDuration = (16 + Math.random() * 20).toFixed(1) + "s";
      c.style.animationDelay = (-Math.random() * 24).toFixed(1) + "s";
      layer.appendChild(c);
    }
    hero.prepend(layer);
  }

  function initHeroGL() {
    const canvas = qs("#gl-hero");
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false, depth: false });
    if (!gl) { canvas.remove(); heroFallback(); return; }

    const VS = `
      attribute vec3 aPos;
      attribute float aSize;
      attribute vec4 aColor;
      attribute float aRot;
      attribute float aType;
      uniform mat4 uMVP;
      uniform float uK;
      varying vec4 vColor;
      varying float vRot;
      varying float vType;
      void main(){
        gl_Position = uMVP * vec4(aPos, 1.0);
        gl_PointSize = min(uK * aSize * 2.0 / gl_Position.w, 340.0);
        vColor = aColor;
        vRot = aRot;
        vType = aType;
      }`;

    const FS = `
      precision mediump float;
      varying vec4 vColor;
      varying float vRot;
      varying float vType;
      uniform float uTime;
      uniform float uTheme;
      float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float r = length(uv);
        float ca = cos(vRot), sa = sin(vRot);
        vec2 q = vec2(ca*uv.x - sa*uv.y, sa*uv.x + ca*uv.y);
        vec3 col = vColor.rgb;
        float alpha = 0.0;

        if (vType < 0.5) { /* RBC */
          float mask = 1.0 - smoothstep(0.44, 0.5, r);
          if (mask < 0.02) discard;
          float rim = smoothstep(0.28, 0.47, r) * (1.0 - smoothstep(0.47, 0.5, r));
          float dimple = exp(-dot(q,q) * 52.0) * (0.55 + 0.28 * cos(vRot * 2.0));
          float lum = 0.60 + rim * 0.62 - dimple * 0.42;
          col = vColor.rgb * lum;
          alpha = mask;
        } else if (vType < 1.5) { /* WBC */
          float ang = atan(q.y, q.x);
          float bumps = 0.05 * sin(6.0*ang + vRot*7.0 + uTime*1.6)
                      + 0.035 * cos(9.0*ang - vRot*5.0 + uTime*1.1);
          float rr = r - bumps;
          float mask = 1.0 - smoothstep(0.40, 0.5, rr);
          if (mask < 0.02) discard;
          float nuc = smoothstep(0.34, 0.10, length(q - vec2(0.06, 0.02)));
          col = mix(vColor.rgb, vec3(0.16, 0.17, 0.22), nuc * 0.85);
          float lum = 0.62 + 0.30 * smoothstep(0.45, 0.0, r);
          col *= lum;
          alpha = mask * 0.9;
          col = mix(col, clamp(col * 0.85 + 0.07, 0.0, 1.0), uTheme);
          alpha = mix(alpha, alpha * 0.84, uTheme);
        } else if (vType < 2.5) { /* Platelet */
          float e = length(vec2(q.x * 1.6, q.y * 0.62));
          float mask = 1.0 - smoothstep(0.36, 0.5, e);
          if (mask < 0.02) discard;
          float spec = 0.72 + 0.55 * rand(floor(q * 14.0));
          col = vColor.rgb * spec * 0.8;
          alpha = mask * 0.75;
        } else { /* Plasma */
          float mask = 1.0 - smoothstep(0.30, 0.5, r);
          if (mask < 0.02) discard;
          col = vColor.rgb * (0.75 + 0.25 * sin(uTime * 1.2 + vRot * 6.0));
          alpha = mask * vColor.a;
        }

        if (vType < 0.5) {
          col = mix(col, clamp(col * 1.55 + 0.02, 0.0, 1.0), uTheme);
          alpha = mix(alpha, alpha * 0.94, uTheme);
        } else if (vType < 2.5) {
          col = mix(col, clamp(col * 1.15, 0.0, 1.0), uTheme);
        } else {
          col = mix(col, clamp(col * 1.7 + 0.15, 0.0, 1.0), uTheme);
          alpha = mix(alpha, alpha * 0.45, uTheme);
        }
        gl_FragColor = vec4(col, alpha);
      }`;

    function sh(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
      return s;
    }

    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { canvas.remove(); heroFallback(); return; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); heroFallback(); return; }
    gl.useProgram(prog);

    const loc = {
      aPos: gl.getAttribLocation(prog, "aPos"),
      aSize: gl.getAttribLocation(prog, "aSize"),
      aColor: gl.getAttribLocation(prog, "aColor"),
      aRot: gl.getAttribLocation(prog, "aRot"),
      aType: gl.getAttribLocation(prog, "aType"),
      uMVP: gl.getUniformLocation(prog, "uMVP"),
      uK: gl.getUniformLocation(prog, "uK"),
      uTime: gl.getUniformLocation(prog, "uTime"),
      uTheme: gl.getUniformLocation(prog, "uTheme")
    };
    const STRIDE = 10 * 4;

    const rnd = (a, b) => a + Math.random() * (b - a);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const smallScr = Math.min(innerWidth, innerHeight) < 720;
    let K = smallScr ? 0.6 : 1;
    if (reduced) K *= 0.5;
    const N_RBC = Math.round(170 * K), N_WBC = Math.round(12 * K),
          N_PLT = Math.round(44 * K), N_DUST = Math.round(90 * K);
    const N = N_RBC + N_WBC + N_PLT + N_DUST;
    const data = new Float32Array(N * 10);
    const P = [];
    let i = 0;

    function add(type, size, colA, colB, alpha) {
      data[i * 10 + 0] = rnd(-8, 8);
      data[i * 10 + 1] = rnd(-5.2, 5.2);
      data[i * 10 + 2] = rnd(-8, 8);
      data[i * 10 + 3] = size;
      const t = Math.random();
      data[i * 10 + 4] = colA[0] + (colB[0] - colA[0]) * t;
      data[i * 10 + 5] = colA[1] + (colB[1] - colA[1]) * t;
      data[i * 10 + 6] = colA[2] + (colB[2] - colA[2]) * t;
      data[i * 10 + 7] = alpha * rnd(0.75, 1);
      data[i * 10 + 8] = rnd(0, Math.PI * 2);
      data[i * 10 + 9] = type;
      P.push({ i: i++, vx: 0, vy: 0, vz: 0, spin: rnd(-0.4, 0.4) });
    }

    for (let k = 0; k < N_RBC; k++) add(0, rnd(0.14, 0.26), [0.36, 0.055, 0.10], [0.62, 0.13, 0.19], 0.80);
    for (let k = 0; k < N_WBC; k++) add(1, rnd(0.34, 0.46), [0.28, 0.29, 0.33], [0.50, 0.52, 0.58], 0.42);
    for (let k = 0; k < N_PLT; k++) add(2, rnd(0.09, 0.15), [0.42, 0.32, 0.42], [0.62, 0.50, 0.58], 0.5);
    for (let k = 0; k < N_DUST; k++) add(3, rnd(0.02, 0.05), [0.75, 0.28, 0.33], [0.85, 0.45, 0.48], 0.16);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);

    const setAttr = (name, size, off) => {
      if (loc[name] < 0) return;
      gl.enableVertexAttribArray(loc[name]);
      gl.vertexAttribPointer(loc[name], size, gl.FLOAT, false, STRIDE, off);
    };
    setAttr("aPos", 3, 0); setAttr("aSize", 1, 12);
    setAttr("aColor", 4, 16); setAttr("aRot", 1, 32); setAttr("aType", 1, 36);

    const scr = new Float32Array(N * 10);
    const order = Array.from({ length: N }, (_, k) => k);

    let W = 0, H = 0, dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, smallScr ? 1.75 : 2);
      W = canvas.clientWidth || innerWidth;
      H = canvas.clientHeight || innerHeight;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resizeHeroGL = resize;
    resize();
    window.addEventListener("resize", resize, { passive: true });

    let mx = 0, my = 0, tmx = 0, tmy = 0;
    window.addEventListener("pointermove", (e) => {
      tmx = (e.clientX / innerWidth - 0.5) * 2;
      tmy = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let pM = new Float32Array(16), vM = new Float32Array(16), mvp = new Float32Array(16);
    let themeVal = currentTheme() === "light" ? 1 : 0;
    let t0 = performance.now();

    function frame(now) {
      const dt = Math.min(0.05, (now - t0) * 0.001);
      t0 = now;
      const targetTheme = currentTheme() === "light" ? 1 : 0;
      themeVal += (targetTheme - themeVal) * Math.min(1, dt * 6);

      mx += (tmx - mx) * 0.05;
      my += (tmy - my) * 0.05;

      const spd = reduced ? 0.08 : 0.32;
      for (let k = 0; k < N; k++) {
        const off = k * 10;
        let x = data[off + 0], y = data[off + 1], z = data[off + 2];
        z += (0.6 + data[off + 3] * 0.8) * spd * dt;
        if (z > 6) { z = -8; x = rnd(-8, 8); y = rnd(-5, 5); }
        x += Math.sin(now * 0.0006 + k) * 0.12 * dt;
        y += Math.cos(now * 0.0005 + k * 1.3) * 0.10 * dt;
        data[off + 0] = x; data[off + 1] = y; data[off + 2] = z;
        data[off + 8] += P[k].spin * dt;
      }

      const eyeZ = 5.2;
      order.sort((a, b) => data[a * 10 + 2] - data[b * 10 + 2]);
      for (let k = 0; k < N; k++) {
        const sOff = order[k] * 10, dOff = k * 10;
        for (let j = 0; j < 10; j++) scr[dOff + j] = data[sOff + j];
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, scr);

      m4.persp(pM, Math.PI / 3.4, W / Math.max(1, H), 0.1, 30.0);
      m4.lookAt(vM, [mx * 0.45, -my * 0.35 + 0.1, eyeZ], [0, 0, 0], [0, 1, 0]);
      m4.mul(mvp, pM, vM);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix4fv(loc.uMVP, false, mvp);
      gl.uniform1f(loc.uK, H * dpr * 0.6);
      gl.uniform1f(loc.uTime, now * 0.001);
      gl.uniform1f(loc.uTheme, themeVal);

      gl.drawArrays(gl.POINTS, 0, N);
      if (activeWindow === "home") {
        animId = requestAnimationFrame(frame);
      } else {
        animId = null;
      }
    }

    resumeHeroGL = function() {
      if (!animId && activeWindow === "home") {
        t0 = performance.now();
        animId = requestAnimationFrame(frame);
      }
    };

    let animId = requestAnimationFrame(frame);
  }

  /* ---------------- DNA Helix Canvas Animation ---------------- */
  let resizeDNA = null;
  let resumeDNA = null;
  function initDNA() {
    const canvas = qs("#dna-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dnaAnimId = null;
    let w = 0, h = 0, dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth || 400;
      h = canvas.clientHeight || 500;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeDNA = resize;
    resize();
    window.addEventListener("resize", resize, { passive: true });

    let t = 0;
    const PAIRS = 36;

    function render() {
      t += 0.012;
      ctx.clearRect(0, 0, w, h);
      const cx = w * 0.5, cy = h * 0.5;
      const isLight = currentTheme() === "light";
      const rad = Math.min(w, h) * 0.28;

      for (let i = 0; i < PAIRS; i++) {
        const frac = i / PAIRS;
        const y = (frac - 0.5) * (h * 0.88);
        const theta = frac * Math.PI * 4.0 + t;
        const x1 = Math.cos(theta) * rad;
        const z1 = Math.sin(theta) * rad;
        const x2 = -x1;
        const z2 = -z1;

        const p1 = (z1 + rad) / (2 * rad);
        const p2 = (z2 + rad) / (2 * rad);

        ctx.beginPath();
        ctx.moveTo(cx + x1, cy + y);
        ctx.lineTo(cx + x2, cy + y);
        ctx.strokeStyle = isLight ? "rgba(139, 26, 48, 0.18)" : "rgba(165, 32, 58, 0.22)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx + x1, cy + y, 3 + p1 * 3, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? "rgba(139, 26, 48, " + (0.3 + p1 * 0.6) + ")" : "rgba(165, 32, 58, " + (0.4 + p1 * 0.6) + ")";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx + x2, cy + y, 3 + p2 * 3, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? "rgba(157, 120, 56, " + (0.3 + p2 * 0.6) + ")" : "rgba(200, 163, 101, " + (0.4 + p2 * 0.6) + ")";
        ctx.fill();
      }

      if (activeWindow === "about") {
        dnaAnimId = requestAnimationFrame(render);
      } else {
        dnaAnimId = null;
      }
    }

    resumeDNA = function() {
      if (!dnaAnimId && activeWindow === "about") {
        dnaAnimId = requestAnimationFrame(render);
      }
    };

    dnaAnimId = requestAnimationFrame(render);
  }

  /* ---------------- Multi-Section Routing & State Manager ---------------- */
  const WINDOWS = ["home", "about", "programme", "directory", "certificate", "join"];
  const WIN_TITLES = {
    home: "Overview & Highlights",
    about: "About the Society & Leadership",
    programme: "Academic Programme & CMEs",
    directory: "Certified Member Register (915)",
    certificate: "Life Member Certificate & ID",
    join: "Membership & Application"
  };

  let activeWindow = "home";

  function switchWindow(targetWinId, pushHash = true) {
    if (!WINDOWS.includes(targetWinId)) targetWinId = "home";
    activeWindow = targetWinId;

    // Switch active window container
    qsa(".sub-window").forEach(win => {
      const isMatch = win.dataset.win === targetWinId;
      win.classList.toggle("active", isMatch);
    });

    // Update nav tabs
    qsa(".win-tab-btn").forEach(btn => {
      const isMatch = btn.dataset.target === targetWinId;
      btn.classList.toggle("active", isMatch);
      btn.setAttribute("aria-selected", isMatch ? "true" : "false");
    });

    // Update mobile drawer links
    qsa(".drawer-link").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.target === targetWinId);
    });

    // Update section breadcrumb & counter pill
    const idx = WINDOWS.indexOf(targetWinId);
    const titleEl = qs("#windowCurrentTitle");
    const pillEl = qs("#winCounterPill");
    if (titleEl) titleEl.textContent = WIN_TITLES[targetWinId] || "DSH Portal";
    if (pillEl) pillEl.textContent = "Section " + (idx + 1) + " of " + WINDOWS.length;

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Update URL hash
    if (pushHash) {
      try {
        history.pushState(null, "", "#" + targetWinId);
      } catch (e) {}
    }

    // Trigger canvas resize and animation resume when switching to home or about
    if (targetWinId === "home") {
      if (resumeHeroGL) resumeHeroGL();
      if (resizeHeroGL) setTimeout(resizeHeroGL, 50);
    }
    if (targetWinId === "about") {
      if (resumeDNA) resumeDNA();
      if (resizeDNA) setTimeout(resizeDNA, 50);
    }
  }

  function nextWindow() {
    const idx = WINDOWS.indexOf(activeWindow);
    const nextIdx = (idx + 1) % WINDOWS.length;
    switchWindow(WINDOWS[nextIdx]);
  }

  function prevWindow() {
    const idx = WINDOWS.indexOf(activeWindow);
    const prevIdx = (idx - 1 + WINDOWS.length) % WINDOWS.length;
    switchWindow(WINDOWS[prevIdx]);
  }

  /* ---------------- UI Interactions & Motion ---------------- */
  function initUI() {
    // Section navigation step buttons
    const prevStepBtn = qs("#prevWinStepBtn");
    const nextStepBtn = qs("#nextWinStepBtn");
    if (prevStepBtn) prevStepBtn.addEventListener("click", prevWindow);
    if (nextStepBtn) nextStepBtn.addEventListener("click", nextWindow);

    // Global target listener for buttons and links with data-target
    document.addEventListener("click", (e) => {
      const targetBtn = e.target.closest("[data-target]");
      if (targetBtn && !targetBtn.classList.contains("prog-tab-btn")) {
        const dest = targetBtn.dataset.target;
        if (WINDOWS.includes(dest)) {
          e.preventDefault();
          switchWindow(dest);
          closeDrawer();
        }
      }
    });

    // Hash and popstate change handler
    const syncFromUrl = () => {
      const h = location.hash.replace("#", "");
      if (WINDOWS.includes(h) && h !== activeWindow) {
        switchWindow(h, false);
      }
    };
    window.addEventListener("hashchange", syncFromUrl);
    window.addEventListener("popstate", syncFromUrl);

    // Keyboard arrow navigation
    window.addEventListener("keydown", (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (e.key === "ArrowRight") {
        nextWindow();
      } else if (e.key === "ArrowLeft") {
        prevWindow();
      }
    });

    // Scroll progress
    const prog = qs("#progress");
    window.addEventListener("scroll", () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const scrolled = window.scrollY;
      if (prog && max > 0) prog.style.width = Math.min(100, (scrolled / max) * 100) + "%";
    }, { passive: true });

    // Mobile Navigation Drawer
    const navToggle = qs("#navToggle");
    const mobileDrawer = qs("#mobileDrawer");
    const drawerClose = qs("#drawerClose");
    const drawerBackdrop = qs("#drawerBackdrop");

    function openDrawer() {
      if (mobileDrawer) {
        mobileDrawer.classList.add("open");
        mobileDrawer.setAttribute("aria-hidden", "false");
        navToggle.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
      }
    }

    function closeDrawer() {
      if (mobileDrawer) {
        mobileDrawer.classList.remove("open");
        mobileDrawer.setAttribute("aria-hidden", "true");
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      }
    }

    if (navToggle) navToggle.addEventListener("click", openDrawer);
    if (drawerClose) drawerClose.addEventListener("click", closeDrawer);
    if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeDrawer);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeDrawer();
        closeMemberModal();
      }
    });

    // Quick Search button (Nav) & Slash shortcut
    const quickBtn = qs("#quickSearchBtn");
    const searchInput = qs("#dir-search");
    if (quickBtn && searchInput) {
      quickBtn.addEventListener("click", () => {
        switchWindow("directory");
        setTimeout(() => searchInput.focus(), 350);
      });
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== searchInput && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        switchWindow("directory");
        setTimeout(() => {
          if (searchInput) searchInput.focus();
        }, 300);
      }
    });

    // Stat counters animation
    const stats = qsa(".stat b [data-count]");
    if ("IntersectionObserver" in window) {
      const sIo = new IntersectionObserver((entries) => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            const el = en.target;
            const target = parseInt(el.dataset.count, 10) || 0;
            const dur = 1400;
            const start = performance.now();
            function step(now) {
              const p = Math.min(1, (now - start) / dur);
              const val = Math.round(target * (1 - Math.pow(1 - p, 3)));
              el.textContent = val;
              if (p < 1) requestAnimationFrame(step);
              else el.textContent = target;
            }
            requestAnimationFrame(step);
            sIo.unobserve(el);
          }
        });
      }, { threshold: 0.5 });
      stats.forEach(s => sIo.observe(s));
    }

    // Programme Tabs (inside Window 3)
    const tabBtns = qsa(".prog-tab-btn");
    const tabContents = qsa(".prog-tab-content");
    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const tabKey = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove("active"));
        tabContents.forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        const target = qs("#tab-" + tabKey);
        if (target) target.classList.add("active");
      });
    });

    // Add to Calendar (.ics download)
    qsa(".add-cal-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const title = btn.dataset.title || "DSH Academic Event";
        const desc = btn.dataset.desc || "Delhi Society of Hematology Event";
        const loc = btn.dataset.loc || "New Delhi, India";
        downloadIcs(title, desc, loc);
      });
    });

    // Toast notification
    window.__toast = function (title, sub) {
      const t = qs("#toast");
      if (!t) return;
      t.querySelector("b").textContent = title;
      t.querySelector("small").textContent = sub;
      t.classList.add("show");
      clearTimeout(window.__toastT);
      window.__toastT = setTimeout(() => t.classList.remove("show"), 4800);
    };
  }

  /* ---------------- .ICS Calendar File Generator ---------------- */
  function downloadIcs(title, description, location) {
    const now = new Date();
    const dtStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const dtStart = "20260920T040000Z";
    const dtEnd = "20260920T120000Z";

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Delhi Society of Hematology//Academic Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + Date.now() + "@delhihaematology.com",
      "DTSTAMP:" + dtStamp,
      "DTSTART:" + dtStart,
      "DTEND:" + dtEnd,
      "SUMMARY:" + title,
      "DESCRIPTION:" + description,
      "LOCATION:" + location,
      "STATUS:CONFIRMED",
      "ORGANIZER;CN=Delhi Society of Hematology:mailto:drjyotikotwal@gmail.com",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (title.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "dsh_event") + ".ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    window.__toast("Calendar Event Added", "Downloaded .ics file for \"" + title + "\". Compatible with Google Calendar, Apple Calendar & Outlook.");
  }

  /* ---------------- Member Detail Quick-View Modal ---------------- */
  function openMemberModal(m) {
    const backdrop = qs("#memberModalBackdrop");
    if (!backdrop) return;

    qs("#modalAvatar").textContent = getInitials(m.name);
    qs("#modalRegId").textContent = fmtN(m.n);
    qs("#modalMemberName").textContent = m.name;
    qs("#modalInst").textContent = m.inst ? m.inst.toUpperCase() : "Delhi-NCR Academic Registry";
    qs("#modalAddr").textContent = m.addr || "Address not provided in public archive";
    qs("#modalPhone").textContent = m.ph || "—";
    qs("#modalMobile").textContent = m.mob || "—";

    const emEl = qs("#modalEmail");
    if (m.em) {
      emEl.innerHTML = "<a class='mail' href='mailto:" + esc(m.em) + "'>" + esc(m.em) + "</a>";
    } else {
      emEl.textContent = "—";
    }

    const copyBtn = qs("#modalCopyBtn");
    copyBtn.onclick = () => {
      const txt = [
        m.name + " (" + fmtN(m.n) + ")",
        m.inst ? "Institution: " + m.inst : "",
        m.addr ? "Address: " + m.addr : "",
        m.mob ? "Mobile: " + m.mob : "",
        m.ph ? "Phone: " + m.ph : "",
        m.em ? "Email: " + m.em : ""
      ].filter(Boolean).join("\n");

      navigator.clipboard.writeText(txt).then(() => {
        window.__toast("Contact Copied", "Member details copied to clipboard.");
      }).catch(() => {
        window.__toast("Contact Details", txt);
      });
    };

    const certBtn = qs("#modalCertBtn");
    certBtn.onclick = () => {
      closeMemberModal();
      selectMemberForCert(m.n);
      switchWindow("certificate");
    };

    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
  }

  function closeMemberModal() {
    const backdrop = qs("#memberModalBackdrop");
    if (backdrop) {
      backdrop.classList.remove("open");
      backdrop.setAttribute("aria-hidden", "true");
    }
  }

  /* ---------------- Member Directory Engine ---------------- */
  function initDirectory() {
    const tbody = qs("#dir-tbody");
    const cardsBody = qs("#dir-cards-body");
    const countEl = qs("#dir-count");
    const empty = qs("#dir-empty");
    const search = qs("#dir-search");
    const clearBtn = qs("#dir-clear");
    const instFilter = qs("#dir-inst-filter");
    const rankFilter = qs("#dir-rank-filter");
    const contactFilter = qs("#dir-filter");
    const sortSel = qs("#dir-sort");
    const perPageSel = qs("#dir-per-page");

    const prevBtn = qs("#dir-prev");
    const nextBtn = qs("#dir-next");
    const firstBtn = qs("#dir-first");
    const lastBtn = qs("#dir-last");
    const pageNote = qs("#dir-page-note");

    const viewTableBtn = qs("#viewTableBtn");
    const viewCardBtn = qs("#viewCardBtn");
    const tableContainer = qs("#dirTableContainer");
    const cardContainer = qs("#dirCardContainer");
    const exportCsvBtn = qs("#exportCsvBtn");
    const printDirBtn = qs("#printDirBtn");
    const emptyResetBtn = qs("#emptyResetBtn");

    if (!tbody || !MEMBERS) return;

    let savedView = "table";
    try {
      savedView = localStorage.getItem("dsh_dir_view") || "table";
    } catch (e) {}

    const state = {
      q: "",
      inst: "all",
      rank: "all",
      contact: "all",
      sort: "num",
      page: 0,
      per: 50,
      view: savedView === "card" ? "card" : "table"
    };

    function matchInstitution(m, key) {
      if (key === "all") return true;
      const hay = ((m.inst || "") + " " + (m.addr || "")).toLowerCase();
      switch (key) {
        case "AIIMS":
          return hay.includes("aiims") || hay.includes("all india institute");
        case "UCMS":
          return hay.includes("ucms") || hay.includes("gtb hospital") || hay.includes("guru teg");
        case "MAMC":
          return hay.includes("mamc") || hay.includes("maulana azad") || hay.includes("lok nayak");
        case "SGRH":
          return hay.includes("ganga ram") || hay.includes("sgrh") || hay.includes("gripmer");
        case "LHMC":
          return hay.includes("lhmc") || hay.includes("lady hardinge");
        case "AHRR":
          return hay.includes("army hospital") || hay.includes("r & r") || hay.includes("r&r") || hay.includes("base hospital") || hay.includes("aftc") || hay.includes("delhi cantt");
        case "SAFDARJUNG":
          return hay.includes("safdarjung") || hay.includes("vmmc");
        case "PRIVATE":
          return hay.includes("max") || hay.includes("apollo") || hay.includes("medanta") || hay.includes("fortis") || hay.includes("batra") || hay.includes("blkapoor");
        default:
          return hay.includes(key.toLowerCase());
      }
    }

    function matchRank(m, rankKey) {
      if (rankKey === "all") return true;
      const n = (m.name || "").toLowerCase();
      if (rankKey === "dr") return n.startsWith("dr.") || n.startsWith("dr ");
      if (rankKey === "mil") return n.includes("col.") || n.includes("lt. col") || n.includes("col (");
      if (rankKey === "mrs") return n.includes("(mrs") || n.includes("mrs.");
      return true;
    }

    function getFilteredList() {
      const q = state.q.trim().toLowerCase();
      let list = MEMBERS.filter(m => {
        if (!matchInstitution(m, state.inst)) return false;
        if (!matchRank(m, state.rank)) return false;
        if (state.contact === "email" && !validEmail(m.em)) return false;
        if (state.contact === "mobile" && !m.mob) return false;
        if (state.contact === "both" && (!validEmail(m.em) || !m.mob)) return false;
        if (state.contact === "addr" && !m.addr) return false;

        if (!q) return true;
        const hay = [fmtN(m.n), m.name, m.addr, m.ph, m.mob, m.em, m.inst].join(" ").toLowerCase();
        const terms = q.split(/\s+/);
        return terms.every(t => hay.includes(t));
      });

      const nameKey = (m) => m.sortName || m.name;
      list.sort((a, b) => {
        switch (state.sort) {
          case "name": return nameKey(a).localeCompare(nameKey(b));
          case "name-desc": return nameKey(b).localeCompare(nameKey(a));
          case "num-desc": return b.n - a.n;
          default: return a.n - b.n;
        }
      });

      return list;
    }

    function render() {
      const list = getFilteredList();
      const total = list.length;
      const pages = Math.max(1, Math.ceil(total / state.per));
      if (state.page >= pages) state.page = pages - 1;
      const slice = list.slice(state.page * state.per, state.page * state.per + state.per);

      if (countEl) countEl.textContent = total;

      if (!slice.length) {
        tbody.innerHTML = "";
        cardsBody.innerHTML = "";
        empty.style.display = "block";
        tableContainer.style.display = "none";
        cardContainer.style.display = "none";
      } else {
        empty.style.display = "none";

        if (state.view === "table") {
          tableContainer.style.display = "block";
          cardContainer.style.display = "none";
          renderTable(slice);
        } else {
          tableContainer.style.display = "none";
          cardContainer.style.display = "block";
          renderCards(slice);
        }
      }

      prevBtn.disabled = state.page === 0;
      firstBtn.disabled = state.page === 0;
      nextBtn.disabled = state.page >= pages - 1;
      lastBtn.disabled = state.page >= pages - 1;
      pageNote.textContent = "Page " + (state.page + 1) + " / " + pages;
    }

    function renderTable(slice) {
      tbody.innerHTML = slice.map((m) => {
        const name = esc(m.name);
        const note = m.note ? " <i title='" + esc(m.note) + "' style='color:var(--accent);font-style:normal'>✝</i>" : "";
        const idBadge = "<span class='m-id'>" + fmtN(m.n) + "</span>";

        let email = "<span class='dash'>—</span>";
        if (validEmail(m.em)) {
          email = "<a class='mail' href='mailto:" + esc(m.em) + "'>" + esc(m.em) + "</a>";
        } else if (m.em) {
          email = "<span class='m-addr'>" + esc(m.em) + "</span>";
        }

        const addr = m.addr ? esc(m.addr) : "<span class='dash'>—</span>";
        const phone = m.ph ? "<a class='tel' href='tel:" + telHref(m) + "'>" + esc(m.ph) + "</a>" : "<span class='dash'>—</span>";
        const mobile = m.mob ? "<a class='tel' href='tel:" + telHref(m) + "'>" + esc(m.mob) + "</a>" : "<span class='dash'>—</span>";
        const inst = m.inst ? "<span class='m-inst-tag'>" + esc(m.inst.toUpperCase()) + "</span>" : "<span class='dash'>—</span>";

        return "<tr data-num='" + m.n + "'>" +
          "<td>" + idBadge + "</td>" +
          "<td><span class='m-name'>" + name + "</span>" + note + "</td>" +
          "<td class='m-addr'>" + addr + "</td>" +
          "<td class='m-phone'>" + phone + "</td>" +
          "<td class='m-mob'>" + mobile + "</td>" +
          "<td>" + email + "</td>" +
          "<td>" + inst + "</td>" +
          "<td style='text-align:center'>" +
            "<div class='table-row-actions'>" +
              "<button class='action-icon-btn row-info-btn' title='View record' aria-label='View record for " + name + "' data-num='" + m.n + "'>" +
                "<svg viewBox='0 0 24 24' width='14' height='14' fill='none' stroke='currentColor' stroke-width='2'><circle cx='12' cy='12' r='10'/><line x1='12' y1='16' x2='12' y2='12'/><line x1='12' y1='8' x2='12.01' y2='8'/></svg>" +
              "</button>" +
              "<button class='action-icon-btn row-cert-btn' title='Generate certificate' aria-label='Certificate for " + name + "' data-num='" + m.n + "'>" +
                "<svg viewBox='0 0 24 24' width='14' height='14' fill='none' stroke='currentColor' stroke-width='2'><path d='M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z'/></svg>" +
              "</button>" +
            "</div>" +
          "</td>" +
          "</tr>";
      }).join("");

      qsa(".row-info-btn", tbody).forEach(btn => {
        btn.addEventListener("click", () => {
          const num = parseInt(btn.dataset.num, 10);
          const member = MEMBERS.find(x => x.n === num);
          if (member) openMemberModal(member);
        });
      });

      qsa(".row-cert-btn", tbody).forEach(btn => {
        btn.addEventListener("click", () => {
          const num = parseInt(btn.dataset.num, 10);
          selectMemberForCert(num);
          switchWindow("certificate");
        });
      });
    }

    function renderCards(slice) {
      cardsBody.innerHTML = slice.map((m) => {
        const name = esc(m.name);
        const initials = getInitials(m.name);
        const note = m.note ? " <i title='" + esc(m.note) + "' style='color:var(--accent);font-style:normal'>✝</i>" : "";
        const instTxt = m.inst ? esc(m.inst.toUpperCase()) : "DELHI-NCR SPECIALTY REGISTER";

        let contactRows = "";
        if (m.addr) {
          contactRows += "<div class='mc-row'>" +
            "<svg viewBox='0 0 24 24' width='13' height='13' fill='none' stroke='currentColor' stroke-width='2'><path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/><circle cx='12' cy='10' r='3'/></svg>" +
            "<span>" + esc(m.addr) + "</span>" +
            "</div>";
        }
        if (m.mob) {
          contactRows += "<div class='mc-row'>" +
            "<svg viewBox='0 0 24 24' width='13' height='13' fill='none' stroke='currentColor' stroke-width='2'><rect x='5' y='2' width='14' height='20' rx='2'/><line x1='12' y1='18' x2='12.01' y2='18'/></svg>" +
            "<a class='tel' href='tel:" + telHref(m) + "'>" + esc(m.mob) + "</a>" +
            "</div>";
        }
        if (m.em) {
          contactRows += "<div class='mc-row'>" +
            "<svg viewBox='0 0 24 24' width='13' height='13' fill='none' stroke='currentColor' stroke-width='2'><path d='M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z'/><polyline points='22,6 12,13 2,6'/></svg>" +
            (validEmail(m.em) ? "<a class='mail' href='mailto:" + esc(m.em) + "'>" + esc(m.em) + "</a>" : "<span>" + esc(m.em) + "</span>") +
            "</div>";
        }

        return "<article class='member-card'>" +
          "<div class='mc-header'>" +
            "<div class='mc-avatar'>" + initials + "</div>" +
            "<div class='mc-title'>" +
              "<div class='mc-reg'>" + fmtN(m.n) + " &bull; LIFE MEMBER</div>" +
              "<h4 class='mc-name'>" + name + note + "</h4>" +
              "<div class='mc-inst'>" + instTxt + "</div>" +
            "</div>" +
          "</div>" +
          "<div class='mc-body'>" +
            (contactRows || "<span class='dash'>No contact information recorded in public archives</span>") +
          "</div>" +
          "<div class='mc-actions'>" +
            "<button class='btn btn-sm btn-ghost card-info-btn' data-num='" + m.n + "'>View Details</button>" +
            "<button class='btn btn-sm btn-subtle card-cert-btn' data-num='" + m.n + "'>Certificate</button>" +
          "</div>" +
          "</article>";
      }).join("");

      qsa(".card-info-btn", cardsBody).forEach(btn => {
        btn.addEventListener("click", () => {
          const num = parseInt(btn.dataset.num, 10);
          const member = MEMBERS.find(x => x.n === num);
          if (member) openMemberModal(member);
        });
      });

      qsa(".card-cert-btn", cardsBody).forEach(btn => {
        btn.addEventListener("click", () => {
          const num = parseInt(btn.dataset.num, 10);
          selectMemberForCert(num);
          switchWindow("certificate");
        });
      });
    }

    viewTableBtn.addEventListener("click", () => {
      state.view = "table";
      try { localStorage.setItem("dsh_dir_view", "table"); } catch (e) {}
      viewTableBtn.classList.add("active");
      viewTableBtn.setAttribute("aria-pressed", "true");
      viewCardBtn.classList.remove("active");
      viewCardBtn.setAttribute("aria-pressed", "false");
      render();
    });

    viewCardBtn.addEventListener("click", () => {
      state.view = "card";
      try { localStorage.setItem("dsh_dir_view", "card"); } catch (e) {}
      viewCardBtn.classList.add("active");
      viewCardBtn.setAttribute("aria-pressed", "true");
      viewTableBtn.classList.remove("active");
      viewTableBtn.setAttribute("aria-pressed", "false");
      render();
    });

    // Sync initial button states if card view was saved
    if (state.view === "card") {
      viewCardBtn.classList.add("active");
      viewCardBtn.setAttribute("aria-pressed", "true");
      viewTableBtn.classList.remove("active");
      viewTableBtn.setAttribute("aria-pressed", "false");
    }

    let deb;
    search.addEventListener("input", () => {
      clearTimeout(deb);
      clearBtn.style.display = search.value ? "block" : "none";
      deb = setTimeout(() => {
        state.q = search.value;
        state.page = 0;
        render();
      }, 120);
    });

    clearBtn.addEventListener("click", () => {
      search.value = "";
      clearBtn.style.display = "none";
      state.q = "";
      state.page = 0;
      render();
      search.focus();
    });

    instFilter.addEventListener("change", () => { state.inst = instFilter.value; state.page = 0; render(); });
    rankFilter.addEventListener("change", () => { state.rank = rankFilter.value; state.page = 0; render(); });
    contactFilter.addEventListener("change", () => { state.contact = contactFilter.value; state.page = 0; render(); });
    sortSel.addEventListener("change", () => { state.sort = sortSel.value; state.page = 0; render(); });
    perPageSel.addEventListener("change", () => { state.per = parseInt(perPageSel.value, 10) || 50; state.page = 0; render(); });

    prevBtn.addEventListener("click", () => { if (state.page > 0) { state.page--; render(); } });
    nextBtn.addEventListener("click", () => { state.page++; render(); });
    firstBtn.addEventListener("click", () => { state.page = 0; render(); });
    lastBtn.addEventListener("click", () => {
      const list = getFilteredList();
      state.page = Math.max(0, Math.ceil(list.length / state.per) - 1);
      render();
    });

    if (emptyResetBtn) {
      emptyResetBtn.addEventListener("click", () => {
        search.value = "";
        clearBtn.style.display = "none";
        state.q = "";
        state.inst = "all";
        state.rank = "all";
        state.contact = "all";
        state.sort = "num";
        state.page = 0;
        instFilter.value = "all";
        rankFilter.value = "all";
        contactFilter.value = "all";
        sortSel.value = "num";
        render();
      });
    }

    qsa("table.dir thead th[data-sort]").forEach(th => {
      th.addEventListener("click", () => {
        const v = th.dataset.sort;
        const alt = { num: "num-desc", "num-desc": "num", name: "name-desc", "name-desc": "name" };
        state.sort = alt[state.sort] && (state.sort.startsWith(v)) ? alt[state.sort] : v;
        sortSel.value = state.sort;
        state.page = 0;
        render();
        qsa("table.dir thead th .srt").forEach(s => s.remove());
        th.insertAdjacentHTML("beforeend", "<span class='srt'>" + (state.sort.endsWith("desc") ? "▼" : "▲") + "</span>");
      });
    });

    exportCsvBtn.addEventListener("click", () => {
      const list = getFilteredList();
      const headers = ["Member #", "Name", "Address", "Phone", "Mobile", "Email", "Institute", "Note"];
      const rows = list.map(m => [
        fmtN(m.n),
        m.name,
        m.addr || "",
        m.ph || "",
        m.mob || "",
        m.em || "",
        m.inst || "",
        m.note || ""
      ]);

      const csvContent = "\uFEFF" + [headers, ...rows].map(row =>
        row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(",")
      ).join("\r\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "dsh_membership_register_" + list.length + "_members.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      window.__toast("CSV Register Exported", "Exported " + list.length + " members into a certified CSV spreadsheet.");
    });

    printDirBtn.addEventListener("click", () => {
      document.body.classList.remove("printing-cert");
      window.print();
    });

    render();
  }

  /* ---------------- Life Member Certificate & ID Generator ---------------- */
  function initCertificateSuite() {
    const picker = qs("#certMemberSelect");
    const searchInput = qs("#certSearchInput");
    const printBtn = qs("#printCertBtn");
    if (!picker || !MEMBERS) return;

    function populatePicker(filterQuery = "") {
      const q = filterQuery.trim().toLowerCase();
      let matched = MEMBERS;
      if (q) {
        matched = MEMBERS.filter(m => {
          const hay = (fmtN(m.n) + " " + m.n + " " + m.name + " " + (m.inst || "")).toLowerCase();
          return hay.includes(q);
        });
      }
      if (matched.length === 0) {
        picker.innerHTML = "<option value='' disabled>No matching members found</option>";
        return;
      }
      picker.innerHTML = matched.map(m =>
        "<option value='" + m.n + "'>" + fmtN(m.n) + " — " + esc(m.name) + "</option>"
      ).join("");
    }

    populatePicker();

    const defaultNum = 67;
    picker.value = defaultNum;
    updateCertDisplay(defaultNum);

    picker.addEventListener("change", () => {
      const n = parseInt(picker.value, 10);
      if (n) updateCertDisplay(n);
    });

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const val = searchInput.value;
        populatePicker(val);
        const firstOpt = picker.querySelector("option:not([disabled])");
        if (firstOpt) {
          picker.value = firstOpt.value;
          updateCertDisplay(parseInt(firstOpt.value, 10));
        }
      });
    }

    if (printBtn) {
      printBtn.addEventListener("click", () => {
        document.body.classList.add("printing-cert");
        window.print();
        setTimeout(() => document.body.classList.remove("printing-cert"), 1000);
      });
    }
  }

  function selectMemberForCert(num) {
    const picker = qs("#certMemberSelect");
    const searchInput = qs("#certSearchInput");
    if (searchInput) searchInput.value = "";
    if (picker) {
      picker.innerHTML = MEMBERS.map(m =>
        "<option value='" + m.n + "'>" + fmtN(m.n) + " — " + esc(m.name) + "</option>"
      ).join("");
      picker.value = num;
      updateCertDisplay(num);
    }
  }

  function updateCertDisplay(num) {
    const m = MEMBERS.find(x => x.n === num);
    if (!m) return;

    const regBadge = qs("#certRegBadge");
    const nameEl = qs("#certMemberName");
    const addrEl = qs("#certMemberAddr");
    const statusEl = qs("#certMemberStatus");

    if (regBadge) regBadge.textContent = "REGISTER ID: " + fmtN(m.n);
    if (nameEl) nameEl.textContent = m.name;
    if (addrEl) {
      const loc = m.inst ? (m.inst.toUpperCase() + (m.addr ? " &bull; " + esc(m.addr) : "")) : (m.addr ? esc(m.addr) : "Delhi-NCR Academic Registry");
      addrEl.innerHTML = loc;
    }
    if (statusEl) {
      statusEl.textContent = "Life Member";
    }

    const pocketAvatar = qs("#pocketAvatar");
    const pocketName = qs("#pocketName");
    const pocketId = qs("#pocketId");
    const pocketInst = qs("#pocketInst");

    if (pocketAvatar) pocketAvatar.textContent = getInitials(m.name);
    if (pocketName) pocketName.textContent = m.name;
    if (pocketId) pocketId.textContent = fmtN(m.n);
    if (pocketInst) pocketInst.textContent = m.inst ? m.inst.toUpperCase() : (m.addr ? m.addr.split(",").pop().trim() : "Delhi-NCR, India");
  }

  /* ---------------- Membership Form ---------------- */
  function initForm() {
    const form = qs("#join-form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const g = (n) => (form.querySelector("[name=" + n + "]").value || "").trim();

      const title = g("title") || "Dr.";
      const name = [g("first"), g("middle"), g("surname")].filter(Boolean).join(" ");
      if (!name) {
        window.__toast("Incomplete Application", "Please enter your full first name and surname.");
        return;
      }

      const inst = g("institute");
      if (!inst) {
        window.__toast("Institute Required", "Please specify your medical college, hospital or clinical department.");
        return;
      }

      const email = g("email");
      if (!email || !validEmail(email)) {
        window.__toast("Check E-mail Address", "Please provide a valid doctor e-mail address.");
        return;
      }

      const mobile = g("mobile");
      if (!mobile) {
        window.__toast("Mobile Required", "Please provide your active mobile number for meeting reminders.");
        return;
      }

      window.__toast(
        "Application Received",
        "Thank you, " + title + " " + name.split(" ")[0] + ". Your registration dossier has been submitted to the Executive Secretariat for ratification at the upcoming quarterly conclave. (Institutional demonstration)."
      );
      form.reset();
    });
  }

  const modalBackdrop = qs("#memberModalBackdrop");
  const modalCloseBtn = qs("#modalCloseBtn");
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeMemberModal();
    });
  }
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeMemberModal);
  }

  /* ---------------- Boot Orchestration ---------------- */
  function boot() {
    initTheme();
    try { initHeroGL(); } catch (e) { console.warn("HeroGL initialization notice:", e); }
    try { initDNA(); } catch (e) { console.warn("DNA initialization notice:", e); }
    initUI();
    initDirectory();
    initCertificateSuite();
    initForm();

    // Initial section from hash
    const initialHash = location.hash.replace("#", "");
    if (WINDOWS.includes(initialHash)) {
      switchWindow(initialHash, false);
    } else {
      switchWindow("home", false);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();