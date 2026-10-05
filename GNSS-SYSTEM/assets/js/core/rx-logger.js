/* =========================================================
   GPMS  Rx • Logging • Error
   ---------------------------------------------------------
   One self-contained module that gives every page:

     1. RX LOGGING   - receiver (NMEA) messages, with checksum
                       validation and per-sentence statistics.
     2. SYSTEM LOG   - console.log / info / debug, page lifecycle,
                       network state, playback events.
     3. ERROR CATCH  - window errors, unhandled promise rejections,
                       console.error / warn, failed resources
                       (img / script / css), failed fetch / XHR.

   The log survives page navigation (sessionStorage), is shown in
   a console panel opened from the footer, and can be filtered,
   searched, paused, copied, cleared and exported (TXT/CSV/JSON).

   Public API  ->  window.RxLogger
     RxLogger.rx(message, detail)      receiver message
     RxLogger.info / warn / error / debug(message, detail)
     RxLogger.analyzeNMEA(text, name)  validate + summarise NMEA text
     RxLogger.feed(sentence)           log one live NMEA sentence
     RxLogger.open() / close() / toggle()
     RxLogger.clear() / export(format) / getEntries()
   ========================================================= */

(function () {
  "use strict";

  if (window.RxLogger) return; // never load twice

  /* ---------------------------------------------------------
     CONFIG
     --------------------------------------------------------- */
  var STORE_KEY = "gpms.rxlog.v1";
  var HEIGHT_KEY = "gpms.rxlog.height";
  var DEMO_KEY = "gpms.rxlog.demo";
  var MAX_ENTRIES = 1000;      // ring-buffer size
  var MAX_TEXT = 600;          // longest stored message
  var MAX_PER_SECOND = 200;    // flood protection
  var SAVE_DELAY = 400;        // ms debounce for persistence

  /* Keep untouched references so the logger never logs itself. */
  var nativeConsole = {};
  ["log", "info", "warn", "error", "debug"].forEach(function (k) {
    nativeConsole[k] = (console[k] || console.log).bind(console);
  });

  /* ---------------------------------------------------------
     STATE
     --------------------------------------------------------- */
  var entries = [];
  var nextId = 1;
  var counts = { rx: 0, log: 0, warn: 0, err: 0 };
  var unreadErrors = 0;
  var paused = false;
  var pausedBuffer = [];
  var panelOpen = false;
  var filter = "all";
  var search = "";
  var autoScroll = true;
  var ui = null;               // DOM references, set on mount
  var saveTimer = null;
  var floodWindow = 0;
  var floodCount = 0;
  var floodWarned = false;
  var demoTimer = null;

  var PAGE = (function () {
    var p = location.pathname.split("/").pop() || "index.html";
    return p.replace(/\.html?$/i, "") || "index";
  })();

  /* ---------------------------------------------------------
     HELPERS
     --------------------------------------------------------- */
  function pad(n, w) {
    n = String(n);
    while (n.length < (w || 2)) n = "0" + n;
    return n;
  }

  function clock(ms) {
    var d = new Date(ms);
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" +
           pad(d.getSeconds()) + "." + pad(d.getMilliseconds(), 3);
  }

  function stamp(ms) {
    var d = new Date(ms);
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
           "-" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  function truncate(s, n) {
    s = String(s);
    return s.length > n ? s.slice(0, n) + "… (+" + (s.length - n) + " chars)" : s;
  }

  /* Turn any value into a short, safe string (handles cycles / Errors). */
  function stringify(v) {
    if (v === undefined) return "undefined";
    if (v === null) return "null";
    if (typeof v === "string") return v;
    if (v instanceof Error) return v.name + ": " + v.message;
    if (typeof v === "function") return "[function " + (v.name || "anonymous") + "]";
    if (typeof v !== "object") return String(v);
    try {
      var seen = [];
      return JSON.stringify(v, function (k, val) {
        if (typeof val === "object" && val !== null) {
          if (seen.indexOf(val) !== -1) return "[Circular]";
          seen.push(val);
        }
        if (Array.isArray(val) && val.length > 20) {
          return val.slice(0, 20).concat(["… +" + (val.length - 20) + " items"]);
        }
        return val;
      });
    } catch (e) {
      return Object.prototype.toString.call(v);
    }
  }

  function joinArgs(args) {
    return Array.prototype.map.call(args, stringify).join(" ");
  }

  /* ---------------------------------------------------------
     PERSISTENCE (sessionStorage, always guarded)
     --------------------------------------------------------- */
  function restore() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.entries)) return;
      entries = data.entries.slice(-MAX_ENTRIES);
      nextId = data.nextId || entries.length + 1;
      entries.forEach(countEntry);
    } catch (e) { /* storage unavailable or corrupt - start clean */ }
  }

  function saveNow() {
    saveTimer = null;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ nextId: nextId, entries: entries }));
    } catch (e) { /* quota / disabled - ignore */ }
  }

  function scheduleSave() {
    if (!saveTimer) saveTimer = setTimeout(saveNow, SAVE_DELAY);
  }

  /* ---------------------------------------------------------
     CORE: ADD AN ENTRY
     channel: "RX" | "SYS"        level: "debug"|"info"|"warn"|"error"
     --------------------------------------------------------- */
  function countEntry(e) {
    if (e.ch === "RX") counts.rx++;
    if (e.lvl === "warn") counts.warn++;
    else if (e.lvl === "error") counts.err++;
    else if (e.ch !== "RX") counts.log++;
  }

  function add(channel, level, message, detail, source) {
    var now = Date.now();

    /* flood protection */
    var sec = Math.floor(now / 1000);
    if (sec !== floodWindow) { floodWindow = sec; floodCount = 0; floodWarned = false; }
    if (++floodCount > MAX_PER_SECOND) {
      if (!floodWarned) {
        floodWarned = true;
        add("SYS", "warn", "Log rate limit reached - further messages this second dropped");
      }
      return null;
    }

    message = truncate(message, MAX_TEXT);
    var last = entries[entries.length - 1];

    /* collapse immediate repeats into one row with a counter */
    if (last && last.ch === channel && last.lvl === level && last.msg === message &&
        last.src === (source || PAGE) && now - last.t < 3000) {
      last.n = (last.n || 1) + 1;
      last.t = now;
      countEntry(last);
      if (level === "error" && !panelOpen) unreadErrors++;
      afterChange(last, true);
      return last;
    }

    var entry = {
      id: nextId++, t: now, ch: channel, lvl: level,
      src: source || PAGE, msg: message,
      det: detail === undefined ? "" : truncate(stringify(detail), 4000), n: 1
    };

    if (paused) {
      pausedBuffer.push(entry);
      return entry;
    }

    commit(entry);
    return entry;
  }

  function commit(entry) {
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    countEntry(entry);
    if (entry.lvl === "error" && !panelOpen) unreadErrors++;
    afterChange(entry, false);
  }

  function afterChange(entry, isRepeat) {
    scheduleSave();
    if (!ui) return;
    updateFooter();
    if (!panelOpen) return;
    if (isRepeat) renderAll(); else appendRow(entry);
    updateStatus();
  }

  /* ---------------------------------------------------------
     NMEA SUPPORT  (checksum, parsing, statistics)
     --------------------------------------------------------- */
  function nmeaChecksum(body) {
    var c = 0;
    for (var i = 0; i < body.length; i++) c ^= body.charCodeAt(i);
    var h = c.toString(16).toUpperCase();
    return h.length < 2 ? "0" + h : h;
  }

  /* Returns {ok, type, talker, fields, reason}. */
  function parseNMEA(line) {
    line = line.trim();
    var start = line.charAt(0);
    if (start !== "$" && start !== "!") return { ok: false, skip: true, reason: "not an NMEA sentence" };
    var star = line.lastIndexOf("*");
    if (star === -1) return { ok: false, reason: "missing checksum delimiter (*)" };
    var body = line.slice(1, star);
    var given = line.slice(star + 1, star + 3).toUpperCase();
    if (!/^[0-9A-F]{2}$/.test(given)) return { ok: false, reason: "malformed checksum '" + line.slice(star + 1) + "'" };
    var calc = nmeaChecksum(body);
    var fields = body.split(",");
    var id = fields[0] || "";
    var type = id.length >= 5 ? id.slice(-3) : id;
    var talker = id.length >= 5 ? id.slice(0, id.length - 3) : "";
    if (calc !== given) {
      return { ok: false, type: type, talker: talker, reason: "checksum mismatch (expected " + calc + ", got " + given + ")" };
    }
    return { ok: true, type: type, talker: talker, fields: fields };
  }

  /* Log ONE live sentence (validated). */
  function feed(sentence, tag) {
    var r = parseNMEA(sentence);
    if (r.skip) return r;
    var prefix = tag ? "[" + tag + "] " : "";
    if (!r.ok) {
      add("RX", "error", prefix + "Bad sentence - " + r.reason, sentence.trim(), "rx");
      return r;
    }
    if (r.type === "GGA") {
      var q = parseInt(r.fields[6], 10) || 0;
      var sats = r.fields[7] || "0";
      if (q === 0) {
        add("RX", "warn", prefix + r.talker + "GGA - NO FIX (" + sats + " satellites used)", sentence.trim(), "rx");
        return r;
      }
    }
    add("RX", "info", prefix + sentence.trim(), undefined, "rx");
    return r;
  }

  /* Validate + summarise a whole NMEA text (e.g. playback file). */
  function analyzeNMEA(text, name) {
    var label = name || "data";
    var started = performance.now();
    var lines = String(text).split(/\r?\n/);
    var stats = { total: 0, valid: 0, bad: 0, other: 0, types: {} };
    var shown = 0, MAX_SHOWN = 8;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) continue;
      var r = parseNMEA(line);
      if (r.skip) { stats.other++; continue; }
      stats.total++;
      if (r.ok) {
        stats.valid++;
        stats.types[r.type] = (stats.types[r.type] || 0) + 1;
      } else {
        stats.bad++;
        if (shown < MAX_SHOWN) {
          shown++;
          add("RX", "error", label + " line " + (i + 1) + ": " + r.reason, truncate(line.trim(), 200), "rx");
        }
      }
    }
    if (stats.bad > MAX_SHOWN) {
      add("RX", "warn", label + ": " + (stats.bad - MAX_SHOWN) + " more invalid sentences not listed", undefined, "rx");
    }

    var ms = Math.round(performance.now() - started);
    if (stats.total === 0) {
      add("RX", "warn", label + ": no NMEA sentences found (" + stats.other + " other line" + (stats.other === 1 ? "" : "s") + ")", undefined, "rx");
    } else {
      var typeList = Object.keys(stats.types).sort().map(function (k) { return k + " " + stats.types[k]; }).join(", ");
      add("RX", stats.bad ? "warn" : "info",
        label + ": " + stats.total + " sentences, " + stats.valid + " valid, " + stats.bad + " invalid (" + ms + " ms)",
        typeList ? "Types: " + typeList : undefined, "rx");
    }
    return stats;
  }

  /* ---------------------------------------------------------
     DEMO RX FEED  (simulated receiver, clearly labelled)
     --------------------------------------------------------- */
  var demoTick = 0;
  function dm(deg, isLat) {
    var d = Math.floor(Math.abs(deg));
    var m = (Math.abs(deg) - d) * 60;
    var ms = m.toFixed(4);
    if (m < 10) ms = "0" + ms;
    return (isLat ? pad(d, 2) : pad(d, 3)) + ms;
  }

  function sentence(body) {
    return "$" + body + "*" + nmeaChecksum(body);
  }

  function demoStep() {
    demoTick++;
    var d = new Date();
    var t = pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + ".00";
    var lat = 30.0 + Math.sin(demoTick / 40) * 0.00012;
    var lon = 70.0 + Math.cos(demoTick / 35) * 0.00015;
    var sats = 9 + Math.round(Math.sin(demoTick / 9) * 2);
    var noFix = demoTick % 47 === 0;
    var q = noFix ? 0 : 1;
    var hdop = (0.9 + Math.abs(Math.sin(demoTick / 13)) * 0.8).toFixed(1);

    var gga = sentence("GPGGA," + t + "," + dm(lat, true) + ",N," + dm(lon, false) + ",E," + q + "," +
                       pad(noFix ? 0 : sats) + "," + hdop + ",51.5,M,-0.2,M,,");
    var rmc = sentence("GPRMC," + t + "," + (noFix ? "V" : "A") + "," + dm(lat, true) + ",N," + dm(lon, false) +
                       ",E,0.02,0.0," + pad(d.getUTCDate()) + pad(d.getUTCMonth() + 1) + String(d.getUTCFullYear()).slice(2) + ",,,A");

    feed(gga, "DEMO");
    feed(rmc, "DEMO");

    /* every so often: a corrupted sentence to exercise error logging */
    if (demoTick % 31 === 0) {
      feed(gga.replace(/\*..$/, "*00"), "DEMO");
    }
  }

  function setDemo(on, silent) {
    try { sessionStorage.setItem(DEMO_KEY, on ? "1" : "0"); } catch (e) {}
    if (on && !demoTimer) {
      demoTimer = setInterval(demoStep, 1000);
      if (!silent) add("SYS", "info", "Demo RX feed started (simulated NMEA, 1 Hz)");
    } else if (!on && demoTimer) {
      clearInterval(demoTimer);
      demoTimer = null;
      if (!silent) add("SYS", "info", "Demo RX feed stopped");
    }
    if (ui && ui.demo) ui.demo.checked = !!on;
  }

  /* ---------------------------------------------------------
     AUTOMATIC CAPTURE
     --------------------------------------------------------- */
  function installCapture() {
    /* uncaught exceptions + failed resource loads */
    window.addEventListener("error", function (ev) {
      var t = ev.target;
      if (t && t !== window && t.nodeType === 1) {
        var url = t.src || t.href || "";
        add("SYS", "error", "Failed to load <" + t.tagName.toLowerCase() + "> " + url, undefined, "resource");
        return;
      }
      var where = ev.filename ? ev.filename.split("/").pop() + ":" + ev.lineno + ":" + ev.colno : "";
      add("SYS", "error", ev.message || "Script error", (ev.error && ev.error.stack) || where, "script");
    }, true);

    window.addEventListener("unhandledrejection", function (ev) {
      var r = ev.reason;
      add("SYS", "error", "Unhandled promise rejection: " + stringify(r), r && r.stack, "promise");
    });

    /* console mirror */
    var map = { log: "info", info: "info", debug: "debug", warn: "warn", error: "error" };
    Object.keys(map).forEach(function (k) {
      console[k] = function () {
        try { add("SYS", map[k], joinArgs(arguments), undefined, "console"); } catch (e) {}
        return nativeConsole[k].apply(console, arguments);
      };
    });

    /* fetch */
    if (window.fetch) {
      var nativeFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        var method = (init && init.method) || (input && input.method) || "GET";
        return nativeFetch(input, init).then(function (res) {
          if (!res.ok) add("SYS", "error", method + " " + url + " -> HTTP " + res.status, undefined, "network");
          return res;
        }, function (err) {
          add("SYS", "error", method + " " + url + " failed: " + stringify(err), undefined, "network");
          throw err;
        });
      };
    }

    /* XMLHttpRequest */
    if (window.XMLHttpRequest) {
      var open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url) {
        this.addEventListener("loadend", function () {
          if (this.status === 0) add("SYS", "error", method + " " + url + " failed (network error)", undefined, "network");
          else if (this.status >= 400) add("SYS", "error", method + " " + url + " -> HTTP " + this.status, undefined, "network");
        });
        return open.apply(this, arguments);
      };
    }

    /* connectivity */
    window.addEventListener("offline", function () { add("SYS", "warn", "Browser went offline", undefined, "network"); });
    window.addEventListener("online", function () { add("SYS", "info", "Browser is back online", undefined, "network"); });

    /* playback data arriving from the Configuration page */
    if ("BroadcastChannel" in window) {
      try {
        var ch = new BroadcastChannel("gnss-playback-channel");
        ch.onmessage = function (ev) {
          var m = ev.data || {};
          if (m.type === "GSV_UPDATED" && m.data) {
            var n = Array.isArray(m.data.satellites) ? m.data.satellites.length : 0;
            add("RX", "info", "GSV update received: " + n + " satellites from " + (m.data.fileName || "playback"), undefined, "rx");
          }
        };
      } catch (e) {}
    }

    window.addEventListener("pagehide", saveNow);
  }

  /* ---------------------------------------------------------
     EXPORT
     --------------------------------------------------------- */
  function visible() {
    return entries.filter(matches);
  }

  function levelLabel(e) {
    return (e.ch === "RX" ? "RX" : "LOG") + "/" + e.lvl.toUpperCase();
  }

  function toText(list) {
    return list.map(function (e) {
      return clock(e.t) + "  " + levelLabel(e) + "  [" + e.src + "]  " + e.msg +
             (e.n > 1 ? "  (x" + e.n + ")" : "") + (e.det ? "\n        " + e.det.replace(/\n/g, "\n        ") : "");
    }).join("\n");
  }

  function csvCell(v) {
    v = String(v).replace(/"/g, '""');
    return '"' + v + '"';
  }

  function toCSV(list) {
    var rows = ["id,time,channel,level,source,count,message,detail"];
    list.forEach(function (e) {
      rows.push([e.id, new Date(e.t).toISOString(), e.ch, e.lvl, e.src, e.n || 1, csvCell(e.msg), csvCell(e.det || "")].join(","));
    });
    return rows.join("\n");
  }

  function exportLog(format) {
    format = format || "txt";
    var list = visible();
    var body, type;
    if (format === "json") {
      body = JSON.stringify({ exported: new Date().toISOString(), page: PAGE, entries: list }, null, 2);
      type = "application/json";
    } else if (format === "csv") {
      body = toCSV(list);
      type = "text/csv";
    } else {
      body = "GPMS Rx • Logging • Error  -  exported " + new Date().toLocaleString() + "\n" +
             new Array(60).join("-") + "\n" + toText(list) + "\n";
      type = "text/plain";
      format = "txt";
    }
    var blob = new Blob([body], { type: type + ";charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gpms-rx-log-" + stamp(Date.now()) + "." + format;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    add("SYS", "info", "Exported " + list.length + " entries as " + format.toUpperCase());
  }

  function copyLog() {
    var text = toText(visible());
    function done() { add("SYS", "info", "Copied " + visible().length + " entries to clipboard"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { add("SYS", "error", "Copy to clipboard failed"); }
      ta.remove();
    }
  }

  function clearLog() {
    entries = []; pausedBuffer = [];
    counts = { rx: 0, log: 0, warn: 0, err: 0 };
    unreadErrors = 0;
    saveNow();
    if (ui) { renderAll(); updateFooter(); updateStatus(); }
    add("SYS", "info", "Log cleared");
  }

  /* ---------------------------------------------------------
     FILTERING
     --------------------------------------------------------- */
  function matches(e) {
    if (filter === "rx" && e.ch !== "RX") return false;
    if (filter === "log" && !(e.ch === "SYS" && e.lvl !== "warn" && e.lvl !== "error")) return false;
    if (filter === "warn" && e.lvl !== "warn") return false;
    if (filter === "error" && e.lvl !== "error") return false;
    if (search) {
      var hay = (e.msg + " " + e.src + " " + e.det).toLowerCase();
      if (hay.indexOf(search) === -1) return false;
    }
    return true;
  }

  /* ---------------------------------------------------------
     UI  -  footer counters + console panel
     --------------------------------------------------------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function button(label, cls, title, onClick) {
    var b = el("button", cls, label);
    b.type = "button";
    if (title) { b.title = title; b.setAttribute("aria-label", title); }
    b.addEventListener("click", onClick);
    return b;
  }

  function buildPanel() {
    var panel = el("section", "rx-panel");
    panel.id = "rxPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Rx, Logging and Error console");
    panel.hidden = true;

    var grip = el("div", "rx-grip");
    grip.title = "Drag to resize";
    panel.appendChild(grip);

    /* ---- header ---- */
    var head = el("div", "rx-head");
    var title = el("div", "rx-title");
    title.appendChild(el("span", "rx-title-dot"));
    title.appendChild(el("strong", "", "Rx • Logging • Error"));
    head.appendChild(title);

    var tabs = el("div", "rx-tabs");
    tabs.setAttribute("role", "tablist");
    var tabDefs = [["all", "All"], ["rx", "RX"], ["log", "Logging"], ["warn", "Warnings"], ["error", "Errors"]];
    var tabButtons = {};
    tabDefs.forEach(function (d) {
      var b = button(d[1], "rx-tab" + (d[0] === "all" ? " is-active" : ""), "Show " + d[1], function () {
        filter = d[0];
        Object.keys(tabButtons).forEach(function (k) { tabButtons[k].classList.toggle("is-active", k === filter); });
        renderAll(); updateStatus();
      });
      b.setAttribute("role", "tab");
      b.dataset.filter = d[0];
      tabs.appendChild(b);
      tabButtons[d[0]] = b;
    });
    head.appendChild(tabs);

    var searchBox = el("input", "rx-search");
    searchBox.type = "search";
    searchBox.placeholder = "Search log…";
    searchBox.setAttribute("aria-label", "Search log");
    searchBox.addEventListener("input", function () {
      search = searchBox.value.trim().toLowerCase();
      renderAll(); updateStatus();
    });
    head.appendChild(searchBox);

    var actions = el("div", "rx-actions");

    var demoWrap = el("label", "rx-check");
    demoWrap.title = "Generate simulated NMEA sentences (1 Hz) to test the log";
    var demo = el("input"); demo.type = "checkbox";
    demo.addEventListener("change", function () { setDemo(demo.checked); });
    demoWrap.appendChild(demo); demoWrap.appendChild(document.createTextNode(" Demo RX"));
    actions.appendChild(demoWrap);

    var scrollWrap = el("label", "rx-check");
    var scroll = el("input"); scroll.type = "checkbox"; scroll.checked = true;
    scroll.addEventListener("change", function () { autoScroll = scroll.checked; if (autoScroll) scrollToEnd(); });
    scrollWrap.appendChild(scroll); scrollWrap.appendChild(document.createTextNode(" Auto-scroll"));
    actions.appendChild(scrollWrap);

    var pauseBtn = button("Pause", "rx-btn", "Pause / resume live logging", function () {
      if (!paused) {
        add("SYS", "info", "Paused - new entries are held until resumed");
        paused = true;
      } else {
        paused = false;
        var held = pausedBuffer; pausedBuffer = [];
        held.forEach(commit);
        add("SYS", "info", "Resumed (" + held.length + " held entries added)");
      }
      pauseBtn.textContent = paused ? "Resume" : "Pause";
      pauseBtn.classList.toggle("is-on", paused);
      updateStatus();
    });
    actions.appendChild(pauseBtn);

    actions.appendChild(button("Copy", "rx-btn", "Copy visible entries to clipboard", copyLog));

    var exp = el("select", "rx-select");
    exp.setAttribute("aria-label", "Export log");
    exp.title = "Export visible entries";
    [["", "Export ▾"], ["txt", "Text (.txt)"], ["csv", "CSV (.csv)"], ["json", "JSON (.json)"]].forEach(function (o) {
      var op = el("option", "", o[1]); op.value = o[0]; exp.appendChild(op);
    });
    exp.addEventListener("change", function () { if (exp.value) exportLog(exp.value); exp.value = ""; });
    actions.appendChild(exp);

    actions.appendChild(button("Clear", "rx-btn rx-btn-danger", "Clear the log", clearLog));
    actions.appendChild(button("✕", "rx-btn rx-close", "Close (Esc)", close));
    head.appendChild(actions);
    panel.appendChild(head);

    /* ---- body ---- */
    var body = el("div", "rx-body");
    body.id = "rxBody";
    body.setAttribute("role", "log");
    body.addEventListener("scroll", function () {
      var atEnd = body.scrollHeight - body.scrollTop - body.clientHeight < 30;
      if (!atEnd && autoScroll) { autoScroll = false; scroll.checked = false; }
    });
    panel.appendChild(body);

    /* ---- status ---- */
    var status = el("div", "rx-status");
    panel.appendChild(status);

    /* ---- drag to resize ---- */
    grip.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      var startY = ev.clientY, startH = panel.offsetHeight;
      grip.setPointerCapture(ev.pointerId);
      function move(e) {
        var h = Math.max(180, Math.min(window.innerHeight * 0.85, startH + (startY - e.clientY)));
        panel.style.height = h + "px";
      }
      function up() {
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", up);
        try { sessionStorage.setItem(HEIGHT_KEY, parseInt(panel.style.height, 10)); } catch (e) {}
      }
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", up);
    });

    try {
      var h = parseInt(sessionStorage.getItem(HEIGHT_KEY), 10);
      if (h >= 180) panel.style.height = h + "px";
    } catch (e) {}

    return { panel: panel, body: body, status: status, demo: demo, tabs: tabButtons, pause: pauseBtn };
  }

  function rowFor(e) {
    var row = el("div", "rx-row rx-" + e.lvl + (e.ch === "RX" ? " rx-is-rx" : ""));
    row.dataset.id = e.id;
    row.appendChild(el("span", "rx-time", clock(e.t)));
    row.appendChild(el("span", "rx-tag", levelLabel(e)));
    row.appendChild(el("span", "rx-src", e.src));
    var msg = el("span", "rx-msg", e.msg);
    row.appendChild(msg);
    if (e.n > 1) row.appendChild(el("span", "rx-repeat", "×" + e.n));
    if (e.det) {
      row.classList.add("has-detail");
      row.tabIndex = 0;
      var det = el("pre", "rx-detail", e.det);
      row.appendChild(det);
      var toggle = function () { row.classList.toggle("is-open"); };
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } });
    }
    return row;
  }

  function scrollToEnd() {
    if (ui) ui.body.scrollTop = ui.body.scrollHeight;
  }

  function appendRow(e) {
    if (!matches(e)) return;
    var empty = ui.body.querySelector(".rx-empty");
    if (empty) empty.remove();
    ui.body.appendChild(rowFor(e));
    if (ui.body.children.length > MAX_ENTRIES) ui.body.removeChild(ui.body.firstChild);
    if (autoScroll) scrollToEnd();
  }

  function renderAll() {
    if (!ui) return;
    ui.body.textContent = "";
    var list = visible();
    if (!list.length) {
      ui.body.appendChild(el("div", "rx-empty", entries.length ? "No entries match the current filter." : "No log entries yet."));
      return;
    }
    var frag = document.createDocumentFragment();
    list.forEach(function (e) { frag.appendChild(rowFor(e)); });
    ui.body.appendChild(frag);
    if (autoScroll) scrollToEnd();
  }

  function updateStatus() {
    if (!ui) return;
    var shown = visible().length;
    ui.status.textContent = shown + " shown / " + entries.length + " stored" +
      (paused ? "  •  PAUSED (" + pausedBuffer.length + " held)" : "") +
      (demoTimer ? "  •  DEMO RX ACTIVE" : "") +
      "  •  page: " + PAGE;
  }

  function updateFooter() {
    if (!ui) return;
    ui.footerEls.forEach(function (node) {
      var k = node.getAttribute("data-rx-count");
      node.textContent = counts[k] > 9999 ? "9999+" : counts[k];
    });
    if (ui.toggle) {
      ui.toggle.classList.toggle("has-error", unreadErrors > 0);
      ui.toggle.classList.toggle("has-warn", unreadErrors === 0 && counts.warn > 0);
      ui.toggle.setAttribute("aria-expanded", panelOpen ? "true" : "false");
    }
  }

  function open() {
    if (!ui) return;
    panelOpen = true;
    unreadErrors = 0;
    ui.panel.hidden = false;
    document.body.classList.add("rx-open");
    renderAll(); updateFooter(); updateStatus();
    scrollToEnd();
  }

  function close() {
    if (!ui) return;
    panelOpen = false;
    ui.panel.hidden = true;
    document.body.classList.remove("rx-open");
    updateFooter();
    if (ui.toggle) ui.toggle.focus({ preventScroll: true });
  }

  function toggle() { panelOpen ? close() : open(); }

  /* ---------------------------------------------------------
     MOUNT  (after DOM is ready)
     --------------------------------------------------------- */
  function mount() {
    var built = buildPanel();
    ui = built;
    document.body.appendChild(built.panel);

    ui.toggle = document.getElementById("rxToggle");
    ui.footerEls = Array.prototype.slice.call(document.querySelectorAll("[data-rx-count]"));
    if (ui.toggle) ui.toggle.addEventListener("click", toggle);

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && panelOpen) close();
      if (ev.altKey && !ev.ctrlKey && !ev.metaKey && (ev.key === "l" || ev.key === "L")) { ev.preventDefault(); toggle(); }
    });

    var wantDemo = false;
    try { wantDemo = sessionStorage.getItem(DEMO_KEY) === "1"; } catch (e) {}
    if (wantDemo) setDemo(true, true);

    updateFooter();
    updateStatus();
  }

  /* ---------------------------------------------------------
     BOOT
     --------------------------------------------------------- */
  restore();
  installCapture();

  add("SYS", "info", "Page opened: " + PAGE + ".html", undefined, "page");

  function ready() {
    mount();
    window.addEventListener("load", function () {
      var ms = Math.round(performance.now());
      add("SYS", "info", "Page loaded in " + ms + " ms", undefined, "page");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();

  /* ---------------------------------------------------------
     PUBLIC API
     --------------------------------------------------------- */
  window.RxLogger = {
    rx: function (m, d) { return add("RX", "info", stringify(m), d, "rx"); },
    info: function (m, d) { return add("SYS", "info", stringify(m), d); },
    debug: function (m, d) { return add("SYS", "debug", stringify(m), d); },
    warn: function (m, d) { return add("SYS", "warn", stringify(m), d); },
    error: function (m, d) { return add("SYS", "error", stringify(m), d); },
    feed: feed,
    analyzeNMEA: analyzeNMEA,
    checksum: nmeaChecksum,
    open: open, close: close, toggle: toggle,
    clear: clearLog,
    export: exportLog,
    startDemo: function () { setDemo(true); },
    stopDemo: function () { setDemo(false); },
    getEntries: function () { return entries.slice(); },
    getCounts: function () { return Object.assign({}, counts); }
  };
})();
