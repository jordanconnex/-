/* ==========================================================================
   SITE-73 · NOYAU
   En-tête, pied de page, horloge, météo, habilitation, niveau d'alerte,
   caviardage, dossiers, recherche globale, carnet de service (distinctions),
   réglages, sons, synthèse vocale, séquence de démarrage et transitions.
   ========================================================================== */
(function () {
  "use strict";

  var S = (window.S73 = window.S73 || {});
  var D = S.data;
  var doc = document;
  var root = doc.documentElement;
  var BUNDLE = !!window.S73_BUNDLE;
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Stockage (toujours protégé) ---------------------------- */
  var store = {
    get: function (k, session) {
      try { return (session ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; }
    },
    set: function (k, v, session) {
      try { (session ? sessionStorage : localStorage).setItem(k, String(v)); return true; } catch (e) { return false; }
    },
    del: function (k, session) {
      try { (session ? sessionStorage : localStorage).removeItem(k); } catch (e) { /* rien */ }
    },
    ok: function (session) {
      try {
        var s = session ? sessionStorage : localStorage;
        s.setItem("s73.t", "1"); s.removeItem("s73.t");
        return true;
      } catch (e) { return false; }
    }
  };
  S.store = store;

  /* ---------- Utilitaires -------------------------------------------- */
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var norm = function (s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  };
  var hash = function (str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  var MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var fmtDate = function (iso) {
    var p = iso.slice(0, 10).split("-");
    return parseInt(p[2], 10) + " " + MOIS[parseInt(p[1], 10) - 1] + " " + p[0];
  };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var count = function (o) { return Object.keys(o || {}).length; };
  var copyText = function (text, okMsg, fallbackEl) {
    var fallback = function () {
      if (fallbackEl) {
        var r = doc.createRange();
        r.selectNodeContents(fallbackEl);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        S.toast("<b>Texte sélectionné.</b> Copie-le avec Ctrl+C (ou appui long sur mobile).");
      } else {
        S.toast("<b>Copie impossible ici.</b> " + esc(text), { duration: 8000 });
      }
    };
    try {
      navigator.clipboard.writeText(text).then(function () { S.toast(okMsg); S.sfx("ok"); }, fallback);
    } catch (e) { fallback(); }
  };
  S.util = { esc: esc, norm: norm, hash: hash, fmtDate: fmtDate, pad: pad, MOIS: MOIS, count: count, copy: copyText };

  /* ---------- Pages ---------------------------------------------------- */
  var PAGES = [
    { id: "accueil",      file: "index",        label: "Accueil",      lieu: "Niveau −1",  groupe: "site",       top: true },
    { id: "confinement",  file: "confinement",  label: "Dossiers",     lieu: "Niveau −5",  groupe: "site",       top: true },
    { id: "plan",         file: "plan",         label: "Plan",         lieu: "0 → −600 m", groupe: "site",       top: true },
    { id: "personnel",    file: "personnel",    label: "Personnel",    lieu: "Niveau −1",  groupe: "site",       top: true },
    { id: "protocoles",   file: "protocoles",   label: "Protocoles",   lieu: "Niveau −4",  groupe: "site" },
    { id: "evenements",   file: "evenements",   label: "Événements",   lieu: "Niveau −1",  groupe: "communaute", top: true },
    { id: "archives",     file: "archives",     label: "Archives",     lieu: "Niveau −7",  groupe: "communaute" },
    { id: "reglement",    file: "reglement",    label: "Règlement",    lieu: "Niveau −1",  groupe: "communaute" },
    { id: "rejoindre",    file: "rejoindre",    label: "Rejoindre",    lieu: "Porte A",    groupe: "communaute", top: true },
    { id: "laboratoire",  file: "laboratoire",  label: "Laboratoire",  lieu: "Niveau −3",  groupe: "outils" },
    { id: "entrainement", file: "entrainement", label: "Entraînement", lieu: "Niveau −4",  groupe: "outils" },
    { id: "terminal",     file: "terminal",     label: "Terminal",     lieu: "Niveau −1",  groupe: "outils" },
    { id: "carnet",       file: "carnet",       label: "Mon carnet",   lieu: "Personnel",  groupe: "outils" },
    { id: "staff",        file: "staff",        label: "Staff",        lieu: "Direction",  groupe: "outils", staff: true }
  ];
  var GROUPES = { site: "Le site", communaute: "Communauté", outils: "Outils" };
  S.pages = PAGES;
  var byFile = {}, byId = {};
  PAGES.forEach(function (p) { byFile[p.file] = p; byId[p.id] = p; });
  var currentPage = (doc.body && doc.body.getAttribute("data-page")) || "accueil";

  /* ---------- Emblème & icônes --------------------------------------- */
  S.emblem = function (cls) {
    var arrows = [0, 120, 240].map(function (a) {
      return '<path transform="rotate(' + a + ' 50 50)" d="M45 1.5H55V16.5H62.5L50 31L37.5 16.5H45Z"/>';
    }).join("");
    return '<svg class="' + (cls || "") + '" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<circle cx="50" cy="50" r="41.5" fill="none" stroke="currentColor" stroke-width="8"/>' +
      '<circle cx="50" cy="50" r="18.5" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<g fill="currentColor" style="stroke: var(--emb-bg, #0C1215)" stroke-width="3.5" paint-order="stroke">' + arrows + "</g></svg>";
  };
  var svgI = function (d, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"' + (extra || "") + ">" + d + "</svg>";
  };
  var ICON = {
    term: svgI('<path d="M4 6l6 6-6 6M12 18h8"/>', ' stroke-linecap="square"'),
    menu: svgI('<path d="M3 7h18M3 12h18M3 17h18"/>'),
    close: svgI('<path d="M5 5l14 14M19 5L5 19"/>'),
    prev: svgI('<path d="M15 5l-7 7 7 7"/>'),
    next: svgI('<path d="M9 5l7 7-7 7"/>'),
    down: svgI('<path d="M6 9l6 6 6-6"/>'),
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 12h17M14 6l6 6-6 6"/></svg>',
    chat: svgI('<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h.01M12 10h.01M15 10h.01" stroke-linecap="round" stroke-width="2.6"/>'),
    search: svgI('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    medal: svgI('<circle cx="12" cy="15" r="6"/><path d="M8.5 10.2L6 3h4l2 5 2-5h4l-2.5 7.2"/>'),
    star: svgI('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
    speak: svgI('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5c1.6 2 1.6 5 0 7M19 6c2.8 3.4 2.8 8.6 0 12"/>'),
    stop: svgI('<rect x="6" y="6" width="12" height="12"/>'),
    link: svgI('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    dice: svgI('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" stroke-linecap="round" stroke-width="3"/>'),
    copy: svgI('<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>')
  };
  S.icon = ICON;

  /* ---------- Réglages ------------------------------------------------- */
  var settings = {
    fx: store.get("s73.fx") !== "off",
    sfx: store.get("s73.sfx") === "on",
    boot: store.get("s73.bootoff") !== "1"
  };
  var applyFx = function () { root.setAttribute("data-fx", settings.fx ? "on" : "off"); };
  S.getSetting = function (k) { return settings[k]; };
  S.setSetting = function (k, v) {
    settings[k] = !!v;
    if (k === "fx") store.set("s73.fx", v ? "on" : "off");
    if (k === "sfx") store.set("s73.sfx", v ? "on" : "off");
    if (k === "boot") { if (v) store.del("s73.bootoff"); else store.set("s73.bootoff", "1"); }
    applyFx();
    doc.dispatchEvent(new CustomEvent("s73:settings", { detail: { key: k, value: !!v } }));
  };
  applyFx();

  /* ---------- Sons ----------------------------------------------------- */
  var actx = null;
  S.audioCtx = function () {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = actx || new AC();
      if (actx.state === "suspended") actx.resume();
      return actx;
    } catch (e) { return null; }
  };
  S.tone = function (freq, dur, opts) {
    opts = opts || {};
    if (!opts.force && !settings.sfx) return;
    var ctx = S.audioCtx();
    if (!ctx) return;
    try {
      var t = ctx.currentTime + (opts.delay || 0);
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = opts.type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
      var vol = opts.vol || 0.05;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) { /* audio indisponible */ }
  };
  S.sfx = function (name) {
    if (!settings.sfx) return;
    switch (name) {
      case "tick": S.tone(1500, 0.03, { vol: 0.015 }); break;
      case "open": S.tone(520, 0.08, { type: "triangle" }); S.tone(780, 0.1, { type: "triangle", delay: 0.07 }); break;
      case "deny": S.tone(140, 0.22, { type: "sawtooth" }); break;
      case "ok": S.tone(660, 0.08, { type: "sine", vol: 0.06 }); S.tone(990, 0.14, { type: "sine", vol: 0.06, delay: 0.08 }); break;
      case "door": S.tone(95, 0.38, { type: "sawtooth", to: 42, vol: 0.06 }); break;
      case "badge": [523, 659, 784, 1047].forEach(function (f, i) { S.tone(f, 0.16, { type: "triangle", vol: 0.05, delay: i * 0.09 }); }); break;
    }
  };

  /* ---------- Synthèse vocale ---------------------------------------- */
  S.canSpeak = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  S.speak = function (text, opts) {
    opts = opts || {};
    if (!S.canSpeak) return false;
    try {
      speechSynthesis.cancel();
      var say = text.replace(/−/g, "moins ").replace(/SCP-/g, "S C P ").replace(/ANO-/g, "A N O ")
        .replace(/\[DONNÉES SUPPRIMÉES\]|\[SUPPRIMÉ\]/g, "données supprimées");
      var u = new SpeechSynthesisUtterance(say);
      u.lang = "fr-FR";
      u.rate = opts.rate || 0.95;
      u.pitch = opts.pitch || 0.9;
      var v = speechSynthesis.getVoices().filter(function (x) { return /^fr/i.test(x.lang); })[0];
      if (v) u.voice = v;
      if (opts.onend) { u.onend = opts.onend; u.onerror = opts.onend; }
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  };
  S.stopSpeak = function () { try { speechSynthesis.cancel(); } catch (e) { /* rien */ } };

  /* ---------- Habilitation ------------------------------------------- */
  var clearance = parseInt(store.get("s73.hab"), 10);
  if (isNaN(clearance) || clearance < 0 || clearance > 5) clearance = D.config.habilitationParDefaut;
  S.getClearance = function () { return clearance; };
  var habName = function (n) { return D.habilitations[n].nom; };
  S.habName = habName;

  /* ---------- Session (connexion Discord) --------------------------- */
  // mode "live" : le site parle à ses fonctions Netlify (/api/…) ;
  // mode "demo" : aperçu sans serveur, profils et niveaux au choix.
  var sess = { mode: "demo", user: null, admin: false, reel: clearance, source: "demo" };
  S.session = function () { return sess; };
  S.isLive = function () { return sess.mode === "live"; };
  S.isAdmin = function () { return !!sess.admin; };
  S.canChooseClearance = function () { return sess.mode === "demo" || sess.admin; };
  S.loginUrl = function () {
    var p = byId[currentPage];
    return "/api/auth/login?retour=" + encodeURIComponent(p && p.id !== "accueil" ? "/" + p.file + ".html" : "/");
  };
  S.avatar = function (u, cls) {
    var ini = String(u && u.nom || "?").replace(/[^A-Za-zÀ-ÿ0-9 ]/g, "").split(/\s+/).filter(Boolean).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase() || "?";
    var bg = u && u.avatar && sess.mode === "live" ? ' style="background-image:url(\'' + String(u.avatar).replace(/['"()\\]/g, "") + '\')"' : "";
    return '<span class="av ' + (cls || "") + '"' + bg + ' aria-hidden="true">' + esc(ini) + "</span>";
  };

  /* ---------- Caviardage ---------------------------------------------- */
  var TOKEN_SRC = /\[\[(\d)\|([\s\S]*?)\]\]|\[(DONNÉES SUPPRIMÉES|SUPPRIMÉ)\]/.source;
  var FILLER = /^[▒\s]+$/;
  var supOnly = function (t) {
    return esc(t).replace(/\[(DONNÉES SUPPRIMÉES|SUPPRIMÉ)\]/g, '<span class="sup">[$1]</span>');
  };
  // lvl permet d'afficher un texte « comme le verrait » un autre niveau (aperçu).
  S.redact = function (text, prev, lvl) {
    if (lvl == null) lvl = clearance;
    var out = "", last = 0, m;
    var re = new RegExp(TOKEN_SRC, "g");
    while ((m = re.exec(text))) {
      out += esc(text.slice(last, m.index));
      if (m[1]) {
        var n = +m[1], inner = m[2];
        if (lvl >= n && !FILLER.test(inner)) {
          var fresh = prev != null && n > prev ? " is-new" : "";
          out += '<span class="rv' + fresh + '" data-lvl="' + n + '" title="Déclassifié · niveau ' + n + '">' + supOnly(inner) + "</span>";
        } else {
          var filler = inner.replace(/\[[^\]]*\]/g, "xxxxxxxx").replace(/\S/g, "x");
          out += '<span class="rd" data-lvl="' + n + '" tabindex="0" role="img" aria-label="Information masquée, niveau ' + n +
            ' requis" title="Niveau ' + n + ' requis">' + filler + "</span>";
        }
      } else {
        out += '<span class="sup">[' + m[3] + "]</span>";
      }
      last = re.lastIndex;
    }
    return out + esc(text.slice(last));
  };
  S.redactPlain = function (text) {
    return text.replace(/\[\[(\d)\|([\s\S]*?)\]\]/g, function (_, n, inner) {
      return clearance >= +n && !FILLER.test(inner) ? inner : "\u0000" + "█".repeat(Math.min(Math.max(inner.length, 6), 42)) + "\u0001";
    });
  };
  S.redactSpeech = function (text) {
    return text.replace(/\[\[(\d)\|([\s\S]*?)\]\]/g, function (_, n, inner) {
      return clearance >= +n && !FILLER.test(inner) ? inner : " Passage censuré. ";
    });
  };
  S.redactInto = function (el, text) {
    el.__raw = text;
    el.setAttribute("data-r", "");
    el.innerHTML = S.redact(text);
  };
  var rerender = function (prev) {
    doc.querySelectorAll("[data-r]").forEach(function (el) {
      if (el.__raw != null) el.innerHTML = S.redact(el.__raw, prev);
    });
  };

  var updateClearanceUI = function () {
    doc.querySelectorAll("[data-hab-num]").forEach(function (el) { el.textContent = clearance; });
    doc.querySelectorAll("[data-hab-name]").forEach(function (el) { el.textContent = "Niveau " + clearance + " · " + habName(clearance); });
    doc.querySelectorAll(".clr__opt").forEach(function (b) {
      b.setAttribute("aria-checked", String(+b.getAttribute("data-lvl") === clearance));
    });
  };

  S.setClearance = function (n, opts) {
    n = Math.max(0, Math.min(5, parseInt(n, 10)));
    if (isNaN(n)) return;
    if (!S.canChooseClearance()) {
      S.toast("<b>Habilitation attribuée par l'administration.</b> " + (sess.user ? "Demande au staff du serveur pour évoluer." : "Connecte-toi avec Discord pour recevoir la tienne."), { warn: true });
      return;
    }
    if (sess.mode === "live") {
      n = Math.min(n, sess.reel);
      store.set("s73.voir", n, true);
    } else {
      store.set("s73.hab", n);
      sess.reel = n;
    }
    var prev = clearance;
    clearance = n;
    updateClearanceUI();
    rerender(prev);
    doc.dispatchEvent(new CustomEvent("s73:clearance", { detail: { level: n, prev: prev } }));
    if (!(opts && opts.silent)) {
      var diff = n > prev ? "Informations déclassifiées." : n < prev ? "Informations reclassifiées." : "Aucun changement.";
      S.toast("<b>" + (sess.mode === "live" ? "Aperçu comme niveau " : "Habilitation · niveau ") + n + "</b> " + esc(habName(n)) + ". " + diff);
    }
    renderClrPop();
    S.sfx("ok");
    checkBadges();
  };

  doc.addEventListener("click", function (e) {
    var bar = e.target.closest(".rd");
    if (bar && !bar.closest("[data-no-deny]")) denied(bar);
  });
  doc.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("rd")) {
      e.preventDefault();
      denied(e.target);
    }
  });
  function denied(bar) {
    bar.classList.remove("is-denied");
    void bar.offsetWidth;
    bar.classList.add("is-denied");
    S.sfx("deny");
    var lvl = bar.getAttribute("data-lvl");
    var fin = S.canChooseClearance() ? " Modifiez-la avec le bouton « Hab. » en haut de page."
      : sess.user ? " Seul le staff du serveur peut relever votre habilitation."
      : ' <a class="link" href="' + S.loginUrl() + '">Connectez-vous avec Discord</a> pour recevoir la vôtre.';
    S.toast("<b>Accès refusé.</b> Niveau " + lvl + " requis, votre habilitation est de niveau " + clearance + "." + fin, { warn: true, duration: 6000 });
  }

  /* ---------- Niveau d'alerte ---------------------------------------- */
  var ALERTS = ["vert", "jaune", "orange", "rouge", "noir"];
  var alertLevel = store.get("s73.alerte", true);
  if (ALERTS.indexOf(alertLevel) < 0) alertLevel = D.config.alerte;
  S.alerts = ALERTS;
  S.getAlert = function () { return alertLevel; };
  S.officialAlert = function () { return D.config.alerte; };
  var applyAlert = function () {
    root.setAttribute("data-alert", alertLevel);
    var a = D.alertes[alertLevel];
    doc.querySelectorAll("[data-alert-code]").forEach(function (el) { el.textContent = a.code; });
    doc.querySelectorAll("[data-alert-title]").forEach(function (el) { el.textContent = a.titre; });
    doc.querySelectorAll("[data-alert-text]").forEach(function (el) { el.textContent = a.texte; });
  };
  S.setAlert = function (level, opts) {
    if (ALERTS.indexOf(level) < 0) return;
    alertLevel = level;
    if (!opts || opts.persist !== false) {
      if (level === D.config.alerte) store.del("s73.alerte", true);
      else store.set("s73.alerte", level, true);
    }
    applyAlert();
    doc.dispatchEvent(new CustomEvent("s73:alert", { detail: { level: level } }));
  };

  /* ---------- Notifications ------------------------------------------ */
  var toastZone;
  S.toast = function (html, opts) {
    opts = opts || {};
    if (!toastZone) {
      toastZone = doc.createElement("div");
      toastZone.className = "toast-zone";
      toastZone.setAttribute("role", "status");
      toastZone.setAttribute("aria-live", "polite");
      doc.body.appendChild(toastZone);
    }
    var t = doc.createElement("div");
    t.className = "toast" + (opts.warn ? " toast--warn" : "") + (opts.medal ? " toast--medal" : "");
    t.innerHTML = (opts.medal ? '<span class="toast__medal">' + esc(opts.medal) + "</span>" : "") + "<span>" + html + "</span>";
    toastZone.appendChild(t);
    while (toastZone.children.length > 3) toastZone.removeChild(toastZone.firstChild);
    setTimeout(function () {
      t.classList.add("is-out");
      setTimeout(function () { t.remove(); }, 320);
    }, opts.duration || (opts.medal ? 5200 : 4200));
  };

  /* ---------- Carnet de service --------------------------------------- */
  var blankCarnet = function () { return { badges: {}, seen: {}, pages: {}, fav: {}, rules: {}, planning: {}, stats: {}, flags: {} }; };
  var carnet = blankCarnet();
  try {
    var raw = JSON.parse(store.get("s73.carnet") || "null");
    if (raw && typeof raw === "object") {
      Object.keys(carnet).forEach(function (k) { if (raw[k] && typeof raw[k] === "object") carnet[k] = raw[k]; });
    }
  } catch (e) { /* carnet illisible : on repart de zéro */ }
  var saveCarnet = function () { store.set("s73.carnet", JSON.stringify(carnet)); };
  var badgeReady = false;
  var RULES = {
    arrivee: function () { return true; },
    lecteur: function (c) { return count(c.seen) >= 5; },
    archiviste: function (c) { return D.scp.every(function (s) { return c.seen[s.id]; }); },
    favoris: function (c) { return count(c.fav) >= 3; },
    visite: function (c) { return PAGES.every(function (p) { return (p.staff && !sess.admin) || c.pages[p.id]; }); },
    thaumiel: function () { return clearance === 5; },
    reglement: function (c) { return D.reglement.every(function (ch) { return c.rules[ch.id]; }); },
    apte: function (c) { return (c.stats.exam || 0) >= D.quiz.length - 1; },
    sansfaute: function (c) { return (c.stats.exam || 0) >= D.quiz.length; },
    evacuation: function (c) { return (c.stats.breach || 0) >= 1; },
    itineraire: function (c) { return (c.stats.route || 0) >= 1; },
    horloger: function (c) { return (c.stats.x914 || 0) >= 5; },
    tresfin: function (c) { return !!c.flags.tresfin; },
    radio: function (c) { return (c.stats.pa || 0) >= 1; },
    redacteur: function (c) { return (c.stats.copies || 0) >= 1; },
    planning: function (c) { return count(c.planning) >= 1; },
    contact: function (c) { return (c.stats.s173 || 0) >= 1; },
    verrouillage: function (c) { return (c.stats.simon || 0) >= 8; },
    nuit: function (c) { return !!c.flags.nuit; },
    pirate: function (c) { return !!c.flags.pirate; },
    omega: function (c) { return !!c.flags.omega; }
  };
  var updateBadgeCount = function () {
    var n = count(carnet.badges);
    doc.querySelectorAll("[data-badge-count]").forEach(function (el) { el.textContent = n; });
    doc.querySelectorAll("[data-badge-total]").forEach(function (el) { el.textContent = D.distinctions.length; });
    doc.querySelectorAll(".carnet-btn").forEach(function (el) {
      el.setAttribute("aria-label", "Mon carnet de service : " + n + " distinction" + (n > 1 ? "s" : "") + " sur " + D.distinctions.length);
    });
  };
  var checkBadges = function () {
    if (!badgeReady) return;
    var fresh = [];
    D.distinctions.forEach(function (b) {
      if (!carnet.badges[b.id] && RULES[b.id] && RULES[b.id](carnet)) {
        carnet.badges[b.id] = Date.now();
        fresh.push(b);
      }
    });
    if (!fresh.length) return;
    saveCarnet();
    updateBadgeCount();
    fresh.forEach(function (b, i) {
      setTimeout(function () {
        S.toast("<b>Distinction obtenue · " + esc(b.nom) + "</b> " + esc(b.texte), { medal: b.code });
        S.sfx("badge");
      }, i * 900);
    });
    doc.dispatchEvent(new CustomEvent("s73:carnet"));
  };
  var changed = function () { saveCarnet(); checkBadges(); doc.dispatchEvent(new CustomEvent("s73:carnet")); };
  S.carnet = function () { return carnet; };
  S.isMarked = function (set, id) { return !!(carnet[set] && carnet[set][id]); };
  S.mark = function (set, id, on) {
    if (!carnet[set]) carnet[set] = {};
    if (on === false) delete carnet[set][id]; else carnet[set][id] = carnet[set][id] || Date.now();
    changed();
  };
  S.stat = function (name, val, mode) {
    var cur = carnet.stats[name] || 0;
    carnet.stats[name] = mode === "max" ? Math.max(cur, val) : cur + (val == null ? 1 : val);
    changed();
  };
  S.flag = function (name) { carnet.flags[name] = true; changed(); };
  S.resetCarnet = function () {
    carnet = blankCarnet();
    carnet.pages[currentPage] = Date.now();
    saveCarnet();
    updateBadgeCount();
    doc.dispatchEvent(new CustomEvent("s73:carnet"));
  };

  /* ---------- Météo du col (déterministe, change chaque heure) ------- */
  S.meteo = function (date) {
    var d = date || new Date();
    var h = hash("meteo-" + d.toISOString().slice(0, 13));
    var m = d.getMonth();
    var base = [-9, -8, -6, -3, 1, 5, 8, 8, 5, 1, -4, -7][m];
    var temp = base + (h % 9) - 4;
    var ciels = ["Dégagé", "Voilé", "Nuageux", "Brouillard", temp > 1 ? "Pluie" : "Neige"];
    var hiver = m >= 10 || m <= 3;
    return {
      temp: temp,
      vent: 8 + ((h >>> 4) % 55),
      ciel: ciels[(h >>> 12) % 5],
      visi: [">10 km", "6 km", "2 km", "800 m", "150 m"][(h >>> 9) % 5],
      avalanche: 1 + ((h >>> 15) % (hiver ? 5 : 2))
    };
  };
  var meteoTxt = function () {
    var w = S.meteo();
    return "Surface " + (w.temp > 0 ? "+" : "") + w.temp + " °C · vent " + w.vent + " km/h · " + w.ciel.toLowerCase();
  };

  /* ---------- En-tête -------------------------------------------------- */
  var linkFor = function (p, cls, withLieu) {
    return '<a class="' + cls + '" href="' + p.file + '.html" data-nav="' + p.id + '"' + (p.staff ? " data-staff-only hidden" : "") + ">" +
      (withLieu ? "<b>" + esc(p.label) + "</b><small>" + esc(p.lieu) + "</small>" : esc(p.label)) + "</a>";
  };
  var buildHeader = function () {
    var slot = doc.getElementById("s73-header");
    if (!slot) return;
    var top = PAGES.filter(function (p) { return p.top; }).map(function (p) { return linkFor(p, "nav__link"); }).join("");
    var more = Object.keys(GROUPES).map(function (g) {
      var list = PAGES.filter(function (p) { return !p.top && p.groupe === g; });
      if (!list.length) return "";
      return '<div class="more__grp"><p>' + GROUPES[g] + "</p>" + list.map(function (p) { return linkFor(p, "more__link", true); }).join("") + "</div>";
    }).join("");
    var drawer = Object.keys(GROUPES).map(function (g) {
      return '<p class="drawer__grp">' + GROUPES[g] + "</p>" + PAGES.filter(function (p) { return p.groupe === g; }).map(function (p) {
        return '<a href="' + p.file + '.html" data-nav="' + p.id + '"' + (p.staff ? " data-staff-only hidden" : "") + ">" + esc(p.label) + "<small>" + esc(p.lieu) + "</small></a>";
      }).join("");
    }).join("");

    slot.outerHTML =
      '<div class="sysbar"><div class="wrap sysbar__in">' +
        '<div class="sysbar__group"><span>Fondation SCP · Réseau sécurisé</span></div>' +
        '<div class="sysbar__group sysbar__group--wide"><span data-meteo>' + esc(meteoTxt()) + '</span><span>Liaison chiffrée<i class="dot"></i></span></div>' +
        '<div class="sysbar__group"><span>Heure du site <b data-clock>--:--:--</b></span></div>' +
      "</div></div>" +
      '<div class="bar-sticky"><header class="bar"><div class="wrap bar__in">' +
        '<a class="brand" href="index.html" aria-label="Site-73, accueil">' + S.emblem() +
          '<span class="brand__txt"><span class="brand__name">SITE<i>-</i>73</span><span class="brand__sub">Intranet · Fondation SCP</span></span></a>' +
        '<nav class="nav" aria-label="Navigation principale">' + top +
          '<div class="more"><button type="button" class="nav__link more__btn" id="more-btn" aria-expanded="false" aria-controls="more-pop">Plus' + ICON.down + "</button>" +
          '<div class="more__pop" id="more-pop" hidden>' + more + "</div></div>" +
        "</nav>" +
        '<div class="bar__tools">' +
          '<button type="button" class="icon-btn" id="search-btn" aria-label="Rechercher sur l\'intranet (Ctrl+K)" title="Rechercher · Ctrl+K">' + ICON.search + "</button>" +
          '<a class="alert-chip" href="index.html#statut" title="Niveau d\'alerte du site"><i></i><span data-alert-code></span></a>' +
          '<div class="clr">' +
            '<button type="button" class="clr__btn" id="clr-btn" aria-haspopup="true" aria-expanded="false" aria-controls="clr-pop" title="Votre niveau d\'habilitation">' +
              '<span class="clr__lbl">Hab.</span><b data-hab-num></b></button>' +
            '<div class="clr__pop" id="clr-pop" hidden></div>' +
          "</div>" +
          '<a class="icon-btn carnet-btn" href="carnet.html" data-nav="carnet" title="Mon carnet de service">' + ICON.medal + '<span class="count" data-badge-count>0</span></a>' +
          '<button type="button" class="icon-btn menu-btn" id="menu-btn" aria-expanded="false" aria-controls="drawer" aria-label="Ouvrir le menu">' + ICON.menu + "</button>" +
        "</div>" +
      '</div></header><div class="hazard" aria-hidden="true"></div></div>' +
      '<div class="drawer" id="drawer" hidden role="dialog" aria-modal="true" aria-label="Menu">' +
        '<div class="drawer__head wrap"><a class="brand" href="index.html">' + S.emblem() + '<span class="brand__txt"><span class="brand__name">SITE<i>-</i>73</span></span></a>' +
        '<button type="button" class="icon-btn" id="drawer-close" aria-label="Fermer le menu">' + ICON.close + "</button></div>" +
        '<nav class="drawer__nav" aria-label="Navigation">' + drawer + "</nav>" +
      "</div>";

    // Menu « Plus »
    var mb2 = doc.getElementById("more-btn"), mp = doc.getElementById("more-pop");
    var closeMore = function () { mp.hidden = true; mb2.setAttribute("aria-expanded", "false"); };
    mb2.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = mp.hidden;
      mp.hidden = !open;
      mb2.setAttribute("aria-expanded", String(open));
    });
    mp.addEventListener("click", function (e) { if (e.target.closest("a")) closeMore(); });
    doc.addEventListener("click", function (e) { if (!mp.hidden && !e.target.closest(".more")) closeMore(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !mp.hidden) { closeMore(); mb2.focus(); } });

    // Habilitation
    var btn = doc.getElementById("clr-btn"), pop = doc.getElementById("clr-pop");
    var closePop = function () { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    S.openClearance = function () {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      pop.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      var cur = pop.querySelector('[aria-checked="true"]');
      if (cur) cur.focus({ preventScroll: true });
    };
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (pop.hidden) S.openClearance(); else closePop();
    });
    pop.addEventListener("click", function (e) {
      var pr = e.target.closest("[data-profil]");
      if (pr) { S.setDemoProfil(pr.getAttribute("data-profil")); return; }
      var o = e.target.closest(".clr__opt");
      if (!o) return;
      S.setClearance(o.getAttribute("data-lvl"));
      closePop();
      btn.focus();
    });
    doc.addEventListener("click", function (e) { if (!pop.hidden && !e.target.closest(".clr") && !e.target.closest("[data-open-hab]")) closePop(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pop.hidden) { closePop(); btn.focus(); } });

    // Recherche
    doc.getElementById("search-btn").addEventListener("click", function () { S.openSearch(); });

    // Menu mobile
    var drawerEl = doc.getElementById("drawer"), mb = doc.getElementById("menu-btn");
    var openDrawer = function () { drawerEl.hidden = false; mb.setAttribute("aria-expanded", "true"); doc.body.style.overflow = "hidden"; doc.getElementById("drawer-close").focus(); };
    S.closeDrawer = function () { if (drawerEl.hidden) return; drawerEl.hidden = true; mb.setAttribute("aria-expanded", "false"); doc.body.style.overflow = ""; };
    mb.addEventListener("click", openDrawer);
    doc.getElementById("drawer-close").addEventListener("click", function () { S.closeDrawer(); mb.focus(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !drawerEl.hidden) { S.closeDrawer(); mb.focus(); } });
  };

  var levelsHtml = function (max) {
    return '<ul class="clr__list" role="menu" aria-label="Choisir un niveau">' + D.habilitations.filter(function (h) { return h.niveau <= max; }).map(function (h) {
      return '<li><button type="button" class="clr__opt" role="menuitemradio" data-lvl="' + h.niveau + '" aria-checked="' + (h.niveau === clearance) + '">' +
        "<b>" + h.niveau + "</b><span>" + esc(h.nom) + "</span><small>" + (h.niveau === 5 ? "O5" : "N" + h.niveau) + "</small></button></li>";
    }).join("") + "</ul>";
  };
  var SOURCES = {
    role: "Attribuée par tes rôles sur le serveur Discord.",
    staff: "Attribuée par l'administration du site.",
    defaut: "Niveau par défaut des membres. Le staff peut le relever.",
    admin: "Administrateur : accès complet."
  };
  function renderClrPop() {
    var pop = doc.getElementById("clr-pop"), btn = doc.getElementById("clr-btn");
    if (!pop) return;
    var who = sess.user ? '<div class="who">' + S.avatar(sess.user) + "<div><b>" + esc(sess.user.nom) + "</b><small>" +
      (sess.admin ? "Administrateur" : "Membre du serveur") + (sess.mode === "demo" ? " · démo" : "") + "</small></div></div>" : "";
    var out = "";
    if (sess.mode === "demo") {
      var profil = store.get("s73.demo.profil") || "membre";
      out = '<p class="clr__demo">Mode démonstration</p>' +
        "<p>En ligne, chacun se connecte avec Discord et reçoit l'habilitation donnée par le staff. Ici, choisis un profil pour tester.</p>" +
        '<div class="seg clr__profils" role="radiogroup" aria-label="Profil de démonstration">' + [["visiteur", "Visiteur"], ["membre", "Membre"], ["admin", "Admin"]].map(function (x) {
          return '<button type="button" role="radio" data-profil="' + x[0] + '" aria-checked="' + (profil === x[0]) + '" style="--c: var(--signal)">' + x[1] + "</button>";
        }).join("") + "</div>" +
        (profil === "visiteur" ? "" : '<p class="label">Niveau d\'habilitation</p>' + levelsHtml(5)) +
        (sess.admin ? '<div class="clr__acts"><a class="btn btn--sm" href="staff.html">Espace staff</a></div>' : "");
    } else if (!sess.user) {
      out = "<p><b>Visiteur · niveau 0</b><br>Connecte-toi avec ton compte Discord : l'administration du serveur t'attribue ton habilitation.</p>" +
        '<a class="btn btn--signal clr__login" href="' + S.loginUrl() + '">' + ICON.chat + "Se connecter avec Discord</a>";
    } else if (sess.admin) {
      out = who + "<p>Tu as accès à tout. Prévisualise le site comme un membre d'un autre niveau :</p>" + levelsHtml(sess.reel) +
        '<div class="clr__acts"><a class="btn btn--sm btn--signal" href="staff.html">Espace staff</a><a class="btn btn--sm" href="/api/auth/logout">Se déconnecter</a></div>';
    } else {
      out = who + "<p><b>Habilitation · niveau " + sess.reel + " · " + esc(habName(sess.reel)) + "</b><br>" + esc(SOURCES[sess.source] || SOURCES.defaut) + "</p>" +
        '<div class="clr__acts"><a class="btn btn--sm" href="carnet.html">Mon carnet</a><a class="btn btn--sm" href="/api/auth/logout">Se déconnecter</a></div>';
    }
    pop.innerHTML = out;
    if (btn) btn.innerHTML = (sess.user ? S.avatar(sess.user, "av--sm") : "") + '<span class="clr__lbl">Hab.</span><b data-hab-num>' + clearance + "</b>";
  }
  S.renderClrPop = renderClrPop;

  var markNav = function (id) {
    doc.querySelectorAll("[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    var mb = doc.getElementById("more-btn");
    if (mb) mb.classList.toggle("is-current", !!byId[id] && !byId[id].top);
  };

  /* ---------- Pied de page ------------------------------------------- */
  var buildFooter = function () {
    var slot = doc.getElementById("s73-footer");
    if (!slot) return;
    var cols = Object.keys(GROUPES).map(function (g) {
      return "<div><h2>" + GROUPES[g] + '</h2><ul class="ftr__links">' + PAGES.filter(function (p) { return p.groupe === g; }).map(function (p) {
        return "<li" + (p.staff ? " data-staff-only hidden" : "") + '><a href="' + p.file + '.html">' + esc(p.label) + "</a></li>";
      }).join("") + "</ul></div>";
    }).join("");
    slot.outerHTML =
      '<footer class="ftr">' + S.emblem("ftr__mark") +
      '<div class="wrap ftr__in">' +
        '<div class="ftr__brand"><a class="brand" href="index.html">' + S.emblem() +
          '<span class="brand__txt"><span class="brand__name">SITE<i>-</i>73</span><span class="brand__sub">Installation de confinement alpine</span></span></a>' +
          "<p>Serveur de jeu de rôle communautaire dans l'univers de la Fondation SCP. Chercheurs, gardes, FIM et Classe-D : le site recrute.</p>" +
          '<ul class="ftr__links ftr__ext">' +
            '<li><a data-discord-link href="rejoindre.html">Discord du Site-73</a></li>' +
            '<li><a href="https://scp-wiki.wikidot.com/" target="_blank" rel="noopener">Wiki SCP (anglais)</a></li>' +
            '<li><a href="http://fondationscp.wikidot.com/" target="_blank" rel="noopener">Wiki SCP francophone</a></li>' +
          "</ul>" +
          '<p class="ftr__keys">Astuce : <kbd>Ctrl</kbd> + <kbd>K</kbd> pour rechercher partout.</p></div>' +
        cols +
      "</div>" +
      '<div class="wrap ftr__legal">' +
        "<span>Projet de fans, non affilié au Wiki SCP. Contenus inspirés de la Fondation SCP (<a href=\"https://scp-wiki.wikidot.com/licensing-guide\" target=\"_blank\" rel=\"noopener\">scp-wiki.wikidot.com</a>), sous licence CC BY-SA 3.0.</span>" +
        '<span class="ftr__motto">Sécuriser · Contenir · Protéger · v' + esc(D.config.version) + "</span>" +
      "</div></footer>";
  };

  /* ---------- Discord ------------------------------------------------- */
  var applyDiscord = function (scope) {
    var url = D.config.discord;
    (scope || doc).querySelectorAll("[data-discord]").forEach(function (el) {
      if (url) {
        el.setAttribute("href", url);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      } else {
        var span = doc.createElement("span");
        span.className = el.className;
        span.setAttribute("aria-disabled", "true");
        span.style.opacity = ".6";
        span.style.cursor = "not-allowed";
        span.title = "Le lien d'invitation sera bientôt ajouté.";
        span.innerHTML = ICON.chat + "<span>Discord · lien bientôt disponible</span>";
        el.replaceWith(span);
      }
    });
    (scope || doc).querySelectorAll("[data-discord-link]").forEach(function (a) {
      if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener"; }
    });
  };
  S.applyDiscord = applyDiscord;

  /* ---------- Horloge -------------------------------------------------- */
  var clockFmt, dateFmt, hourFmt;
  try {
    clockFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: D.config.fuseau, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: D.config.fuseau, weekday: "long", day: "numeric", month: "long", year: "numeric" });
    hourFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: D.config.fuseau, hour: "numeric", hour12: false });
  } catch (e) {
    clockFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    dateFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    hourFmt = new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false });
  }
  var lastMeteoHour = -1;
  var tick = function () {
    var now = new Date();
    var t = clockFmt.format(now), d = dateFmt.format(now);
    doc.querySelectorAll("[data-clock]").forEach(function (el) { el.textContent = t; });
    doc.querySelectorAll("[data-date]").forEach(function (el) { el.textContent = d; });
    if (now.getHours() !== lastMeteoHour) {
      lastMeteoHour = now.getHours();
      var mt = meteoTxt();
      doc.querySelectorAll("[data-meteo]").forEach(function (el) { el.textContent = mt; });
    }
    doc.dispatchEvent(new CustomEvent("s73:tick", { detail: { now: now } }));
  };
  S.formatClock = function (d) { return clockFmt.format(d); };
  S.siteHour = function (d) { return parseInt(hourFmt.format(d || new Date()), 10) % 24; };
  S.formatCountdown = function (ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var j = Math.floor(s / 86400); s -= j * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    return j + " j " + pad(h) + ":" + pad(m) + ":" + pad(s);
  };

  /* ---------- Dossier (fenêtre papier) ------------------------------ */
  var modal, modalList = [], modalIndex = 0, lastFocus = null, speaking = false;
  var scpById = {};
  D.scp.forEach(function (s) { scpById[s.id] = s; });
  var zoneById = {};
  D.zones.forEach(function (z) { zoneById[z.id] = z; });
  S.scpById = scpById;
  S.zoneById = zoneById;
  S.findScp = function (q) {
    q = norm(q).replace(/^scp[-\s]?/, "").trim();
    if (!q) return null;
    if (scpById[q]) return scpById[q];
    var num = q.replace(/^0+/, "");
    for (var i = 0; i < D.scp.length; i++) {
      var s = D.scp[i];
      if (s.id.replace(/^0+/, "") === num) return s;
      if (norm(s.code) === q || norm(s.code).replace(/^ano-/, "") === q) return s;
    }
    return null;
  };
  S.randomDossier = function () {
    var s = D.scp[Math.floor(Math.random() * D.scp.length)];
    S.openDossier(s.id);
  };

  var MENACE = ["", "Minime", "Faible", "Modérée", "Élevée", "Extrême"];
  S.menaceLabel = function (n) { return MENACE[n]; };
  var STAMPS = ["Usage officiel", "Confidentiel", "Restreint", "Secret", "Très secret", "Thaumiel"];
  S.stamps = STAMPS;

  var buildModal = function () {
    modal = doc.createElement("div");
    modal.className = "modal";
    modal.id = "dossier";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "dossier-title");
    modal.innerHTML =
      '<div class="modal__backdrop" data-close></div>' +
      '<div class="modal__frame">' +
        '<div class="modal__nav"><div class="grp">' +
          '<button type="button" class="icon-btn" data-prev aria-label="Dossier précédent">' + ICON.prev + "</button>" +
          '<button type="button" class="icon-btn" data-next aria-label="Dossier suivant">' + ICON.next + "</button>" +
          '<span class="label" data-pos></span></div>' +
          '<div class="grp">' +
          '<button type="button" class="icon-btn" data-fav aria-pressed="false" aria-label="Suivre ce dossier" title="Suivre ce dossier">' + ICON.star + "</button>" +
          (S.canSpeak ? '<button type="button" class="icon-btn" data-speak aria-label="Lire le dossier à voix haute" title="Lire à voix haute">' + ICON.speak + "</button>" : "") +
          '<button type="button" class="icon-btn" data-link aria-label="Copier le lien du dossier" title="Copier le lien">' + ICON.link + "</button>" +
          '<button type="button" class="icon-btn" data-close aria-label="Fermer le dossier">' + ICON.close + "</button></div>" +
        "</div>" +
        '<div class="modal__scroll"><article class="doc paper" data-doc></article></div>' +
      "</div>";
    doc.body.appendChild(modal);
    modal.addEventListener("click", function (e) {
      var id = modalList[modalIndex];
      if (e.target.closest("[data-close]")) S.closeDossier();
      else if (e.target.closest("[data-prev]")) step(-1);
      else if (e.target.closest("[data-next]")) step(1);
      else if (e.target.closest("[data-fav]")) {
        var on = !S.isMarked("fav", id);
        S.mark("fav", id, on);
        syncFav();
        S.toast(on ? "<b>Dossier suivi.</b> Retrouve-le avec le filtre « Suivis »." : "<b>Dossier retiré</b> de ta liste de suivi.");
      }
      else if (e.target.closest("[data-speak]")) toggleSpeak();
      else if (e.target.closest("[data-link]")) {
        var url = BUNDLE ? location.href.split("#")[0] + "#scp-" + id : new URL("confinement.html#scp-" + id, location.href).href;
        copyText(url, "<b>Lien copié.</b> " + esc(scpById[id].code));
      }
      else if (e.target.closest("[data-open-hab]")) { S.closeDossier(); if (S.openClearance) S.openClearance(); }
    });
    modal.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); S.closeDossier(); }
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Tab") {
        var f = modal.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  };
  var syncFav = function () {
    var b = modal.querySelector("[data-fav]");
    var on = S.isMarked("fav", modalList[modalIndex]);
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("is-on", on);
  };
  var stopSpeaking = function () {
    speaking = false;
    S.stopSpeak();
    var b = modal && modal.querySelector("[data-speak]");
    if (b) { b.innerHTML = ICON.speak; b.classList.remove("is-on"); b.setAttribute("aria-label", "Lire le dossier à voix haute"); }
  };
  var toggleSpeak = function () {
    if (speaking) { stopSpeaking(); return; }
    var s = scpById[modalList[modalIndex]];
    var txt = "Objet numéro " + s.code + ", " + s.nom + ". Classe " + D.classesObjet[s.classe].nom + ". " +
      "Procédures de confinement spéciales. " + S.redactSpeech(s.procedures) + " Description. " + S.redactSpeech(s.description);
    speaking = S.speak(txt, { onend: stopSpeaking });
    if (speaking) {
      var b = modal.querySelector("[data-speak]");
      b.innerHTML = ICON.stop;
      b.classList.add("is-on");
      b.setAttribute("aria-label", "Arrêter la lecture");
    }
  };
  var step = function (d) {
    if (modalList.length < 2) return;
    stopSpeaking();
    modalIndex = (modalIndex + d + modalList.length) % modalList.length;
    renderDossier();
    modal.querySelector(".modal__scroll").scrollTop = 0;
  };
  var renderDossier = function () {
    var s = scpById[modalList[modalIndex]];
    if (!S.isMarked("seen", s.id)) S.mark("seen", s.id, true);
    var cls = D.classesObjet[s.classe];
    var z = zoneById[s.zone];
    var meter = "";
    for (var i = 1; i <= 5; i++) meter += i <= s.menace ? "■" : "□";
    var art = modal.querySelector("[data-doc]");
    art.style.setProperty("--c", "var(--c-" + s.classe + ")");
    art.innerHTML =
      '<header class="doc__head"><div class="doc__org">' + S.emblem() +
        "<span>Fondation SCP · Site-73<small>Registre des anomalies · document interne</small></span></div>" +
        '<div class="doc__stamp">' + esc(STAMPS[s.niveau]) + "<br>Niveau " + s.niveau + "</div></header>" +
      '<h2 class="doc__title" id="dossier-title"><small>Objet n°</small>' + esc(s.code) + "</h2>" +
      '<p class="doc__name">« ' + esc(s.nom) + " »</p>" +
      '<dl class="doc__fields">' +
        '<div><dt>Classe</dt><dd><span class="doc__class">' + esc(cls.nom) + "</span></dd></div>" +
        "<div><dt>Statut</dt><dd>" + esc(s.statut) + "</dd></div>" +
        "<div><dt>Localisation</dt><dd>" + (z ? esc(z.niveau + " · " + z.nom) : "—") + "</dd></div>" +
        '<div><dt>Niveau de menace</dt><dd><span class="doc__menace" aria-hidden="true">' + meter + "</span> " + esc(MENACE[s.menace]) + "</dd></div>" +
      "</dl>" +
      "<section><h3>Procédures de confinement spéciales</h3><p data-part=\"proc\"></p></section>" +
      "<section><h3>Description</h3><p data-part=\"desc\"></p></section>" +
      '<footer class="doc__foot"><span>Consulté avec une habilitation de niveau <b>' + clearance + "</b> (" + esc(habName(clearance)) + ")." +
        (clearance < 4 ? " Certaines informations restent masquées." : "") + "</span>" +
        (S.canChooseClearance() ? '<button type="button" data-open-hab>Changer d\'habilitation</button>'
          : sess.user ? "<span>Habilitation attribuée par l'administration.</span>"
          : '<a href="' + S.loginUrl() + '">Se connecter avec Discord</a>') + "</footer>";
    S.redactInto(art.querySelector('[data-part="proc"]'), s.procedures);
    S.redactInto(art.querySelector('[data-part="desc"]'), s.description);
    modal.querySelector("[data-pos]").textContent = (modalIndex + 1) + " / " + modalList.length;
    modal.querySelector("[data-prev]").disabled = modalList.length < 2;
    modal.querySelector("[data-next]").disabled = modalList.length < 2;
    syncFav();
  };
  S.openDossier = function (id, list) {
    if (!scpById[id]) return;
    if (!modal) buildModal();
    modalList = list && list.length ? list.slice() : D.scp.map(function (s) { return s.id; });
    modalIndex = modalList.indexOf(id);
    if (modalIndex < 0) { modalList.unshift(id); modalIndex = 0; }
    if (modal.hidden) lastFocus = doc.activeElement;
    renderDossier();
    modal.hidden = false;
    doc.body.style.overflow = "hidden";
    modal.querySelector(".modal__scroll").scrollTop = 0;
    modal.querySelector("[data-close].icon-btn").focus();
    S.sfx("open");
  };
  S.closeDossier = function () {
    if (!modal || modal.hidden) return;
    stopSpeaking();
    modal.hidden = true;
    doc.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  doc.addEventListener("s73:clearance", function () {
    if (modal && !modal.hidden) renderDossier();
  });

  /* ---------- Recherche globale (Ctrl+K) ---------------------------- */
  var palette, pIndex = null, pResults = [], pSel = 0;
  var buildIndex = function () {
    var ix = [];
    var add = function (type, title, sub, run, extra) {
      ix.push({ type: type, title: title, sub: sub || "", run: run, hay: norm(title + " " + (sub || "") + " " + (extra || "")) });
    };
    PAGES.forEach(function (p) { add("Page", p.label, p.lieu, function () { S.go(p.file + ".html"); }); });
    D.scp.forEach(function (s) {
      add("Dossier", s.code + " · " + s.nom, D.classesObjet[s.classe].nom + " · " + s.resume, function () { S.openDossier(s.id); }, s.id + " scp" + s.id);
    });
    D.zones.forEach(function (z) { add("Zone", z.nom, z.niveau + " · " + z.profondeur, function () { S.go("plan.html#zone-" + z.id); }); });
    D.departements.forEach(function (d) { add("Département", d.nom, d.resume, function () { S.go("personnel.html#dept-" + d.id); }, d.code); });
    D.reglement.forEach(function (ch, ci) {
      ch.articles.forEach(function (a, ai) {
        add("Règle", "Art. " + (ci + 1) + "." + (ai + 1) + " · " + ch.titre, a, function () { S.go("reglement.html#art-" + (ci + 1) + "-" + (ai + 1)); });
      });
    });
    D.glossaire.forEach(function (g) { add("Glossaire", g[0], g[1], function () { S.go("reglement.html#glossaire"); }); });
    D.archives.forEach(function (a) {
      add("Archive", a.titre, fmtDate(a.date), function () { S.go("archives.html#arc-" + a.date); }, a.texte.replace(/\[\[\d\|[\s\S]*?\]\]/g, ""));
    });
    (D.evenements || []).forEach(function (ev) {
      add("Événement", ev.titre, fmtDate(ev.date) + " · " + ev.lieu, function () { S.go("evenements.html#evt-" + ev.id); });
    });
    add("Action", "Modifier mon habilitation", "Niveau affiché en haut de page", function () { if (S.openClearance) setTimeout(S.openClearance, 50); }, "habilitation niveau acces");
    add("Action", "Ouvrir un dossier au hasard", "Base de données SCP", function () { S.randomDossier(); }, "aleatoire hasard");
    add("Action", "Simuler une brèche", "Plan du site", function () { S.go("plan.html#simulation"); }, "breche alarme alerte sirene");
    add("Action", "Passer l'examen d'aptitude", "Règlement", function () { S.go("reglement.html#examen"); }, "quiz test");
    add("Action", "Créer ma fiche personnage", "Rejoindre", function () { S.go("rejoindre.html#fiche"); }, "personnage carte badge");
    add("Action", "Diffuser une annonce générale", "Protocoles", function () { S.go("protocoles.html#annonce"); }, "haut-parleur radio voix");
    add("Action", "Expérience avec SCP-914", "Laboratoire", function () { S.go("laboratoire.html#scp914"); }, "horlogerie machine");
    return ix;
  };
  var buildPalette = function () {
    palette = doc.createElement("div");
    palette.className = "palette";
    palette.hidden = true;
    palette.setAttribute("role", "dialog");
    palette.setAttribute("aria-modal", "true");
    palette.setAttribute("aria-label", "Recherche sur l'intranet");
    palette.innerHTML =
      '<div class="palette__backdrop" data-pclose></div>' +
      '<div class="palette__box">' +
        '<div class="palette__bar">' + ICON.search +
          '<input id="palette-input" type="search" autocomplete="off" spellcheck="false" placeholder="Rechercher un SCP, une zone, une règle, un événement…" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list">' +
          '<button type="button" class="palette__esc" data-pclose>Échap</button></div>' +
        '<ul class="palette__list" id="palette-list" role="listbox" aria-label="Résultats"></ul>' +
        '<div class="palette__foot"><span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span><span><kbd>Entrée</kbd> ouvrir</span><span><kbd>Ctrl</kbd>+<kbd>K</kbd> depuis toutes les pages</span></div>' +
      "</div>";
    doc.body.appendChild(palette);
    var input = palette.querySelector("input");
    input.addEventListener("input", function () { runSearch(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); selectP(pSel + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); selectP(pSel - 1); }
      else if (e.key === "Enter") { e.preventDefault(); activateP(pSel); }
      else if (e.key === "Escape") { e.preventDefault(); S.closeSearch(); }
    });
    palette.addEventListener("click", function (e) {
      if (e.target.closest("[data-pclose]")) { S.closeSearch(); return; }
      var li = e.target.closest("[data-pi]");
      if (li) activateP(+li.getAttribute("data-pi"));
    });
    palette.addEventListener("mousemove", function (e) {
      var li = e.target.closest("[data-pi]");
      if (li && +li.getAttribute("data-pi") !== pSel) selectP(+li.getAttribute("data-pi"), true);
    });
  };
  var runSearch = function (q) {
    if (!pIndex) pIndex = buildIndex();
    var words = norm(q.trim()).split(/\s+/).filter(Boolean);
    var list = palette.querySelector(".palette__list");
    if (!words.length) {
      pResults = pIndex.filter(function (x) { return x.type === "Page" || x.type === "Action"; });
    } else {
      pResults = pIndex.map(function (x) {
        if (!words.every(function (w) { return x.hay.indexOf(w) >= 0; })) return null;
        var t = norm(x.title), sc = 0;
        words.forEach(function (w) { if (t.indexOf(w) === 0) sc += 4; else if (t.indexOf(w) > 0) sc += 2; else sc += 1; });
        if (x.type === "Dossier") sc += 1;
        return { x: x, sc: sc };
      }).filter(Boolean).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 40).map(function (r) { return r.x; });
    }
    if (!pResults.length) {
      list.innerHTML = '<li class="palette__empty">Aucun résultat pour « ' + esc(q) + " ». Essaie « 173 », « brèche » ou « FIM ».</li>";
      return;
    }
    list.innerHTML = pResults.map(function (x, i) {
      return '<li id="pr-' + i + '" role="option" data-pi="' + i + '" aria-selected="false"><span class="palette__type">' + esc(x.type) + "</span>" +
        '<span class="palette__txt"><b>' + esc(x.title) + "</b><small>" + esc(x.sub.replace(/\[\[\d\|[\s\S]*?\]\]/g, "").slice(0, 110)) + "</small></span></li>";
    }).join("");
    selectP(0);
  };
  var selectP = function (i, noScroll) {
    if (!pResults.length) return;
    pSel = (i + pResults.length) % pResults.length;
    palette.querySelectorAll("[data-pi]").forEach(function (li) {
      var on = +li.getAttribute("data-pi") === pSel;
      li.setAttribute("aria-selected", String(on));
      if (on && !noScroll) li.scrollIntoView({ block: "nearest" });
    });
    palette.querySelector("input").setAttribute("aria-activedescendant", "pr-" + pSel);
  };
  var activateP = function (i) {
    var x = pResults[i];
    if (!x) return;
    S.closeSearch(true);
    x.run();
  };
  S.openSearch = function (q) {
    if (!palette) buildPalette();
    if (S.closeDrawer) S.closeDrawer();
    palette.hidden = false;
    doc.body.style.overflow = "hidden";
    var input = palette.querySelector("input");
    input.value = q || "";
    runSearch(input.value);
    input.focus();
    S.sfx("tick");
  };
  S.closeSearch = function (silent) {
    if (!palette || palette.hidden) return;
    palette.hidden = true;
    if (!modal || modal.hidden) doc.body.style.overflow = "";
    if (!silent) { var b = doc.getElementById("search-btn"); if (b) b.focus(); }
  };
  doc.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "") || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); S.openSearch(); }
    else if (e.key === "/" && !typing && !(palette && !palette.hidden)) { e.preventDefault(); S.openSearch(); }
  });

  /* ---------- Séquence de démarrage -------------------------------- */
  var booting = false, bootPending = false;
  var boot = function () {
    if (!settings.boot || !store.ok(true) || store.get("s73.boot", true) || reduced) { store.set("s73.boot", "1", true); return; }
    store.set("s73.boot", "1", true);
    booting = true;
    var el = doc.createElement("div");
    el.className = "boot";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<div class="boot__box"><div class="boot__logo">' + S.emblem() +
      "<div><b>SITE-73</b><small>Intranet · Fondation SCP · v" + esc(D.config.version) + "</small></div></div>" +
      '<div class="boot__log" aria-live="off"></div><div class="boot__bar"><i></i></div>' +
      '<div class="boot__foot"><span>Connexion au réseau sécurisé</span><button type="button" class="boot__skip">Passer</button></div></div>';
    doc.body.appendChild(el);
    var log = el.querySelector(".boot__log"), bar = el.querySelector(".boot__bar i");
    var w = S.meteo();
    var lines = [
      "> Initialisation du terminal ............ <span class=\"ok\">OK</span>",
      "> Liaison avec le nœud alpin ............ <span class=\"ok\">OK</span>",
      "> Conditions en surface : " + (w.temp > 0 ? "+" : "") + w.temp + " °C, vent " + w.vent + " km/h",
      "> Chargement de " + D.scp.length + " dossiers de confinement ... <span class=\"ok\">OK</span>",
      "> Niveau d'alerte : <span class=\"hl\">" + esc(D.alertes[alertLevel].code.toUpperCase()) + "</span>",
      "> Identité : <span class=\"hl\">" + (sess.user ? esc(sess.user.nom.toUpperCase()) + (sess.mode === "live" ? " (DISCORD)" : " (DÉMO)") : "VISITEUR NON CONNECTÉ") + "</span>",
      "> Habilitation : <span class=\"hl\">NIVEAU " + clearance + " · " + esc(habName(clearance).toUpperCase()) + "</span>"
    ];
    var timers = [], done = false;
    var finish = function () {
      if (done) return;
      done = true;
      booting = false;
      timers.forEach(clearTimeout);
      el.classList.add("is-done");
      setTimeout(function () { el.remove(); }, 520);
      doc.removeEventListener("keydown", finish);
      setTimeout(checkBadges, 400);
    };
    lines.forEach(function (l, i) {
      timers.push(setTimeout(function () {
        log.innerHTML += (i ? "\n" : "") + l;
        bar.style.width = ((i + 1) / lines.length) * 100 + "%";
        S.sfx("tick");
      }, 180 + i * 290));
    });
    timers.push(setTimeout(function () {
      log.innerHTML += '\n\n<span class="boot__granted">Accès autorisé</span>';
      S.sfx("ok");
    }, 180 + lines.length * 290));
    timers.push(setTimeout(finish, 180 + lines.length * 290 + 700));
    el.addEventListener("click", finish);
    doc.addEventListener("keydown", finish);
  };

  /* ---------- Portes blindées & navigation ------------------------ */
  var doors;
  var buildDoors = function () {
    doors = doc.createElement("div");
    doors.className = "doors";
    doors.setAttribute("aria-hidden", "true");
    doors.innerHTML = '<div class="doors__l"></div><div class="doors__r"></div>';
    doc.body.appendChild(doors);
  };
  var parseHref = function (href) {
    var m = /^(?:\.\/)?([a-z0-9-]+)\.html(?:#([\w.~-]+))?$/i.exec(href || "");
    if (!m || !byFile[m[1]]) return null;
    return { page: byFile[m[1]], hash: m[2] || "" };
  };
  var hashHandlers = [];
  S.onHash = function (fn) { hashHandlers.push(fn); };
  var flashTarget = function (el) {
    el.classList.remove("is-target");
    void el.offsetWidth;
    el.classList.add("is-target");
    setTimeout(function () { el.classList.remove("is-target"); }, 2200);
  };
  S.flashTarget = flashTarget;
  var scrollToHash = function (h) {
    if (!h) return false;
    if (h === "contenu") {
      var mm = doc.querySelector("main:not([hidden])");
      if (mm) { mm.setAttribute("tabindex", "-1"); mm.focus(); }
      return true;
    }
    if (/^scp-/.test(h)) {
      var s = S.findScp(h.slice(4));
      if (s) { S.openDossier(s.id); return true; }
    }
    for (var i = 0; i < hashHandlers.length; i++) { if (hashHandlers[i](h)) return true; }
    var t = doc.getElementById(h);
    if (t) {
      t.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      if (t.tagName !== "SECTION" && t.tagName !== "MAIN") flashTarget(t);
      return true;
    }
    return false;
  };
  S.scrollToHash = scrollToHash;
  S.go = function (href) {
    var target = parseHref(href);
    if (!target) { location.href = href; return; }
    if (S.closeDrawer) S.closeDrawer();
    if (target.page.id === currentPage) {
      if (target.hash) scrollToHash(target.hash);
      else window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      return;
    }
    S.sfx("door");
    if (reduced) { finishNav(target, href); return; }
    doors.classList.add("is-closed");
    setTimeout(function () { finishNav(target, href); }, 440);
  };
  var finishNav = function (target, href) {
    if (BUNDLE) {
      showView(target.page.id, target.hash);
      requestAnimationFrame(function () { requestAnimationFrame(function () { doors.classList.remove("is-closed"); }); });
    } else {
      store.set("s73.doors", "1", true);
      location.href = href;
    }
  };
  doc.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest("a[href]");
    if (!a || a.target === "_blank") return;
    var href = a.getAttribute("href");
    if (href.charAt(0) === "#") {
      var h = href.slice(1);
      if (h && (BUNDLE || !doc.getElementById(h))) { e.preventDefault(); scrollToHash(h); }
      return;
    }
    if (!parseHref(href)) return;
    e.preventDefault();
    S.go(href);
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && doors) doors.classList.remove("is-closed");
  });

  /* ---------- Code du Conseil O5 (↑ ↑ ↓ ↓ ← → ← → B A) ------------ */
  var KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
  var kPos = 0;
  doc.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();
    kPos = k === KONAMI[kPos] ? kPos + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kPos === KONAMI.length) { kPos = 0; S.omega(); }
  });
  S.omega = function () {
    if (doc.querySelector(".omega")) return;
    var prev = alertLevel;
    S.setAlert("noir", { persist: false });
    var el = doc.createElement("div");
    el.className = "omega";
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-label", "Protocole Oméga");
    el.innerHTML = '<div class="omega__box">' + S.emblem() + '<p class="label">Transmission prioritaire · Conseil O5</p>' +
      "<h2>Protocole Oméga</h2><p>Votre curiosité a été notée. Un membre de l'unité Alpha-1 se présentera à votre poste dans les prochaines minutes.</p>" +
      '<p class="omega__small">Cet incident n\'a jamais eu lieu.</p><button type="button" class="btn">Reprendre le service</button></div>';
    doc.body.appendChild(el);
    [220, 180, 150].forEach(function (f, i) { S.tone(f, 0.5, { type: "sawtooth", vol: 0.05, delay: i * 0.45 }); });
    var close = function () { el.remove(); S.setAlert(prev, { persist: false }); S.flag("omega"); };
    el.querySelector("button").addEventListener("click", close);
    el.querySelector("button").focus();
  };

  /* ---------- Mode « un seul fichier » (aperçu) -------------------- */
  var showView = function (id, h) {
    var views = doc.querySelectorAll("main[data-view]");
    var found = false;
    views.forEach(function (v) {
      var on = v.getAttribute("data-view") === id;
      v.hidden = !on;
      if (on) found = true;
    });
    if (!found) return;
    currentPage = id;
    doc.body.setAttribute("data-page", id);
    markNav(id);
    var p = byId[id];
    doc.title = id === "accueil" ? "Intranet du Site-73" : p.label + " · Site-73";
    window.scrollTo(0, 0);
    try { history.replaceState(null, "", "#" + (h || id)); } catch (e) { /* ignoré */ }
    if (h) setTimeout(function () { scrollToHash(h); }, 60);
    var main = doc.querySelector('main[data-view="' + id + '"]');
    if (main) { main.setAttribute("tabindex", "-1"); main.focus({ preventScroll: true }); }
    S.mark("pages", id, true);
    doc.dispatchEvent(new CustomEvent("s73:view", { detail: { id: id } }));
  };
  S.currentPage = function () { return currentPage; };

  /* ---------- Session : chargement, démonstration, API staff -------- */
  var staticArchives = D.archives.slice(), staticEvenements = (D.evenements || []).slice(), staticAlerte = D.config.alerte;
  var dateParis;
  try {
    var dpFmt = new Intl.DateTimeFormat("en-CA", { timeZone: D.config.fuseau, year: "numeric", month: "2-digit", day: "2-digit" });
    dateParis = function (d) { return dpFmt.format(d); };
  } catch (e) { dateParis = function (d) { return d.toISOString().slice(0, 10); }; }
  // "2026-09-26T21:00" (heure de Paris) → ISO avec le bon décalage (été/hiver)
  S.isoParis = function (local) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local || "")) return null;
    var dec = function (d) {
      try {
        var nom = new Intl.DateTimeFormat("en-US", { timeZone: D.config.fuseau, timeZoneName: "shortOffset" }).formatToParts(d)
          .filter(function (x) { return x.type === "timeZoneName"; })[0].value;
        var m = /GMT(?:([+-]\d+)(?::(\d+))?)?/.exec(nom);
        var h = m && m[1] ? +m[1] : 0;
        return h * 60 + (m && m[2] ? (h < 0 ? -1 : 1) * +m[2] : 0);
      } catch (e) { return 120; }
    };
    var approx = new Date(local + ":00Z");
    if (isNaN(approx)) return null;
    var min = dec(new Date(approx.getTime() - dec(approx) * 60000)), a = Math.abs(min);
    return local + ":00" + (min >= 0 ? "+" : "-") + pad(Math.floor(a / 60)) + ":" + pad(a % 60);
  };

  var reindex = function () {
    scpById = {}; D.scp.forEach(function (x) { scpById[x.id] = x; });
    zoneById = {}; D.zones.forEach(function (z) { zoneById[z.id] = z; });
    S.scpById = scpById; S.zoneById = zoneById; pIndex = null;
  };
  var appliquerContenu = function (p) {
    Object.keys(p.data).forEach(function (k) { D[k] = p.data[k]; });
    reindex();
  };

  // Faux serveur local du mode démonstration (aperçu sans fonctions Netlify)
  var ilYa = function (h) { return new Date(Date.now() - h * 3600000).toISOString(); };
  var demoGraine = function () {
    return {
      membres: [
        { id: "demo-admin", nom: "Admin (démo)", pseudo: "vous", admin: true, derniereVisite: ilYa(0) },
        { id: "100000000000000001", nom: "Exemple · Élise Varenne", pseudo: "exemple.varenne", roleHab: 2, derniereVisite: ilYa(3) },
        { id: "100000000000000002", nom: "Exemple · Hugo Ferrand", pseudo: "exemple.ferrand", roleHab: 3, derniereVisite: ilYa(20) },
        { id: "100000000000000003", nom: "Exemple · Karim Belkacem", pseudo: "exemple.belkacem", roleHab: 2, override: 4, modifiePar: "Admin (démo)", modifieLe: ilYa(48), derniereVisite: ilYa(30) },
        { id: "100000000000000004", nom: "Exemple · D-9341", pseudo: "exemple.dclasse", derniereVisite: ilYa(70) },
        { id: "100000000000000005", nom: "Exemple · Nora Castel", pseudo: "exemple.castel", roleHab: 1, derniereVisite: ilYa(120) }
      ],
      etat: null, communiques: [], evenements: null,
      journal: [{ le: ilYa(48), par: "Admin (démo)", action: "Habilitation de Exemple · Karim Belkacem réglée sur le niveau 4" }]
    };
  };
  var demoLire = function () {
    try { var d = JSON.parse(store.get("s73.demo.db") || "null"); if (d && d.membres) return d; } catch (e) { /* graine */ }
    return demoGraine();
  };
  var demoEcrire = function (d) { store.set("s73.demo.db", JSON.stringify(d)); };
  var habDe = function (m) {
    if (m.admin) return { niveau: 5, source: "admin" };
    if (typeof m.override === "number") return { niveau: m.override, source: "staff" };
    if (typeof m.roleHab === "number") return { niveau: m.roleHab, source: "role" };
    return { niveau: 1, source: "defaut" };
  };
  var demoEtat = function (d) {
    return {
      membres: d.membres.map(function (m) {
        var h = habDe(m);
        return Object.assign({}, m, { habilitation: h.niveau, source: h.source, override: typeof m.override === "number" ? m.override : null, admin: !!m.admin });
      }).sort(function (a, b) { return (b.derniereVisite || "").localeCompare(a.derniereVisite || ""); }),
      etat: d.etat || { alerte: staticAlerte, par: null, le: null },
      communiques: d.communiques,
      evenements: d.evenements || staticEvenements,
      journal: d.journal.slice(0, 60)
    };
  };
  var demoAction = function (action, c) {
    var d = demoLire(), par = sess.user ? sess.user.nom : "Admin (démo)", now = new Date().toISOString();
    var t = function (v, max) { return typeof v === "string" ? v.trim().slice(0, max) : ""; };
    var err = function (m) { throw new Error(m); };
    var log = function (a) { d.journal.unshift({ le: now, par: par, action: a }); d.journal = d.journal.slice(0, 200); };
    var niveauOk = function (n) { return typeof n === "number" && n % 1 === 0 && n >= 0 && n <= 5; };
    if (action === "habilitation") {
      var m = d.membres.filter(function (x) { return x.id === c.id; })[0];
      if (!m) err("Membre introuvable.");
      if (c.niveau === null) delete m.override; else if (niveauOk(c.niveau)) m.override = c.niveau; else err("Niveau invalide (0 à 5).");
      m.modifiePar = par; m.modifieLe = now;
      log(c.niveau === null ? "Habilitation de " + m.nom + " rendue à ses rôles Discord" : "Habilitation de " + m.nom + " réglée sur le niveau " + c.niveau);
    } else if (action === "alerte") {
      if (ALERTS.indexOf(c.niveau) < 0) err("Niveau d'alerte inconnu.");
      d.etat = { alerte: c.niveau, par: par, le: now };
      log("Niveau d'alerte du site : " + D.alertes[c.niveau].code);
    } else if (action === "communique.ajouter") {
      var titre = t(c.titre, 120), texte = t(c.texte, 2000);
      if (!titre || !texte) err("Titre et texte obligatoires.");
      var niv = niveauOk(c.niveau) ? c.niveau : 0;
      d.communiques.unshift({ id: "c" + Date.now(), date: dateParis(new Date()), titre: titre, texte: texte, niveau: niv, auteur: par, creeLe: now });
      log("Communiqué publié : « " + titre + " »" + (niv ? " (niveau " + niv + ")" : ""));
    } else if (action === "communique.supprimer") {
      var cc = d.communiques.filter(function (x) { return x.id === c.id; })[0];
      if (!cc) err("Communiqué introuvable.");
      d.communiques = d.communiques.filter(function (x) { return x.id !== c.id; });
      log("Communiqué supprimé : « " + cc.titre + " »");
    } else if (action === "evenement.enregistrer") {
      var ti = t(c.titre, 100), date = S.isoParis(c.date), duree = Number(c.duree);
      if (!ti || !date) err("Titre et date obligatoires.");
      if (!D.typesEvenement[c.type]) err("Type d'événement inconnu.");
      if (!(duree >= 15 && duree <= 720)) err("Durée entre 15 et 720 minutes.");
      var liste = (d.evenements || staticEvenements).slice();
      var ev = { id: c.id || "evt-" + Date.now().toString(36), date: date, duree: duree, type: c.type, titre: ti, lieu: t(c.lieu, 120), texte: t(c.texte, 1000) };
      var i = -1;
      liste.forEach(function (x, j) { if (x.id === ev.id) i = j; });
      if (i >= 0) liste[i] = ev; else liste.push(ev);
      liste.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
      d.evenements = liste;
      log("Événement " + (i >= 0 ? "modifié" : "ajouté") + " : « " + ti + " »");
    } else if (action === "evenement.supprimer") {
      var l2 = (d.evenements || staticEvenements).slice();
      var cible = l2.filter(function (x) { return x.id === c.id; })[0];
      if (!cible) err("Événement introuvable.");
      d.evenements = l2.filter(function (x) { return x.id !== c.id; });
      log("Événement supprimé : « " + cible.titre + " »");
    } else {
      err("Action inconnue.");
    }
    demoEcrire(d);
    return demoEtat(d);
  };
  var demoAppliquer = function () {
    var d = demoLire();
    D.config.alerte = d.etat && ALERTS.indexOf(d.etat.alerte) >= 0 ? d.etat.alerte : staticAlerte;
    D.archives = d.communiques.filter(function (c) { return (c.niveau || 0) <= clearance; }).map(function (c) {
      return { id: c.id, date: c.date, type: "communique", titre: c.titre, texte: c.texte, auteur: c.auteur, niveau: c.niveau || 0, dyn: true };
    }).concat(staticArchives);
    D.evenements = d.evenements || staticEvenements;
  };

  var appelStaff = function (options) {
    return fetch("/api/staff", Object.assign({ credentials: "same-origin" }, options)).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.erreur || "Erreur du serveur (" + r.status + ").");
        return j;
      });
    });
  };
  S.api = {
    etat: function () { return sess.mode === "live" ? appelStaff({}) : Promise.resolve(demoEtat(demoLire())); },
    action: function (action, corps) {
      if (sess.mode === "live") {
        return appelStaff({ method: "POST", headers: { "content-type": "application/json", "x-s73": "1" }, body: JSON.stringify(Object.assign({ action: action }, corps)) });
      }
      return new Promise(function (ok) { ok(demoAction(action, corps || {})); });
    }
  };
  // Après une action du staff : recharge le contenu et prévient les pages.
  S.rafraichirContenu = function (action) {
    var fin = function () {
      if (action === "alerte") { store.del("s73.alerte", true); alertLevel = D.config.alerte; applyAlert(); doc.dispatchEvent(new CustomEvent("s73:alert", { detail: { level: alertLevel } })); }
      doc.dispatchEvent(new CustomEvent("s73:dynamic"));
    };
    if (sess.mode !== "live") { demoAppliquer(); fin(); return Promise.resolve(); }
    return fetch("/api/contenu", { credentials: "same-origin" }).then(function (r) { return r.json(); })
      .then(function (p) { if (p && p.data) appliquerContenu(p); fin(); }, fin);
  };

  var passerEnDemo = function () {
    sess.mode = "demo";
    var profil = store.get("s73.demo.profil") || "membre";
    sess.admin = profil === "admin";
    sess.user = profil === "visiteur" ? null : { id: "demo", nom: profil === "admin" ? "Admin (démo)" : "Membre (démo)", avatar: null };
    sess.source = "demo";
    sess.reel = clearance;
    demoAppliquer();
  };
  var applySessionUI = function () {
    doc.querySelectorAll("[data-staff-only]").forEach(function (el) { el.hidden = !sess.admin; });
    doc.querySelectorAll("[data-session-nom]").forEach(function (el) { el.textContent = sess.user ? sess.user.nom : "Visiteur"; });
    doc.querySelectorAll("[data-session-mode]").forEach(function (el) { el.textContent = sess.mode === "live" ? "En ligne · Discord" : "Démonstration"; });
    renderClrPop();
    updateClearanceUI();
    doc.dispatchEvent(new CustomEvent("s73:session"));
  };
  S.setDemoProfil = function (p) {
    if (sess.mode !== "demo" || ["visiteur", "membre", "admin"].indexOf(p) < 0) return;
    store.set("s73.demo.profil", p);
    var niveau = p === "visiteur" ? 0 : p === "admin" ? 5 : Math.min(Math.max(clearance, 1), 4);
    var prev = clearance;
    clearance = niveau;
    store.set("s73.hab", niveau);
    passerEnDemo();
    rerender(prev);
    applySessionUI();
    doc.dispatchEvent(new CustomEvent("s73:clearance", { detail: { level: niveau, prev: prev } }));
    doc.dispatchEvent(new CustomEvent("s73:dynamic"));
    S.toast("<b>Profil de démonstration : " + { visiteur: "visiteur", membre: "membre", admin: "administrateur" }[p] + ".</b> " +
      (p === "admin" ? "L'espace staff est dans le menu « Plus »." : p === "visiteur" ? "Sans connexion, seul le niveau 0 est lisible." : "Choisis un niveau d'habilitation pour tester."));
    checkBadges();
  };

  var chargerSession = function () {
    if (BUNDLE || location.protocol === "file:") { passerEnDemo(); return Promise.resolve(); }
    var ctrl = window.AbortController ? new AbortController() : null;
    var minuteur = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    return fetch("/api/contenu", { credentials: "same-origin", headers: { accept: "application/json" }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (p) {
        clearTimeout(minuteur);
        if (!p || p.mode !== "live" || !p.data) throw new Error("réponse inattendue");
        appliquerContenu(p);
        sess.mode = "live";
        if (p.session) {
          sess.user = { id: p.session.id, nom: p.session.nom, avatar: p.session.avatar };
          sess.admin = !!p.session.admin;
          sess.reel = p.session.habilitation;
          sess.source = p.session.source;
        } else {
          sess.user = null; sess.admin = false; sess.reel = 0; sess.source = "visiteur";
        }
        var voir = sess.admin ? parseInt(store.get("s73.voir", true), 10) : NaN;
        clearance = !isNaN(voir) && voir >= 0 && voir <= sess.reel ? voir : sess.reel;
      })
      .catch(function () { clearTimeout(minuteur); passerEnDemo(); });
  };
  var apresSession = function () {
    alertLevel = store.get("s73.alerte", true);
    if (ALERTS.indexOf(alertLevel) < 0) alertLevel = D.config.alerte;
    applyAlert();
    doc.querySelectorAll("[data-last-update]").forEach(function (el) {
      el.textContent = fmtDate(D.archives.map(function (a) { return a.date; }).sort().pop());
    });
    applySessionUI();
  };
  var MESSAGES = {
    ok: [false, function () { return "<b>Connecté · " + esc(sess.user ? sess.user.nom : "") + ".</b> Habilitation niveau " + sess.reel + " (" + esc(habName(sess.reel)) + ")."; }],
    fermee: [false, "<b>Déconnecté.</b> À bientôt au Site-73."],
    annulee: [true, "<b>Connexion annulée.</b>"],
    expiree: [true, "<b>La connexion a expiré.</b> Réessaie depuis le bouton « Hab. »."],
    serveur: [true, "<b>Accès refusé.</b> Ce compte Discord n'est pas membre du serveur du Site-73."],
    discord: [true, "<b>Discord n'a pas répondu.</b> Réessaie dans un instant."],
    config: [true, "<b>Connexion indisponible.</b> La connexion Discord n'est pas encore configurée sur ce site."]
  };
  var messageConnexion = function () {
    var q = /[?&]connexion=([a-z]+)/.exec(location.search);
    if (!q || !MESSAGES[q[1]]) return;
    var m = MESSAGES[q[1]];
    setTimeout(function () { S.toast(typeof m[1] === "function" ? m[1]() : m[1], { warn: m[0], duration: 6000 }); }, booting ? 2600 : 300);
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { /* ignoré */ }
  };

  /* ---------- Démarrage ----------------------------------------------- */
  buildHeader();
  buildFooter();
  buildDoors();
  var vig = doc.createElement("div");
  vig.className = "vignette";
  vig.setAttribute("aria-hidden", "true");
  doc.body.appendChild(vig);

  applyAlert();
  updateClearanceUI();
  updateBadgeCount();
  applyDiscord();
  doc.querySelectorAll("[data-last-update]").forEach(function (el) {
    var last = D.archives.map(function (a) { return a.date; }).sort().pop();
    el.textContent = fmtDate(last);
  });
  doc.querySelectorAll("[data-emblem]").forEach(function (el) { el.innerHTML = S.emblem(); });
  var fill = function (sel, val) { doc.querySelectorAll(sel).forEach(function (el) { el.textContent = val; }); };
  fill("[data-scp-count]", D.scp.length);
  fill("[data-personnel]", D.config.personnelActif);
  fill("[data-dept-count]", D.departements.length);
  fill("[data-arch-count]", D.archives.length);
  fill("[data-chapter-count]", D.reglement.length);
  fill("[data-article-count]", D.reglement.reduce(function (n, c) { return n + c.articles.length; }, 0));
  fill("[data-zone-count]", D.zones.length);
  fill("[data-page-count]", PAGES.length);
  fill("[data-event-count]", (D.evenements || []).length);
  tick();
  setInterval(tick, 1000);

  if (BUNDLE) {
    var h0 = (location.hash || "").slice(1);
    var start = "accueil", sub = "";
    if (byId[h0]) start = h0;
    else if (/^scp-/.test(h0)) { start = "confinement"; sub = h0; }
    else if (/^zone-/.test(h0)) { start = "plan"; sub = h0; }
    else if (/^dept-/.test(h0)) { start = "personnel"; sub = h0; }
    else if (/^evt-/.test(h0)) { start = "evenements"; sub = h0; }
    else if (h0) {
      var t0 = doc.getElementById(h0);
      var v0 = t0 && t0.closest("main[data-view]");
      if (v0) { start = v0.getAttribute("data-view"); sub = h0; }
    }
    currentPage = start;
    doc.querySelectorAll("main[data-view]").forEach(function (v) { v.hidden = v.getAttribute("data-view") !== start; });
    markNav(start);
    doc.body.setAttribute("data-page", start);
    S._startHash = sub;
  } else {
    markNav(currentPage);
    if (store.get("s73.doors", true) === "1" && !reduced) {
      store.del("s73.doors", true);
      doors.querySelectorAll("div").forEach(function (d) { d.style.transition = "none"; });
      doors.classList.add("is-closed");
      void doors.offsetWidth;
      doors.querySelectorAll("div").forEach(function (d) { d.style.transition = ""; });
      requestAnimationFrame(function () { requestAnimationFrame(function () { doors.classList.remove("is-closed"); }); });
    } else {
      store.del("s73.doors", true);
      bootPending = true;
    }
  }

  // Les modules de pages attendent la session avant de s'afficher.
  S.donneesPretes = chargerSession().then(apresSession);

  // Appelé par les modules de pages une fois tout construit.
  S.ready = function () {
    carnet.pages[currentPage] = carnet.pages[currentPage] || Date.now();
    var hr = S.siteHour();
    if (hr >= 0 && hr < 5) carnet.flags.nuit = true;
    saveCarnet();
    badgeReady = true;
    if (BUNDLE || bootPending) boot();
    messageConnexion();
    setTimeout(function () { if (!booting) checkBadges(); }, 700);
    if (BUNDLE) {
      if (S._startHash) setTimeout(function () { scrollToHash(S._startHash); }, 80);
    } else if (location.hash) {
      setTimeout(function () { scrollToHash(location.hash.slice(1)); }, 60);
    }
  };
})();
