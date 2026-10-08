/**
 * River — Red River AI voice assistant (AUDIO ONLY).
 *
 * No text chat. No transcript. The visitor hears River and talks back.
 *
 * Flow:
 *   page load    -> prefetch the spoken greeting (audio) in the background
 *   first tap/⏎   -> River greets out loud, then starts listening automatically
 *   speak        -> transcribed -> /api/river -> River replies -> listens again
 *   ...hands-free loop until the visitor closes the widget.
 *
 * Voice in  : browser Web Speech API
 * Voice out : OpenRouter ElevenLabs (server-side)
 *
 * Browser rule we cannot bypass: audio needs ONE user gesture before it may play.
 * So the greeting fires on the visitor's first tap anywhere on the page.
 */
(function () {
  "use strict";

  var ENDPOINT = window.RIVER_ENDPOINT || "/api/river";
  var CALENDLY = "https://calendly.com/redriverai/30min";

  var history = [];
  var mode = "idle";        // idle | greeting | listening | thinking | speaking
  var active = false;       // in a live voice conversation?
  var greetingB64 = null;   // prefetched opener
  var currentAudio = null;
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
    '    <div id="river-orb" aria-hidden="true"></div>',
    '    <p id="river-state">Tap anywhere to start</p>',
    '    <p id="river-hint">You can talk to River — hands free.</p>',
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
    '#river-panel{position:fixed;right:20px;bottom:90px;z-index:2147483000;width:min(340px,calc(100vw - 32px));',
    'background:#fff;color:var(--ink);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.3);overflow:hidden}',
    '#river-head{display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--rrai);color:#fff}',
    '#river-title{font-weight:700;flex:1}',
    '#river-close{background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer}',
    '#river-stage{display:flex;flex-direction:column;align-items:center;gap:12px;padding:26px 18px 20px;text-align:center}',
    '#river-orb{width:74px;height:74px;border-radius:50%;background:var(--rrai);opacity:.9;',
    'box-shadow:0 0 0 0 rgba(169,0,0,.5);transition:transform .2s}',
    '#river-orb.listening{animation:river-pulse 1.6s infinite}',
    '#river-orb.speaking{animation:river-pulse .9s infinite}',
    '#river-orb.thinking{animation:river-spin 1.1s linear infinite}',
    '@keyframes river-pulse{0%{box-shadow:0 0 0 0 rgba(169,0,0,.55)}70%{box-shadow:0 0 0 22px rgba(169,0,0,0)}100%{box-shadow:0 0 0 0 rgba(169,0,0,0)}}',
    '@keyframes river-spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}',
    '#river-state{font-size:16px;font-weight:600;margin:0}',
    '#river-hint{font-size:13px;color:#7c7c7c;margin:0}',
    '#river-controls{padding:0 14px 14px}',
    '#river-main{width:100%;background:var(--rrai);color:#fff;border:0;border-radius:10px;padding:13px 14px;cursor:pointer;font-size:15px;font-weight:600}',
    '#river-main.stop{background:#444}',
    '#river-foot{padding:0 14px 14px}',
    '#river-book{font-size:13px;color:var(--rrai);text-decoration:none;font-weight:600}',
    '@media (prefers-reduced-motion:reduce){#river-orb{animation:none!important}#river-fab:hover{transform:none}}'
  ].join("");
  document.head.appendChild(style);
  document.body.appendChild(root);

  var $ = function (id) { return document.getElementById(id); };
  var panel = $("river-panel"), orb = $("river-orb"), state = $("river-state"),
      hint = $("river-hint"), mainBtn = $("river-main");

  function setState(m, text, hintText) {
    mode = m;
    orb.className = m === "listening" ? "listening"
                 : m === "speaking" ? "speaking"
                 : m === "thinking" ? "thinking" : "";
    if (text) state.textContent = text;
    if (hintText !== undefined) hint.textContent = hintText;
    mainBtn.textContent = active ? "End conversation" : "Start";
    mainBtn.classList.toggle("stop", active);
  }

  // ---------- audio out ----------
  function playB64(b64, onDone) {
    if (!b64) { if (onDone) onDone(); return; }
    try {
      var bytes = atob(b64);
      var buf = new Uint8Array(bytes.length);
      for (var i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      if (currentAudio) { try { currentAudio.pause(); } catch (e) {} }
      currentAudio = new Audio(url);
      currentAudio.onended = function () {
        URL.revokeObjectURL(url);
        if (currentAudio === this) currentAudio = null;
        if (onDone) onDone();
      };
      currentAudio.play().catch(function () { if (onDone) onDone(); });
    } catch (e) { if (onDone) onDone(); }
  }

  // ---------- speech in ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    recognizer = new SR();
    recognizer.lang = "en-CA";
    recognizer.interimResults = true;     // feel responsive; final decides
    recognizer.continuous = false;
    recognizer.onresult = function (e) {
      var finalText = "", interim = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      if (interim) state.textContent = "…" + interim.trim();
      if (finalText.trim()) {
        if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
        var said = finalText.trim();
        setState("thinking", "One moment…", "");
        ask(said);
      }
    };
    recognizer.onerror = function (e) {
      if (e.error === "no-speech") {              // just silence — keep listening
        if (active) scheduleListen(600);
        return;
      }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setState("idle", "Microphone blocked", "Allow mic access in your browser, then tap Start.");
        active = false;
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
      if (!active) return;
      startListening();
    }, delay);
  }

  function startListening() {
    if (!recognizer || !active) return;
    try {
      recognizer.start();
      setState("listening", "Listening…", "Speak now.");
    } catch (e) {
      // already started — retry shortly
      scheduleListen(500);
    }
  }

  // ---------- brain ----------
  function ask(message) {
    history.push({ role: "user", content: message });
    setState("thinking", "One moment…", "");

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message, history: history.slice(-6, -1) })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var reply = d.reply || "Sorry, I had trouble just now. Please email hello@redriverai.ca.";
        history.push({ role: "assistant", content: reply });
        setState("speaking", "River is talking…", "Tap End to stop.");
        playB64(d.audio_b64, function () {
          if (active) scheduleListen(500);
        });
      })
      .catch(function () {
        setState("speaking", "River is talking…", "");
        playB64(null, function () {
          if (active) scheduleListen(500);
        });
      });
  }

  // ---------- conversation control ----------
  function begin() {
    if (active) return;
    active = true;
    if (!SR) {
      setState("idle", "Voice isn't supported in this browser",
               "Try Chrome, Edge, or Safari.");
      active = false;
      return;
    }
    setState("speaking", "River is talking…", "");
    if (greetingB64) {
      playB64(greetingB64, function () { if (active) scheduleListen(400); });
    } else {
      ask("__greet__");   // fallback if the prefetch didn't land
    }
  }

  function end() {
    active = false;
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    if (currentAudio) { try { currentAudio.pause(); } catch (e) {} currentAudio = null; }
    if (recognizer) { try { recognizer.abort(); } catch (e) {} }
    history = [];
    setState("idle", "Tap anywhere to start", "You can talk to River — hands free.");
  }

  // ---------- prefetch the greeting ----------
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

  // ---------- wiring ----------
  function openPanel() {
    panel.hidden = false;
    $("river-fab").style.display = "none";
  }

  $("river-fab").addEventListener("click", function () { openPanel(); });
  $("river-close").addEventListener("click", function () {
    end();
    panel.hidden = true;
    $("river-fab").style.display = "inline-flex";
    try { sessionStorage.setItem("riverDismissed", "1"); } catch (e) {}
  });
  mainBtn.addEventListener("click", function () { active ? end() : begin(); });

  // One tap anywhere starts the conversation (browser blocks audio before a gesture).
  function firstGesture() {
    document.removeEventListener("pointerdown", firstGesture, true);
    document.removeEventListener("touchstart", firstGesture, true);
    document.removeEventListener("keydown", firstGesture, true);
    if (!active) { openPanel(); begin(); }
  }
  document.addEventListener("pointerdown", firstGesture, true);
  document.addEventListener("touchstart", firstGesture, true);
  document.addEventListener("keydown", firstGesture, true);

  // ---------- auto-open on arrival ----------
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
