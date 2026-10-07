/**
 * River — Red River AI voice assistant widget.
 *
 * Flow: tap mic -> Web Speech API transcribes -> POST /river -> plays the MP3
 * reply returned by the server (grounded in redriverai.ca + ElevenLabs voice).
 *
 * Voice in  : browser Web Speech API (free, no API key)
 * Voice out : OpenRouter ElevenLabs, synthesised server-side
 * Brain     : server (n8n / river-server.py) — the API key never reaches here.
 *
 * Turn-taking: recognition pauses while River speaks; tapping the mic while
 * River is talking stops playback and starts listening again (barge-in).
 */
(function () {
  "use strict";

  var ENDPOINT = window.RIVER_ENDPOINT || "/api/river";
  var CALENDLY = "https://calendly.com/redriverai/30min";

  var history = [];
  var listening = false;
  var speaking = false;
  var recognizer = null;

  // ---------- DOM ----------
  var root = document.createElement("div");
  root.id = "river-widget";
  root.innerHTML = [
    '<button id="river-fab" aria-label="Talk to River">',
    '  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">',
    '    <path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"/>',
    '    <path fill="currentColor" d="M18 12a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93V23h2v-3.07A8 8 0 0 0 20 12h-2Z"/>',
    '  </svg>',
    '</button>',
    '<section id="river-panel" hidden>',
    '  <header id="river-head">',
    '    <span id="river-title">River</span>',
    '    <span id="river-status">Ask about our services or pricing</span>',
    '    <button id="river-close" aria-label="Close">&times;</button>',
    '  </header>',
    '  <div id="river-log" aria-live="polite"></div>',
    '  <div id="river-controls">',
    '    <button id="river-mic" aria-label="Hold to talk">🎙️ Talk</button>',
    '    <input id="river-text" placeholder="or type your question" autocomplete="off">',
    '    <button id="river-send" aria-label="Send">Send</button>',
    '  </div>',
    '  <div id="river-foot">',
    '    <a id="river-book" href="' + CALENDLY + '" target="_blank" rel="noopener">Book a call &rarr;</a>',
    '  </div>',
    '</section>'
  ].join("");

  var style = document.createElement("style");
  style.textContent = [
    '#river-widget{--rrai:#a90000;--ink:#1b1b1b;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif}',
    '#river-fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:58px;height:58px;',
    'border:0;border-radius:50%;background:var(--rrai);color:#fff;cursor:pointer;',
    'box-shadow:0 6px 20px rgba(0,0,0,.28);display:grid;place-items:center}',
    '#river-fab:hover{transform:scale(1.05)}',
    '#river-panel{position:fixed;right:20px;bottom:90px;z-index:2147483000;width:min(360px,calc(100vw - 32px));',
    'background:#fff;color:var(--ink);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.3);overflow:hidden}',
    '#river-head{display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--rrai);color:#fff}',
    '#river-title{font-weight:700}',
    '#river-status{font-size:12px;opacity:.85;flex:1}',
    '#river-close{background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer}',
    '#river-log{max-height:44vh;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}',
    '.river-msg{max-width:86%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap}',
    '.river-me{align-self:flex-end;background:var(--rrai);color:#fff;border-bottom-right-radius:4px}',
    '.river-bot{align-self:flex-start;background:#f2efec;color:var(--ink);border-bottom-left-radius:4px}',
    '.river-sys{align-self:center;font-size:12px;color:#8a8a8a}',
    '#river-controls{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #eee}',
    '#river-mic{background:var(--rrai);color:#fff;border:0;border-radius:10px;padding:10px 14px;cursor:pointer;font-size:14px}',
    '#river-mic.on{background:#0a7d33}',
    '#river-text{flex:1;min-width:0;border:1px solid #ddd;border-radius:10px;padding:10px;font-size:14px}',
    '#river-send{border:0;background:#eee;border-radius:10px;padding:10px 12px;cursor:pointer;font-size:14px}',
    '#river-foot{padding:0 12px 12px}',
    '#river-book{font-size:13px;color:var(--rrai);text-decoration:none;font-weight:600}',
    '@media (prefers-reduced-motion:reduce){#river-fab:hover{transform:none}}'
  ].join("");
  document.head.appendChild(style);
  document.body.appendChild(root);

  var $ = function (id) { return document.getElementById(id); };
  var panel = $("river-panel"), log = $("river-log"),
      status = $("river-status"), micBtn = $("river-mic");

  function bubble(text, cls) {
    var d = document.createElement("div");
    d.className = "river-msg " + cls;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function setStatus(t) { status.textContent = t; }

  // ---------- speech out ----------
  var currentAudio = null;
  function speak(b64) {
    if (!b64) return;
    try {
      var bytes = atob(b64);
      var buf = new Uint8Array(bytes.length);
      for (var i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      currentAudio = new Audio(url);
      speaking = true;
      setStatus("River is speaking…");
      pauseListening();
      currentAudio.onended = function () {
        speaking = false;
        URL.revokeObjectURL(url);
        currentAudio = null;
        setStatus("Ask another question, or book a call below");
      };
      currentAudio.play().catch(function () { speaking = false; });
    } catch (e) { speaking = false; }
  }

  function stopSpeaking() {
    if (currentAudio) { try { currentAudio.pause(); } catch (e) {} }
    speaking = false;
  }

  // ---------- ask ----------
  function ask(message) {
    if (!message || !message.trim()) return;
    bubble(message, "river-me");
    history.push({ role: "user", content: message });
    var pending = bubble("…", "river-sys");
    setStatus("Thinking…");

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message, history: history.slice(-6, -1) })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        pending.remove();
        var reply = d.reply || "Sorry, I had trouble just now.";
        bubble(reply, "river-bot");
        history.push({ role: "assistant", content: reply });
        speak(d.audio_b64);
      })
      .catch(function () {
        pending.remove();
        bubble("Sorry, I couldn't reach the server. Please email hello@redriverai.ca.", "river-bot");
        setStatus("Connection problem");
      });
  }

  // ---------- speech in ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    recognizer = new SR();
    recognizer.lang = "en-CA";
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
    recognizer.onresult = function (e) {
      var t = e.results[0][0].transcript;
      setListening(false);
      ask(t);
    };
    recognizer.onerror = function (e) {
      setListening(false);
      setStatus(e.error === "not-allowed"
        ? "Microphone blocked — typing works too"
        : "Didn't catch that — try again or type");
    };
    recognizer.onend = function () { setListening(false); };
  } else {
    micBtn.disabled = true;
    micBtn.textContent = "🎙️ (type instead)";
  }

  function setListening(on) {
    listening = on;
    micBtn.classList.toggle("on", on);
    micBtn.textContent = on ? "● Listening…" : "🎙️ Talk";
    if (on) setStatus("Listening…");
  }
  function pauseListening() {
    if (listening && recognizer) { try { recognizer.stop(); } catch (e) {} }
  }

  function startListening() {
    if (!recognizer) return;
    if (speaking) { stopSpeaking(); }          // barge-in
    if (listening) { setListening(false); try { recognizer.stop(); } catch (e) {} return; }
    try { recognizer.start(); setListening(true); }
    catch (e) { setListening(false); }
  }

  // ---------- wiring ----------
  $("river-fab").addEventListener("click", function () {
    panel.hidden = false;
    $("river-fab").style.display = "none";
    if (!log.childElementCount) {
      bubble("Hi, I'm River. Ask about our services, pricing, or the free AI audit.", "river-bot");
    }
    setStatus("Ask about our services or pricing");
  });
  $("river-close").addEventListener("click", function () {
    panel.hidden = true;
    $("river-fab").style.display = "grid";
    pauseListening();
    stopSpeaking();
  });
  micBtn.addEventListener("click", startListening);
  $("river-send").addEventListener("click", function () {
    var el = $("river-text");
    ask(el.value);
    el.value = "";
  });
  $("river-text").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { ask(this.value); this.value = ""; }
  });
})();
