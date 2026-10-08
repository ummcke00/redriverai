/**
 * River — Red River AI voice assistant (AUDIO ONLY, animated orb).
 *
 * Visual: a living orb drawn on a canvas that reacts to River's actual voice
 * (Web Audio AnalyserNode on the playing audio) — the same feel as the old
 * ElevenLabs convai widget, but ours and free.
 *
 * Flow:
 *   page load   -> prefetch the spoken greeting (audio)
 *   first tap   -> River greets out loud, then listens automatically
 *   speak       -> transcribed -> /api/river -> River replies -> listens again
 *   ...hands-free until the visitor taps End or closes.
 *
 * Voice in  : browser Web Speech API
 * Voice out : OpenRouter ElevenLabs (server-side)
 *
 * Browser rule we cannot bypass: audio needs ONE user gesture before it plays.
 */
(function () {
  "use strict";

  var ENDPOINT = window.RIVER_ENDPOINT || "/api/river";
  var CALENDLY = "https://calendly.com/redriverai/30min";

  var history = [];
  var mode = "idle";        // idle | listening | thinking | speaking
  var active = false;
  var greetingB64 = null;
  var recognizer = null;
  var restartTimer = null;

  // ---------- DOM ----------
  var root = document.createElement("div");
  root.id = "river-widget";
  root.innerHTML = [
    '<button id="river-fab" aria-label="Talk to River">',
    '  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">',
    '    <path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"/>',
    '    <path fill="currentColor" d="M18 12a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93V23h2v-3.07A8 8 0 0 0 20 12h-2Z"/>',
    '  </svg>',
    '  <span>Talk to River</span>',
    '</button>',
    '<section id="river-panel" hidden>',
    '  <header id="river-head">',
    '    <span id="river-title">River</span>',
    '    <button id="river-close" aria-label="Close">&times;</button>',
    '  </header>',
    '  <div id="river-stage">',
    '    <canvas id="river-orb" width="296" height="296" aria-hidden="true"></canvas>',
    '    <p id="river-state">Tap anywhere to start</p>',
    '  </div>',
    '  <div id="river-controls">',
    '    <button id="river-main">Start</button>',
    '  </div>',
    '  <div id="river-foot">',
    '    <a id="river-book" href="' + CALENDLY + '" target="_blank" rel="noopener">Book a call &rarr;</a>',
    '  </div>',
    '</section>'
  ].join("");

  var style = document.createElement("style");
  style.textContent = [
    '#river-widget{--rrai:#a90000;--ink:#1b1b1b;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif}',
    '#river-fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;',
    'display:inline-flex;align-items:center;gap:8px;padding:13px 20px;border:0;border-radius:999px;',
    'background:var(--rrai);color:#fff;cursor:pointer;font-size:15px;font-weight:600;',
    'box-shadow:0 6px 20px rgba(0,0,0,.3)}',
    '#river-fab:hover{transform:scale(1.03)}',
    '#river-widget.river-lifted #river-fab{bottom:120px}',
    '#river-widget.river-lifted #river-panel{bottom:190px}',
    '#river-panel{position:fixed;right:20px;bottom:90px;z-index:2147483000;width:min(320px,calc(100vw - 32px));',
    'background:#fff;color:var(--ink);border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.3);overflow:hidden}',
    '#river-head{display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--rrai);color:#fff}',
    '#river-title{font-weight:700;flex:1}',
    '#river-close{background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer}',
    '#river-stage{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 16px 12px;text-align:center}',
    '#river-orb{width:148px;height:148px;display:block}',
    '#river-state{font-size:14px;font-weight:600;margin:0;color:#555}',
    '#river-controls{padding:0 14px 14px}',
    '#river-main{width:100%;background:var(--rrai);color:#fff;border:0;border-radius:10px;padding:13px 14px;cursor:pointer;font-size:15px;font-weight:600}',
    '#river-main.stop{background:#444}',
    '#river-foot{padding:0 14px 14px}',
    '#river-book{font-size:13px;color:var(--rrai);text-decoration:none;font-weight:600}',
    '@media (prefers-reduced-motion:reduce){#river-fab:hover{transform:none}}'
  ].join("");
  document.head.appendChild(style);
  document.body.appendChild(root);

  var $ = function (id) { return document.getElementById(id); };
  var panel = $("river-panel"), canvas = $("river-orb"), state = $("river-state"),
      mainBtn = $("river-main");

  function setState(m, text) {
    mode = m;
    if (text) state.textContent = text;
    mainBtn.textContent = active ? "End conversation" : "Start";
    mainBtn.classList.toggle("stop", active);
  }

  // ================= animated orb =================
  var cctx = canvas.getContext("2d");
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var CW = 148, CH = 148;
  canvas.width = CW * DPR;
  canvas.height = CH * DPR;
  cctx.scale(DPR, DPR);

  var POINTS = 56;
  var baseR = 42;
  var radii = new Float32Array(POINTS).fill(baseR);
  var smooth = new Float32Array(POINTS).fill(baseR);
  var t = 0;

  function drawOrb() {
    cctx.clearRect(0, 0, CW, CH);
    var cx = CW / 2, cy = CH / 2;

    // how "loud" are we right now?
    var level = 0, bands = null;
    if (mode === "speaking" && analyser && freqData) {
      analyser.getByteFrequencyData(freqData);
      bands = freqData;
      var sum = 0;
      for (var i = 0; i < 32; i++) sum += freqData[i];
      level = Math.min(sum / (32 * 200), 1);
    }

    // per-point radius from the voice spectrum, or a gentle breathe when idle
    for (var p = 0; p < POINTS; p++) {
      var ang = (p / POINTS) * Math.PI * 2;
      var target = baseR;
      if (bands) {
        // map the spectrum around the ring
        var bi = Math.floor((p / POINTS) * 40);
        var v = bands[bi] / 255;
        target = baseR + v * 20 + level * 6;
      } else if (mode === "listening") {
        target = baseR + Math.sin(t * 3 + ang * 5) * 4.5;
      } else if (mode === "thinking") {
        target = baseR + Math.sin(t * 4 + ang * 3) * 3;
      } else {
        target = baseR + Math.sin(t * 1.2 + ang * 2) * 2.5;
      }
      radii[p] = target;
      smooth[p] += (radii[p] - smooth[p]) * 0.22;   // ease toward target
    }

    // outer glow
    var g0 = cctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, baseR + 34 + level * 14);
    g0.addColorStop(0, "rgba(201,13,45,0.30)");
    g0.addColorStop(1, "rgba(201,13,45,0)");
    cctx.fillStyle = g0;
    cctx.beginPath(); cctx.arc(cx, cy, baseR + 34 + level * 14, 0, Math.PI * 2); cctx.fill();

    // the blob
    cctx.beginPath();
    for (var q = 0; q <= POINTS; q++) {
      var i2 = q % POINTS;
      var a2 = (i2 / POINTS) * Math.PI * 2;
      var x = cx + Math.cos(a2) * smooth[i2];
      var y = cy + Math.sin(a2) * smooth[i2];
      if (q === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
    }
    cctx.closePath();
    var g1 = cctx.createRadialGradient(cx - 12, cy - 14, 6, cx, cy, baseR + 22);
    g1.addColorStop(0, "#ff5a6e");
    g1.addColorStop(0.55, "#c8102e");
    g1.addColorStop(1, "#8f0010");
    cctx.fillStyle = g1;
    cctx.fill();

    // thinking: a rotating highlight sweep
    if (mode === "thinking") {
      cctx.save();
      cctx.beginPath(); cctx.arc(cx, cy, baseR + 6, 0, Math.PI * 2); cctx.clip();
      cctx.translate(cx, cy); cctx.rotate(t * 3);
      var g2 = cctx.createLinearGradient(0, -baseR, 0, baseR);
      g2.addColorStop(0, "rgba(255,255,255,0.34)");
      g2.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = g2;
      cctx.fillRect(-baseR, -baseR, baseR * 2, baseR * 2);
      cctx.restore();
    }

    // listening: expanding ring
    if (mode === "listening") {
      var ringR = baseR + 10 + ((t * 26) % 22);
      var alpha = 0.5 * (1 - ((t * 26) % 22) / 22);
      cctx.beginPath();
      cctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      cctx.strokeStyle = "rgba(200,16,46," + alpha.toFixed(3) + ")";
      cctx.lineWidth = 2;
      cctx.stroke();
    }
  }

  function loop() {
    t += 0.045;
    drawOrb();
    requestAnimationFrame(loop);
  }
  loop();

  // ================= audio out (+ analyser) =================
  var audioEl = null, actx = null, analyser = null, freqData = null, srcNode = null;

  function ensureAudio() {
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.setAttribute("playsinline", "");
      audioEl.preload = "auto";
    }
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        try {
          actx = new AC();
          analyser = actx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.78;
          freqData = new Uint8Array(analyser.frequencyBinCount);
          srcNode = actx.createMediaElementSource(audioEl);
          srcNode.connect(analyser);
          analyser.connect(actx.destination);
        } catch (e) {
          // Graph failed — sound still plays through the element directly.
          actx = null; analyser = null; freqData = null;
        }
      }
    }
    if (actx && actx.state === "suspended") { actx.resume().catch(function () {}); }
  }

  function playB64(b64, onDone) {
    if (!b64) { if (onDone) onDone(); return; }
    ensureAudio();
    try {
      var bytes = atob(b64);
      var buf = new Uint8Array(bytes.length);
      for (var i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      if (audioEl._url) { try { URL.revokeObjectURL(audioEl._url); } catch (e) {} }
      audioEl._url = url;
      audioEl.src = url;
      audioEl.onended = function () {
        if (audioEl._url) { try { URL.revokeObjectURL(audioEl._url); } catch (e) {} audioEl._url = null; }
        if (onDone) onDone();
      };
      audioEl.play().catch(function () { if (onDone) onDone(); });
    } catch (e) { if (onDone) onDone(); }
  }

  function stopAudio() {
    if (audioEl) { try { audioEl.pause(); audioEl.currentTime = 0; } catch (e) {} }
  }

  // ================= speech in =================
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    recognizer = new SR();
    recognizer.lang = "en-CA";
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.onresult = function (e) {
      var said = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) said += e.results[i][0].transcript;
      }
      said = said.trim();
      if (said) {
        if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
        ask(said);
      }
    };
    recognizer.onerror = function (e) {
      if (e.error === "no-speech") { if (active) scheduleListen(600); return; }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        active = false;
        setState("idle", "Microphone blocked — allow mic access, then tap Start");
        return;
      }
      if (active) scheduleListen(900);
    };
    recognizer.onend = function () {
      if (active && mode === "listening") scheduleListen(400);
    };
  }

  function scheduleListen(delay) {
    if (!active) return;
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(function () {
      restartTimer = null;
      if (active) startListening();
    }, delay);
  }

  function startListening() {
    if (!recognizer || !active) return;
    try {
      recognizer.start();
      setState("listening", "Listening…");
    } catch (e) { scheduleListen(500); }
  }

  // ================= brain =================
  function ask(message) {
    history.push({ role: "user", content: message });
    setState("thinking", "One moment…");

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message, history: history.slice(-6, -1) })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var reply = d.reply || "Sorry, I had trouble just now.";
        history.push({ role: "assistant", content: reply });
        setState("speaking", "River is talking…");
        playB64(d.audio_b64, function () { if (active) scheduleListen(500); });
      })
      .catch(function () {
        setState("speaking", "River is talking…");
        playB64(null, function () { if (active) scheduleListen(500); });
      });
  }

  // ================= control =================
  function begin() {
    if (active) return;
    if (!SR) { setState("idle", "Voice isn't supported here — try Chrome, Edge, or Safari"); return; }
    active = true;
    ensureAudio();
    setState("speaking", "River is talking…");
    if (greetingB64) {
      playB64(greetingB64, function () { if (active) scheduleListen(400); });
    } else {
      ask("__greet__");
    }
  }

  function end() {
    active = false;
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    stopAudio();
    if (recognizer) { try { recognizer.abort(); } catch (e) {} }
    history = [];
    setState("idle", "Tap anywhere to start");
  }

  function prefetchGreeting() {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "__greet__" })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.audio_b64) greetingB64 = d.audio_b64; })
      .catch(function () {});
  }

  // ================= wiring =================
  function openPanel() {
    panel.hidden = false;
    $("river-fab").style.display = "none";
  }

  $("river-fab").addEventListener("click", openPanel);
  $("river-close").addEventListener("click", function () {
    end();
    panel.hidden = true;
    $("river-fab").style.display = "inline-flex";
    try { sessionStorage.setItem("riverDismissed", "1"); } catch (e) {}
  });
  mainBtn.addEventListener("click", function () { active ? end() : begin(); });

  // One tap anywhere starts it (browser blocks audio before a gesture).
  function firstGesture() {
    document.removeEventListener("pointerdown", firstGesture, true);
    document.removeEventListener("touchstart", firstGesture, true);
    document.removeEventListener("keydown", firstGesture, true);
    if (!active) { openPanel(); begin(); }
  }
  document.addEventListener("pointerdown", firstGesture, true);
  document.addEventListener("touchstart", firstGesture, true);
  document.addEventListener("keydown", firstGesture, true);

  // Keep clear of the cookie banner.
  function liftIfBanner() {
    if (document.getElementById("cookie-consent-banner")) {
      $("river-widget").classList.add("river-lifted");
    }
  }
  liftIfBanner();
  setInterval(liftIfBanner, 1500);

  try {
    if (sessionStorage.getItem("riverDismissed") !== "1") {
      setTimeout(openPanel, 1000);
      prefetchGreeting();
    }
  } catch (e) {
    setTimeout(openPanel, 1000);
    prefetchGreeting();
  }
})();
