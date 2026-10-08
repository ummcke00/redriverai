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

  var baseR = 44;
  var t = 0;

  function drawOrb() {
    cctx.clearRect(0, 0, CW, CH);
    var cx = CW / 2, cy = CH / 2;

    // how "loud" are we right now?
    var level = 0;
    if (mode === "speaking" && analyser && freqData) {
      analyser.getByteFrequencyData(freqData);
      var sum = 0;
      for (var i = 0; i < 32; i++) sum += freqData[i];
      level = Math.min(sum / (32 * 200), 1);
    }

    // one clean round ball. It only breathes / swells -- no wobble, no rings.
    var scale = 1;
    if (mode === "speaking")      scale = 1 + level * 0.12;
    else if (mode === "thinking") scale = 1 + Math.sin(t * 2.4) * 0.03;
    else if (mode === "listening") scale = 1 + Math.sin(t * 1.8) * 0.035;
    else                           scale = 1 + Math.sin(t * 1.0) * 0.022;
    var r = baseR * scale;

    // soft halo
    var g0 = cctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r + 24);
    g0.addColorStop(0, "rgba(201,13,45,0.22)");
    g0.addColorStop(1, "rgba(201,13,45,0)");
    cctx.fillStyle = g0;
    cctx.beginPath(); cctx.arc(cx, cy, r + 24, 0, Math.PI * 2); cctx.fill();

    // the sphere: light from the upper-left, darkening toward the rim
    var g1 = cctx.createRadialGradient(cx - r * 0.33, cy - r * 0.36, r * 0.10, cx, cy, r);
    g1.addColorStop(0, "#ff6f80");
    g1.addColorStop(0.55, "#cc1233");
    g1.addColorStop(1, "#8c0010");
    cctx.fillStyle = g1;
    cctx.beginPath(); cctx.arc(cx, cy, r, 0, Math.PI * 2); cctx.fill();
  }

  function loop() {
    t += 0.03;
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
