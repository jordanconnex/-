/* ==========================================================================
   SITE-73 · NOYAU
   En-tête, pied de page, horloge, météo, habilitation, niveau d'alerte,
   caviardage, dossiers, recherche globale, carnet de service (distinctions),
   réglages, sons, synthèse vocale, séquence de démarrage et transitions.
   ========================================================================== */
(function () {
  "use strict";

  let S = (window.S73 = window.S73 || {});
  let D = S.data;
  let doc = document;
  let root = doc.documentElement;
  let BUNDLE = !!window.S73_BUNDLE;
  let systemeReduit = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  let reduced = systemeReduit; // recalculé dès que le stockage est disponible (voir « Animations »)

  /* ---------- Stockage (toujours protégé) ---------------------------- */
  let store = {
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
        let s = session ? sessionStorage : localStorage;
        s.setItem("s73.t", "1"); s.removeItem("s73.t");
        return true;
      } catch (e) { return false; }
    }
  };
  S.store = store;

  /* ---------- Animations -------------------------------------------- */
  // Choix du visiteur (on | off), sinon réglage du site, sinon préférence de l'appareil.
  let choixMouvement = store.get("s73.motion");
  let calculerMouvement = function () {
    reduced = choixMouvement === "off" || (choixMouvement !== "on" && D.config.animations !== "toujours" && systemeReduit);
    root.setAttribute("data-motion", reduced ? "reduit" : "normal");
  };
  calculerMouvement();
  S.getMotion = function () { return choixMouvement || "auto"; };
  S.systemeReduit = function () { return systemeReduit; };
  S.setMotion = function (v) {
    choixMouvement = v === "on" || v === "off" ? v : null;
    if (choixMouvement) store.set("s73.motion", choixMouvement); else store.del("s73.motion");
    calculerMouvement();
    doc.dispatchEvent(new CustomEvent("s73:settings", { detail: { key: "motion", value: S.getMotion() } }));
  };

  /* ---------- Utilitaires -------------------------------------------- */
  let esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  let norm = function (s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  };
  let hash = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  let MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  let fmtDate = function (iso) {
    let p = iso.slice(0, 10).split("-");
    return parseInt(p[2], 10) + " " + MOIS[parseInt(p[1], 10) - 1] + " " + p[0];
  };
  let pad = function (n) { return String(n).padStart(2, "0"); };
  let count = function (o) { return Object.keys(o || {}).length; };
  let copyText = function (text, okMsg, fallbackEl) {
    let fallback = function () {
      if (fallbackEl) {
        let r = doc.createRange();
        r.selectNodeContents(fallbackEl);
        let sel = window.getSelection();
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
  let PAGES = [
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
  let GROUPES = { site: "Le site", communaute: "Communauté", outils: "Outils" };
  S.pages = PAGES;
  let byFile = {}, byId = {};
  PAGES.forEach(function (p) { byFile[p.file] = p; byId[p.id] = p; });
  let currentPage = (doc.body && doc.body.getAttribute("data-page")) || "accueil";

  /* ---------- Emblème & icônes --------------------------------------- */
  S.emblem = function (cls) {
    let arrows = [0, 120, 240].map(function (a) {
      return '<path transform="rotate(' + a + ' 50 50)" d="M45 1.5H55V16.5H62.5L50 31L37.5 16.5H45Z"/>';
    }).join("");
    return '<svg class="' + (cls || "") + '" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<circle cx="50" cy="50" r="41.5" fill="none" stroke="currentColor" stroke-width="8"/>' +
      '<circle cx="50" cy="50" r="18.5" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<g fill="currentColor" style="stroke: var(--emb-bg, #0C1215)" stroke-width="3.5" paint-order="stroke">' + arrows + "</g></svg>";
  };
  let svgI = function (d, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"' + (extra || "") + ">" + d + "</svg>";
  };
  let ICON = {
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
    copy: svgI('<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>'),
    lock: svgI('<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    arrowL: svgI('<path d="M20 12H5M11 6l-6 6 6 6"/>'),
    shield: svgI('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>')
  };
  S.icon = ICON;

  /* ---------- Réglages ------------------------------------------------- */
  let settings = {
    fx: store.get("s73.fx") !== "off",
    sfx: store.get("s73.sfx") === "on",
    boot: store.get("s73.bootoff") !== "1"
  };
  let applyFx = function () { root.setAttribute("data-fx", settings.fx ? "on" : "off"); };
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
  let actx = null;
  S.audioCtx = function () {
    try {
      let AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = actx || new AC();
      if (actx.state === "suspended") actx.resume();
      return actx;
    } catch (e) { return null; }
  };
  S.tone = function (freq, dur, opts) {
    opts = opts || {};
    if (!opts.force && !settings.sfx) return;
    let ctx = S.audioCtx();
    if (!ctx) return;
    try {
      let t = ctx.currentTime + (opts.delay || 0);
      let o = ctx.createOscillator(), g = ctx.createGain();
      o.type = opts.type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
      let vol = opts.vol || 0.05;
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
      let say = text.replace(/−/g, "moins ").replace(/SCP-/g, "S C P ").replace(/ANO-/g, "A N O ")
        .replace(/\[DONNÉES SUPPRIMÉES\]|\[SUPPRIMÉ\]/g, "données supprimées");
      let u = new SpeechSynthesisUtterance(say);
      u.lang = "fr-FR";
      u.rate = opts.rate || 0.95;
      u.pitch = opts.pitch || 0.9;
      let v = speechSynthesis.getVoices().filter(function (x) { return /^fr/i.test(x.lang); })[0];
      if (v) u.voice = v;
      if (opts.onend) { u.onend = opts.onend; u.onerror = opts.onend; }
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  };
  S.stopSpeak = function () { try { speechSynthesis.cancel(); } catch (e) { /* rien */ } };

  /* ---------- Habilitation ------------------------------------------- */
  // L'habilitation vient de la session du serveur : personne ne la choisit.
  let clearance = 0;
  store.del("s73.hab");
  S.getClearance = function () { return clearance; };
  let habName = function (n) { return D.habilitations[n].nom; };
  S.habName = habName;

  /* ---------- Session (compte identifiant + mot de passe) ----------- */
  // mode "live" : le site parle à son Worker Cloudflare (/api/…) ;
  // mode "horsligne" : le serveur ne répond pas (fichier local, hébergement
  // de fichiers simples) : visiteur de niveau 0, sans connexion ni staff.
  // Le mode staff est à part : il faut être administrateur (compte nommé
  // par le staff) PUIS l'activer. Hors mode staff, personne ne peut changer l'alerte ni
  // les habilitations.
  let sess = { mode: "horsligne", user: null, admin: false, reel: 0, source: "visiteur" };
  // Identifiant du compte qui a activé le mode staff dans cet onglet
  let staffId = store.get("s73.staff", true) || "";
  // Restes de l'ancien mode démonstration
  ["s73.demo.db", "s73.demo.profil", "s73.staff.essais", "s73.staff.bloque"].forEach(function (k) { store.del(k); });
  store.del("s73.demo.staff", true);
  S.session = function () { return sess; };
  S.isLive = function () { return sess.mode === "live"; };
  S.isAdmin = function () { return !!sess.admin; };
  S.modeStaff = function () { return !!sess.admin && !!sess.user && staffId === String(sess.user.id); };
  let activerStaff = function (on) {
    staffId = on && sess.user ? String(sess.user.id) : "";
    if (staffId) store.set("s73.staff", staffId, true); else store.del("s73.staff", true);
  };
  S.canChooseClearance = function () { return S.modeStaff(); };
  // Page de connexion ; le visiteur revient ensuite sur la page où il était
  S.loginUrl = function (inscription) {
    let p = byId[currentPage];
    return "connexion.html?retour=" + encodeURIComponent(p && p.id !== "accueil" ? "/" + p.file + ".html" : "/") + (inscription ? "#inscription" : "");
  };
  S.avatar = function (u, cls) {
    let ini = String(u && u.nom || "?").replace(/[^A-Za-zÀ-ÿ0-9 ._-]/g, "").split(/[\s._-]+/).filter(Boolean).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase() || "?";
    return '<span class="av ' + (cls || "") + '" aria-hidden="true">' + esc(ini) + "</span>";
  };

  /* ---------- Caviardage ---------------------------------------------- */
  let TOKEN_SRC = /\[\[(\d)\|([\s\S]*?)\]\]|\[(DONNÉES SUPPRIMÉES|SUPPRIMÉ)\]/.source;
  let FILLER = /^[▒\s]+$/;
  let supOnly = function (t) {
    return esc(t).replace(/\[(DONNÉES SUPPRIMÉES|SUPPRIMÉ)\]/g, '<span class="sup">[$1]</span>');
  };
  // lvl permet d'afficher un texte « comme le verrait » un autre niveau (aperçu).
  S.redact = function (text, prev, lvl) {
    if (lvl == null) lvl = clearance;
    let out = "", last = 0, m;
    let re = new RegExp(TOKEN_SRC, "g");
    while ((m = re.exec(text))) {
      out += esc(text.slice(last, m.index));
      if (m[1]) {
        let n = +m[1], inner = m[2];
        if (lvl >= n && !FILLER.test(inner)) {
          let fresh = prev != null && n > prev ? " is-new" : "";
          out += '<span class="rv' + fresh + '" data-lvl="' + n + '" title="Déclassifié · niveau ' + n + '">' + supOnly(inner) + "</span>";
        } else {
          let filler = inner.replace(/\[[^\]]*\]/g, "xxxxxxxx").replace(/\S/g, "x");
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
  let rerender = function (prev) {
    doc.querySelectorAll("[data-r]").forEach(function (el) {
      if (el.__raw != null) el.innerHTML = S.redact(el.__raw, prev);
    });
  };

  let updateClearanceUI = function () {
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
      S.toast("<b>Habilitation attribuée par le staff.</b> " + (sess.user ? "Demande au staff du serveur pour évoluer." : "Connecte-toi pour recevoir la tienne."), { warn: true });
      S.sfx("deny");
      return;
    }
    // Mode staff : aperçu du site « comme » un niveau inférieur, le temps de la session.
    n = Math.min(n, sess.reel);
    if (n === sess.reel) store.del("s73.voir", true); else store.set("s73.voir", n, true);
    let prev = clearance;
    clearance = n;
    updateClearanceUI();
    rerender(prev);
    doc.dispatchEvent(new CustomEvent("s73:clearance", { detail: { level: n, prev: prev } }));
    if (!(opts && opts.silent)) {
      let diff = n > prev ? "Informations déclassifiées." : n < prev ? "Informations reclassifiées." : "Aucun changement.";
      S.toast("<b>" + (n === sess.reel ? "Retour à ton niveau · " : "Aperçu comme niveau ") + n + "</b> " + esc(habName(n)) + ". " + diff);
    }
    renderClrPop();
    S.sfx("ok");
    checkBadges();
  };

  doc.addEventListener("click", function (e) {
    let bar = e.target.closest(".rd");
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
    let lvl = bar.getAttribute("data-lvl");
    let fin = S.modeStaff() ? " Mode staff : change l'aperçu avec le bouton « Hab. »."
      : sess.user ? " Seul le staff du serveur peut relever votre habilitation."
      : sess.mode === "live" ? ' <a class="link" href="' + S.loginUrl() + '">Connectez-vous</a> pour recevoir la vôtre.'
      : " Connectez-vous avec le bouton « Hab. » pour recevoir la vôtre.";
    S.toast("<b>Accès refusé.</b> Niveau " + lvl + " requis, votre habilitation est de niveau " + clearance + "." + fin, { warn: true, duration: 6000 });
  }

  /* ---------- Niveau d'alerte ---------------------------------------- */
  let ALERTS = ["vert", "jaune", "orange", "rouge", "noir"];
  // Le niveau officiel vient du staff. Les simulations (brèche, code Oméga)
  // le changent un instant, sans rien enregistrer.
  store.del("s73.alerte", true);
  let alertLevel = D.config.alerte;
  S.alerts = ALERTS;
  S.getAlert = function () { return alertLevel; };
  S.officialAlert = function () { return D.config.alerte; };
  let applyAlert = function () {
    root.setAttribute("data-alert", alertLevel);
    let a = D.alertes[alertLevel];
    doc.querySelectorAll("[data-alert-code]").forEach(function (el) { el.textContent = a.code; });
    doc.querySelectorAll("[data-alert-title]").forEach(function (el) { el.textContent = a.titre; });
    doc.querySelectorAll("[data-alert-text]").forEach(function (el) { el.textContent = a.texte; });
  };
  S.setAlert = function (level) {
    if (ALERTS.indexOf(level) < 0) return;
    alertLevel = level;
    applyAlert();
    doc.dispatchEvent(new CustomEvent("s73:alert", { detail: { level: level } }));
  };
  // Changement du niveau OFFICIEL : réservé au mode staff, vérifié par le serveur.
  S.changerAlerte = function (level) {
    if (ALERTS.indexOf(level) < 0) return Promise.resolve(false);
    if (!S.modeStaff()) {
      S.toast("<b>Réservé au staff.</b> Seul le staff, en mode staff, change le niveau d'alerte du site.", { warn: true });
      S.sfx("deny");
      return Promise.resolve(false);
    }
    return S.api.action("alerte", { niveau: level }).then(function () {
      return S.rafraichirContenu("alerte").then(function () {
        S.toast("<b>Niveau d'alerte appliqué à tout le site :</b> " + esc(D.alertes[level].code) + ".");
        return true;
      });
    }, function (err) {
      S.toast("<b>Action refusée.</b> " + esc(err.message), { warn: true });
      S.sfx("deny");
      return false;
    });
  };
  // Demande confirmation avant de changer l'alerte officielle.
  S.proposerAlerte = function (level) {
    if (!S.modeStaff()) return S.changerAlerte(level);
    if (level === D.config.alerte) { S.toast("<b>" + esc(D.alertes[level].code) + "</b> est déjà le niveau officiel."); return; }
    S.toast("<b>Passer tout le site en " + esc(D.alertes[level].code) + " ?</b> Tous les visiteurs le verront.", {
      duration: 9000,
      actions: [["Appliquer à tout le site", function () { S.changerAlerte(level); }], ["Annuler", function () {}]]
    });
  };

  /* ---------- Notifications ------------------------------------------ */
  let toastZone;
  S.toast = function (html, opts) {
    opts = opts || {};
    if (!toastZone) {
      toastZone = doc.createElement("div");
      toastZone.className = "toast-zone";
      toastZone.setAttribute("role", "status");
      toastZone.setAttribute("aria-live", "polite");
      doc.body.appendChild(toastZone);
    }
    let t = doc.createElement("div");
    t.className = "toast" + (opts.warn ? " toast--warn" : "") + (opts.medal ? " toast--medal" : "");
    t.innerHTML = (opts.medal ? '<span class="toast__medal">' + esc(opts.medal) + "</span>" : "") + "<span>" + html +
      (opts.actions ? '<span class="toast__acts">' + opts.actions.map(function (a, i) { return '<button type="button" data-i="' + i + '">' + esc(a[0]) + "</button>"; }).join("") + "</span>" : "") + "</span>";
    if (opts.actions) t.addEventListener("click", function (e) {
      let b = e.target.closest("[data-i]");
      if (!b) return;
      opts.actions[+b.getAttribute("data-i")][1]();
      t.classList.add("is-out");
      setTimeout(function () { t.remove(); }, 320);
    });
    toastZone.appendChild(t);
    while (toastZone.children.length > 3) toastZone.removeChild(toastZone.firstChild);
    setTimeout(function () {
      t.classList.add("is-out");
      setTimeout(function () { t.remove(); }, 320);
    }, opts.duration || (opts.medal ? 5200 : 4200));
  };

  /* ---------- Carnet de service --------------------------------------- */
  let blankCarnet = function () { return { badges: {}, seen: {}, pages: {}, fav: {}, rules: {}, planning: {}, stats: {}, flags: {} }; };
  let carnet = blankCarnet();
  try {
    let raw = JSON.parse(store.get("s73.carnet") || "null");
    if (raw && typeof raw === "object") {
      Object.keys(carnet).forEach(function (k) { if (raw[k] && typeof raw[k] === "object") carnet[k] = raw[k]; });
    }
  } catch (e) { /* carnet illisible : on repart de zéro */ }
  let saveCarnet = function () { store.set("s73.carnet", JSON.stringify(carnet)); };
  let badgeReady = false;
  let RULES = {
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
  let updateBadgeCount = function () {
    let n = count(carnet.badges);
    doc.querySelectorAll("[data-badge-count]").forEach(function (el) { el.textContent = n; });
    doc.querySelectorAll("[data-badge-total]").forEach(function (el) { el.textContent = D.distinctions.length; });
    doc.querySelectorAll(".carnet-btn").forEach(function (el) {
      el.setAttribute("aria-label", "Mon carnet de service : " + n + " distinction" + (n > 1 ? "s" : "") + " sur " + D.distinctions.length);
    });
  };
  let checkBadges = function () {
    if (!badgeReady) return;
    let fresh = [];
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
  let changed = function () { saveCarnet(); checkBadges(); doc.dispatchEvent(new CustomEvent("s73:carnet")); };
  S.carnet = function () { return carnet; };
  S.isMarked = function (set, id) { return !!(carnet[set] && carnet[set][id]); };
  S.mark = function (set, id, on) {
    if (!carnet[set]) carnet[set] = {};
    if (on === false) delete carnet[set][id]; else carnet[set][id] = carnet[set][id] || Date.now();
    changed();
  };
  S.stat = function (name, val, mode) {
    let cur = carnet.stats[name] || 0;
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
    let d = date || new Date();
    let h = hash("meteo-" + d.toISOString().slice(0, 13));
    let m = d.getMonth();
    let base = [-9, -8, -6, -3, 1, 5, 8, 8, 5, 1, -4, -7][m];
    let temp = base + (h % 9) - 4;
    let ciels = ["Dégagé", "Voilé", "Nuageux", "Brouillard", temp > 1 ? "Pluie" : "Neige"];
    let hiver = m >= 10 || m <= 3;
    return {
      temp: temp,
      vent: 8 + ((h >>> 4) % 55),
      ciel: ciels[(h >>> 12) % 5],
      visi: [">10 km", "6 km", "2 km", "800 m", "150 m"][(h >>> 9) % 5],
      avalanche: 1 + ((h >>> 15) % (hiver ? 5 : 2))
    };
  };
  let meteoTxt = function () {
    let w = S.meteo();
    return "Surface " + (w.temp > 0 ? "+" : "") + w.temp + " °C · vent " + w.vent + " km/h · " + w.ciel.toLowerCase();
  };

  /* ---------- En-tête -------------------------------------------------- */
  let linkFor = function (p, cls, withLieu) {
    return '<a class="' + cls + '" href="' + p.file + '.html" data-nav="' + p.id + '"' + (p.staff ? " data-staff-only hidden" : "") + ">" +
      (withLieu ? "<b>" + esc(p.label) + "</b><small>" + esc(p.lieu) + "</small>" : esc(p.label)) + "</a>";
  };
  let buildHeader = function () {
    let slot = doc.getElementById("s73-header");
    if (!slot) return;
    let top = PAGES.filter(function (p) { return p.top; }).map(function (p) { return linkFor(p, "nav__link"); }).join("");
    let more = Object.keys(GROUPES).map(function (g) {
      let list = PAGES.filter(function (p) { return !p.top && p.groupe === g; });
      if (!list.length) return "";
      return '<div class="more__grp"><p>' + GROUPES[g] + "</p>" + list.map(function (p) { return linkFor(p, "more__link", true); }).join("") + "</div>";
    }).join("");
    let drawer = Object.keys(GROUPES).map(function (g) {
      return '<p class="drawer__grp">' + GROUPES[g] + "</p>" + PAGES.filter(function (p) { return p.groupe === g; }).map(function (p) {
        return '<a href="' + p.file + '.html" data-nav="' + p.id + '"' + (p.staff ? " data-staff-only hidden" : "") + ">" + esc(p.label) + "<small>" + esc(p.lieu) + "</small></a>";
      }).join("");
    }).join("");

    slot.outerHTML =
      '<div class="staffbar" id="staffbar" hidden></div>' +
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
        '<div class="cons-tag"><span class="cons-tag__lbl">Console staff</span><a class="cons-tag__back" href="index.html">' + ICON.arrowL + "Retour à l'intranet</a></div>" +
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
      '</div></header>' +
      '<nav class="navstrip" id="navstrip" aria-label="Navigation">' + PAGES.map(function (p) { return linkFor(p, ""); }).join("") + "</nav>" +
      '<div class="hazard" aria-hidden="true"></div><div class="lecture" aria-hidden="true"><i></i></div></div>' +
      '<div class="drawer" id="drawer" hidden role="dialog" aria-modal="true" aria-label="Menu">' +
        '<div class="drawer__head wrap"><a class="brand" href="index.html">' + S.emblem() + '<span class="brand__txt"><span class="brand__name">SITE<i>-</i>73</span></span></a>' +
        '<button type="button" class="icon-btn" id="drawer-close" aria-label="Fermer le menu">' + ICON.close + "</button></div>" +
        '<nav class="drawer__nav" aria-label="Navigation">' + drawer + "</nav>" +
      "</div>";

    // Menu « Plus »
    let mb2 = doc.getElementById("more-btn"), mp = doc.getElementById("more-pop");
    let closeMore = function () { mp.hidden = true; mb2.setAttribute("aria-expanded", "false"); };
    mb2.addEventListener("click", function (e) {
      e.stopPropagation();
      let open = mp.hidden;
      mp.hidden = !open;
      mb2.setAttribute("aria-expanded", String(open));
    });
    mp.addEventListener("click", function (e) { if (e.target.closest("a")) closeMore(); });
    doc.addEventListener("click", function (e) { if (!mp.hidden && !e.target.closest(".more")) closeMore(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !mp.hidden) { closeMore(); mb2.focus(); } });

    // Habilitation
    let btn = doc.getElementById("clr-btn"), pop = doc.getElementById("clr-pop");
    let closePop = function () { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    S.openClearance = function () {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      pop.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      let cur = pop.querySelector('[aria-checked="true"]');
      if (cur) cur.focus({ preventScroll: true });
    };
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (pop.hidden) S.openClearance(); else closePop();
    });
    pop.addEventListener("click", function (e) {
      // Connexion et mode staff : gérés plus bas, pour tout le site.
      if (e.target.closest("[data-reessayer], [data-staff-on], [data-staff-off]")) { closePop(); return; }
      let o = e.target.closest(".clr__opt");
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
    let drawerEl = doc.getElementById("drawer"), mb = doc.getElementById("menu-btn");
    let openDrawer = function () { drawerEl.hidden = false; mb.setAttribute("aria-expanded", "true"); doc.body.style.overflow = "hidden"; doc.getElementById("drawer-close").focus(); };
    S.closeDrawer = function () { if (drawerEl.hidden) return; drawerEl.hidden = true; mb.setAttribute("aria-expanded", "false"); doc.body.style.overflow = ""; };
    mb.addEventListener("click", openDrawer);
    doc.getElementById("drawer-close").addEventListener("click", function () { S.closeDrawer(); mb.focus(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !drawerEl.hidden) { S.closeDrawer(); mb.focus(); } });
  };

  let levelsHtml = function (max) {
    return '<ul class="clr__list" role="menu" aria-label="Choisir un niveau">' + D.habilitations.filter(function (h) { return h.niveau <= max; }).map(function (h) {
      return '<li><button type="button" class="clr__opt" role="menuitemradio" data-lvl="' + h.niveau + '" aria-checked="' + (h.niveau === clearance) + '">' +
        "<b>" + h.niveau + "</b><span>" + esc(h.nom) + "</span><small>" + (h.niveau === 5 ? "O5" : "N" + h.niveau) + "</small></button></li>";
    }).join("") + "</ul>";
  };
  let SOURCES = {
    staff: "Attribuée par l'administration du site.",
    defaut: "Niveau par défaut des membres. Le staff peut le relever.",
    admin: "Administrateur : accès complet."
  };
  function renderClrPop() {
    let pop = doc.getElementById("clr-pop"), btn = doc.getElementById("clr-btn");
    if (!pop) return;
    let who = sess.user ? '<div class="who">' + S.avatar(sess.user) + "<div><b>" + esc(sess.user.nom) + "</b><small>" +
      (sess.admin ? "Administrateur" : "Membre du serveur") + "</small></div></div>" : "";
    let sortir = '<a class="btn btn--sm" href="/api/auth/logout">Se déconnecter</a>';
    let out = sess.admin && sess.avertissement ? '<p class="clr__raison">⚠ ' + esc(sess.avertissement) + "</p>" : "";
    if (sess.user && sess.mdpProvisoire) out += '<p class="clr__raison">⚠ Mot de passe provisoire : <a href="connexion.html">choisis le tien</a>.</p>';
    if (sess.mode !== "live") {
      out += '<p class="clr__horsligne">Serveur indisponible</p>' +
        "<p><b>Visiteur · niveau 0</b><br>La connexion et l'espace staff reviennent dès que le serveur du site répond.</p>" +
        (S.texteRaisonHorsLigne() ? '<p class="clr__raison">⚠ ' + esc(S.texteRaisonHorsLigne()) + "</p>" : "") +
        '<button type="button" class="btn btn--signal clr__login" data-reessayer>Réessayer</button>';
    } else if (S.modeStaff()) {
      out += who + '<p class="clr__staff"><i></i>Mode staff actif</p>' +
        "<p>Ton niveau réel est " + sess.reel + ". Prévisualise le site comme le verrait un membre :</p>" + levelsHtml(sess.reel) +
        '<div class="clr__acts"><a class="btn btn--sm btn--signal" href="staff.html">Console staff</a>' +
        '<button type="button" class="btn btn--sm" data-staff-off>Quitter le mode staff</button></div>';
    } else if (sess.admin) {
      out += who + "<p><b>Administrateur · niveau " + sess.reel + "</b><br>Les commandes du staff (alerte, habilitations, communiqués) ne s'affichent qu'en mode staff.</p>" +
        '<div class="clr__acts"><button type="button" class="btn btn--sm btn--signal" data-staff-on>Activer le mode staff</button>' +
        '<a class="btn btn--sm" href="connexion.html">Mon compte</a>' + sortir + "</div>";
    } else if (!sess.user) {
      out += "<p><b>Visiteur · niveau 0</b><br>Connecte-toi avec ton identifiant : le staff du serveur t'attribue ton habilitation.</p>" +
        '<a class="btn btn--signal clr__login" href="' + S.loginUrl() + '">' + ICON.lock + "Se connecter</a>" +
        '<a class="clr__staff-link" href="' + S.loginUrl(true) + '">Pas de compte ? Créer un compte</a>';
    } else {
      out += who + "<p><b>Habilitation · niveau " + sess.reel + " · " + esc(habName(sess.reel)) + "</b><br>" + esc(SOURCES[sess.source] || SOURCES.defaut) + "</p>" +
        '<div class="clr__acts"><a class="btn btn--sm" href="connexion.html">Mon compte</a><a class="btn btn--sm" href="carnet.html">Mon carnet</a>' + sortir + "</div>";
    }
    pop.innerHTML = out;
    if (btn) btn.innerHTML = (sess.user ? S.avatar(sess.user, "av--sm") : "") + '<span class="clr__lbl">' + (S.modeStaff() ? "Staff" : "Hab.") + "</span><b data-hab-num>" + clearance + "</b>";
    renderStaffBar();
  }
  // Bandeau du mode staff, en haut de chaque page
  function renderStaffBar() {
    let bar = doc.getElementById("staffbar");
    if (!bar) return;
    if (!S.modeStaff()) { bar.hidden = true; bar.innerHTML = ""; return; }
    let cur = D.config.alerte;
    bar.innerHTML = '<div class="wrap staffbar__in">' +
      '<span class="staffbar__tag"><i></i>Mode staff</span>' +
      '<span class="staffbar__who">' + S.avatar(sess.user, "av--sm") + "<b>" + esc(sess.user ? sess.user.nom : "Staff") + "</b></span>" +
      '<label class="staffbar__ctl"><span>Alerte</span><select class="staffbar__sel" id="sb-alerte" aria-label="Niveau d\'alerte officiel">' +
        ALERTS.map(function (a) { return '<option value="' + a + '"' + (a === cur ? " selected" : "") + ">" + esc(D.alertes[a].code) + "</option>"; }).join("") + "</select></label>" +
      '<label class="staffbar__ctl"><span>Voir comme</span><select class="staffbar__sel" id="sb-voir" aria-label="Voir le site comme le niveau">' +
        D.habilitations.filter(function (h) { return h.niveau <= sess.reel; }).map(function (h) {
          return '<option value="' + h.niveau + '"' + (h.niveau === clearance ? " selected" : "") + ">N" + h.niveau + " · " + esc(h.nom) + "</option>";
        }).join("") + "</select></label>" +
      '<span class="staffbar__acts"><a class="staffbar__btn" href="staff.html">Console</a><button type="button" class="staffbar__btn" data-staff-off>Quitter</button></span>' +
    "</div>";
    bar.hidden = false;
  }
  S.renderClrPop = renderClrPop;

  let markNav = function (id) {
    doc.querySelectorAll("[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    let mb = doc.getElementById("more-btn");
    if (mb) mb.classList.toggle("is-current", !!byId[id] && !byId[id].top);
    // Barre défilante : la page courante reste visible
    let strip = doc.getElementById("navstrip"), cur = strip && strip.querySelector('[aria-current="page"]');
    if (cur && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = cur.offsetLeft - strip.clientWidth / 2 + cur.offsetWidth / 2;
  };

  /* ---------- Pied de page ------------------------------------------- */
  let buildFooter = function () {
    let slot = doc.getElementById("s73-footer");
    if (!slot) return;
    let cols = Object.keys(GROUPES).map(function (g) {
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
        '<a class="ftr__staff" href="staff.html">' + ICON.lock + "Accès staff</a>" +
        '<span class="ftr__motto">Sécuriser · Contenir · Protéger · v' + esc(D.config.version) + "</span>" +
      "</div></footer>";
  };

  /* ---------- Discord ------------------------------------------------- */
  let applyDiscord = function (scope) {
    let url = D.config.discord;
    (scope || doc).querySelectorAll("[data-discord]").forEach(function (el) {
      if (url) {
        el.setAttribute("href", url);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
        el.setAttribute("title", "Ouvre l'invitation au serveur Discord dans un nouvel onglet");
        if (!el.querySelector("svg")) el.insertAdjacentHTML("afterbegin", ICON.chat);
      } else {
        let span = doc.createElement("span");
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
  let clockFmt, dateFmt, hourFmt;
  try {
    clockFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: D.config.fuseau, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: D.config.fuseau, weekday: "long", day: "numeric", month: "long", year: "numeric" });
    hourFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: D.config.fuseau, hour: "numeric", hour12: false });
  } catch (e) {
    clockFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    dateFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    hourFmt = new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false });
  }
  let lastMeteoHour = -1;
  let tick = function () {
    let now = new Date();
    let t = clockFmt.format(now), d = dateFmt.format(now);
    doc.querySelectorAll("[data-clock]").forEach(function (el) { el.textContent = t; });
    doc.querySelectorAll("[data-date]").forEach(function (el) { el.textContent = d; });
    if (now.getHours() !== lastMeteoHour) {
      lastMeteoHour = now.getHours();
      let mt = meteoTxt();
      doc.querySelectorAll("[data-meteo]").forEach(function (el) { el.textContent = mt; });
    }
    doc.dispatchEvent(new CustomEvent("s73:tick", { detail: { now: now } }));
  };
  S.formatClock = function (d) { return clockFmt.format(d); };
  S.siteHour = function (d) { return parseInt(hourFmt.format(d || new Date()), 10) % 24; };
  S.formatCountdown = function (ms) {
    let s = Math.max(0, Math.floor(ms / 1000));
    let j = Math.floor(s / 86400); s -= j * 86400;
    let h = Math.floor(s / 3600); s -= h * 3600;
    let m = Math.floor(s / 60); s -= m * 60;
    return j + " j " + pad(h) + ":" + pad(m) + ":" + pad(s);
  };

  /* ---------- Dossier (fenêtre papier) ------------------------------ */
  let modal, modalList = [], modalIndex = 0, lastFocus = null, speaking = false;
  let scpById = {};
  D.scp.forEach(function (s) { scpById[s.id] = s; });
  let zoneById = {};
  D.zones.forEach(function (z) { zoneById[z.id] = z; });
  S.scpById = scpById;
  S.zoneById = zoneById;
  S.findScp = function (q) {
    q = norm(q).replace(/^scp[-\s]?/, "").trim();
    if (!q) return null;
    if (scpById[q]) return scpById[q];
    let num = q.replace(/^0+/, "");
    for (let i = 0; i < D.scp.length; i++) {
      let s = D.scp[i];
      if (s.id.replace(/^0+/, "") === num) return s;
      if (norm(s.code) === q || norm(s.code).replace(/^ano-/, "") === q) return s;
    }
    return null;
  };
  S.randomDossier = function () {
    let s = D.scp[Math.floor(Math.random() * D.scp.length)];
    S.openDossier(s.id);
  };

  let MENACE = ["", "Minime", "Faible", "Modérée", "Élevée", "Extrême"];
  S.menaceLabel = function (n) { return MENACE[n]; };
  let STAMPS = ["Usage officiel", "Confidentiel", "Restreint", "Secret", "Très secret", "Thaumiel"];
  S.stamps = STAMPS;

  let buildModal = function () {
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
      let id = modalList[modalIndex];
      if (e.target.closest("[data-close]")) S.closeDossier();
      else if (e.target.closest("[data-prev]")) step(-1);
      else if (e.target.closest("[data-next]")) step(1);
      else if (e.target.closest("[data-fav]")) {
        let on = !S.isMarked("fav", id);
        S.mark("fav", id, on);
        syncFav();
        S.toast(on ? "<b>Dossier suivi.</b> Retrouve-le avec le filtre « Suivis »." : "<b>Dossier retiré</b> de ta liste de suivi.");
      }
      else if (e.target.closest("[data-speak]")) toggleSpeak();
      else if (e.target.closest("[data-link]")) {
        let url = BUNDLE ? location.href.split("#")[0] + "#scp-" + id : new URL("confinement.html#scp-" + id, location.href).href;
        copyText(url, "<b>Lien copié.</b> " + esc(scpById[id].code));
      }
      else if (e.target.closest("[data-open-hab]")) { S.closeDossier(); if (S.openClearance) S.openClearance(); }
    });
    modal.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); S.closeDossier(); }
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Tab") {
        let f = modal.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        let first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  };
  let syncFav = function () {
    let b = modal.querySelector("[data-fav]");
    let on = S.isMarked("fav", modalList[modalIndex]);
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("is-on", on);
  };
  let stopSpeaking = function () {
    speaking = false;
    S.stopSpeak();
    let b = modal && modal.querySelector("[data-speak]");
    if (b) { b.innerHTML = ICON.speak; b.classList.remove("is-on"); b.setAttribute("aria-label", "Lire le dossier à voix haute"); }
  };
  let toggleSpeak = function () {
    if (speaking) { stopSpeaking(); return; }
    let s = scpById[modalList[modalIndex]];
    let txt = "Objet numéro " + s.code + ", " + s.nom + ". Classe " + D.classesObjet[s.classe].nom + ". " +
      "Procédures de confinement spéciales. " + S.redactSpeech(s.procedures) + " Description. " + S.redactSpeech(s.description);
    speaking = S.speak(txt, { onend: stopSpeaking });
    if (speaking) {
      let b = modal.querySelector("[data-speak]");
      b.innerHTML = ICON.stop;
      b.classList.add("is-on");
      b.setAttribute("aria-label", "Arrêter la lecture");
    }
  };
  let step = function (d) {
    if (modalList.length < 2) return;
    stopSpeaking();
    modalIndex = (modalIndex + d + modalList.length) % modalList.length;
    renderDossier();
    modal.querySelector(".modal__scroll").scrollTop = 0;
  };
  let renderDossier = function () {
    let s = scpById[modalList[modalIndex]];
    if (!S.isMarked("seen", s.id)) S.mark("seen", s.id, true);
    let cls = D.classesObjet[s.classe];
    let z = zoneById[s.zone];
    let meter = "";
    for (let i = 1; i <= 5; i++) meter += i <= s.menace ? "■" : "□";
    let art = modal.querySelector("[data-doc]");
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
          : '<a href="' + S.loginUrl() + '">Se connecter</a>') + "</footer>";
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
  let palette, pIndex = null, pResults = [], pSel = 0;
  let buildIndex = function () {
    let ix = [];
    let add = function (type, title, sub, run, extra) {
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
  let buildPalette = function () {
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
    let input = palette.querySelector("input");
    input.addEventListener("input", function () { runSearch(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); selectP(pSel + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); selectP(pSel - 1); }
      else if (e.key === "Enter") { e.preventDefault(); activateP(pSel); }
      else if (e.key === "Escape") { e.preventDefault(); S.closeSearch(); }
    });
    palette.addEventListener("click", function (e) {
      if (e.target.closest("[data-pclose]")) { S.closeSearch(); return; }
      let li = e.target.closest("[data-pi]");
      if (li) activateP(+li.getAttribute("data-pi"));
    });
    palette.addEventListener("mousemove", function (e) {
      let li = e.target.closest("[data-pi]");
      if (li && +li.getAttribute("data-pi") !== pSel) selectP(+li.getAttribute("data-pi"), true);
    });
  };
  let runSearch = function (q) {
    if (!pIndex) pIndex = buildIndex();
    let words = norm(q.trim()).split(/\s+/).filter(Boolean);
    let list = palette.querySelector(".palette__list");
    if (!words.length) {
      pResults = pIndex.filter(function (x) { return x.type === "Page" || x.type === "Action"; });
    } else {
      pResults = pIndex.map(function (x) {
        if (!words.every(function (w) { return x.hay.indexOf(w) >= 0; })) return null;
        let t = norm(x.title), sc = 0;
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
  let selectP = function (i, noScroll) {
    if (!pResults.length) return;
    pSel = (i + pResults.length) % pResults.length;
    palette.querySelectorAll("[data-pi]").forEach(function (li) {
      let on = +li.getAttribute("data-pi") === pSel;
      li.setAttribute("aria-selected", String(on));
      if (on && !noScroll) li.scrollIntoView({ block: "nearest" });
    });
    palette.querySelector("input").setAttribute("aria-activedescendant", "pr-" + pSel);
  };
  let activateP = function (i) {
    let x = pResults[i];
    if (!x) return;
    S.closeSearch(true);
    x.run();
  };
  S.openSearch = function (q) {
    if (!palette) buildPalette();
    if (S.closeDrawer) S.closeDrawer();
    palette.hidden = false;
    doc.body.style.overflow = "hidden";
    let input = palette.querySelector("input");
    input.value = q || "";
    runSearch(input.value);
    input.focus();
    S.sfx("tick");
  };
  S.closeSearch = function (silent) {
    if (!palette || palette.hidden) return;
    palette.hidden = true;
    if (!modal || modal.hidden) doc.body.style.overflow = "";
    if (!silent) { let b = doc.getElementById("search-btn"); if (b) b.focus(); }
  };
  doc.addEventListener("keydown", function (e) {
    let typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "") || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); S.openSearch(); }
    else if (e.key === "/" && !typing && !(palette && !palette.hidden)) { e.preventDefault(); S.openSearch(); }
  });

  /* ---------- Séquence de démarrage -------------------------------- */
  let booting = false, bootPending = false;
  let boot = function () {
    if (!settings.boot || !store.ok(true) || store.get("s73.boot", true) || reduced) { store.set("s73.boot", "1", true); return; }
    store.set("s73.boot", "1", true);
    booting = true;
    let el = doc.createElement("div");
    el.className = "boot";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<div class="boot__box"><div class="boot__logo">' + S.emblem() +
      "<div><b>SITE-73</b><small>Intranet · Fondation SCP · v" + esc(D.config.version) + "</small></div></div>" +
      '<div class="boot__log" aria-live="off"></div><div class="boot__bar"><i></i></div>' +
      '<div class="boot__foot"><span>Connexion au réseau sécurisé</span><button type="button" class="boot__skip">Passer</button></div></div>';
    doc.body.appendChild(el);
    let log = el.querySelector(".boot__log"), bar = el.querySelector(".boot__bar i");
    let w = S.meteo();
    let lines = [
      "> Initialisation du terminal ............ <span class=\"ok\">OK</span>",
      "> Liaison avec le nœud alpin ............ <span class=\"ok\">OK</span>",
      "> Conditions en surface : " + (w.temp > 0 ? "+" : "") + w.temp + " °C, vent " + w.vent + " km/h",
      "> Chargement de " + D.scp.length + " dossiers de confinement ... <span class=\"ok\">OK</span>",
      "> Niveau d'alerte : <span class=\"hl\">" + esc(D.alertes[alertLevel].code.toUpperCase()) + "</span>",
      "> Identité : <span class=\"hl\">" + (sess.user ? esc(sess.user.nom.toUpperCase()) + (sess.admin ? " (ADMINISTRATION)" : "") : "VISITEUR NON CONNECTÉ") + "</span>",
      "> Habilitation : <span class=\"hl\">NIVEAU " + clearance + " · " + esc(habName(clearance).toUpperCase()) + "</span>"
    ];
    let timers = [], done = false;
    let finish = function () {
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
  let doors;
  let buildDoors = function () {
    doors = doc.createElement("div");
    doors.className = "doors";
    doors.setAttribute("aria-hidden", "true");
    doors.innerHTML = '<div class="doors__l"></div><div class="doors__r"></div>';
    doc.body.appendChild(doors);
  };
  let parseHref = function (href) {
    let m = /^(?:\.\/)?([a-z0-9-]+)\.html(?:#([\w.~-]+))?$/i.exec(href || "");
    if (!m || !byFile[m[1]]) return null;
    return { page: byFile[m[1]], hash: m[2] || "" };
  };
  let hashHandlers = [];
  S.onHash = function (fn) { hashHandlers.push(fn); };
  let flashTarget = function (el) {
    el.classList.remove("is-target");
    void el.offsetWidth;
    el.classList.add("is-target");
    setTimeout(function () { el.classList.remove("is-target"); }, 2200);
  };
  S.flashTarget = flashTarget;
  let scrollToHash = function (h) {
    if (!h) return false;
    if (h === "contenu") {
      let mm = doc.querySelector("main:not([hidden])");
      if (mm) { mm.setAttribute("tabindex", "-1"); mm.focus(); }
      return true;
    }
    if (/^scp-/.test(h)) {
      let s = S.findScp(h.slice(4));
      if (s) { S.openDossier(s.id); return true; }
    }
    for (let i = 0; i < hashHandlers.length; i++) { if (hashHandlers[i](h)) return true; }
    let t = doc.getElementById(h);
    if (t) {
      t.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      if (t.tagName !== "SECTION" && t.tagName !== "MAIN") flashTarget(t);
      return true;
    }
    return false;
  };
  S.scrollToHash = scrollToHash;
  S.go = function (href) {
    let target = parseHref(href);
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
  let finishNav = function (target, href) {
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
    let a = e.target.closest("a[href]");
    if (!a || a.target === "_blank") return;
    let href = a.getAttribute("href");
    if (href.charAt(0) === "#") {
      let h = href.slice(1);
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
  let KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
  let kPos = 0;
  doc.addEventListener("keydown", function (e) {
    let k = (e.key || "").toLowerCase();
    kPos = k === KONAMI[kPos] ? kPos + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kPos === KONAMI.length) { kPos = 0; S.omega(); }
  });
  S.omega = function () {
    if (doc.querySelector(".omega")) return;
    let prev = alertLevel;
    S.setAlert("noir");
    let el = doc.createElement("div");
    el.className = "omega";
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-label", "Protocole Oméga");
    el.innerHTML = '<div class="omega__box">' + S.emblem() + '<p class="label">Transmission prioritaire · Conseil O5</p>' +
      "<h2>Protocole Oméga</h2><p>Votre curiosité a été notée. Un membre de l'unité Alpha-1 se présentera à votre poste dans les prochaines minutes.</p>" +
      '<p class="omega__small">Cet incident n\'a jamais eu lieu.</p><button type="button" class="btn">Reprendre le service</button></div>';
    doc.body.appendChild(el);
    [220, 180, 150].forEach(function (f, i) { S.tone(f, 0.5, { type: "sawtooth", vol: 0.05, delay: i * 0.45 }); });
    let close = function () { el.remove(); S.setAlert(prev); S.flag("omega"); };
    el.querySelector("button").addEventListener("click", close);
    el.querySelector("button").focus();
  };

  /* ---------- Mode « un seul fichier » (aperçu) -------------------- */
  let showView = function (id, h) {
    let views = doc.querySelectorAll("main[data-view]");
    let found = false;
    views.forEach(function (v) {
      let on = v.getAttribute("data-view") === id;
      v.hidden = !on;
      if (on) found = true;
    });
    if (!found) return;
    currentPage = id;
    doc.body.setAttribute("data-page", id);
    markNav(id);
    let p = byId[id];
    doc.title = id === "accueil" ? "Intranet du Site-73" : p.label + " · Site-73";
    window.scrollTo(0, 0);
    try { history.replaceState(null, "", "#" + (h || id)); } catch (e) { /* ignoré */ }
    if (h) setTimeout(function () { scrollToHash(h); }, 60);
    let main = doc.querySelector('main[data-view="' + id + '"]');
    if (main) { main.setAttribute("tabindex", "-1"); main.focus({ preventScroll: true }); }
    S.mark("pages", id, true);
    if (main) { reinitAnimations(main); setTimeout(function () { S.animer(main); }, 30); }
    doc.dispatchEvent(new CustomEvent("s73:view", { detail: { id: id } }));
  };
  S.currentPage = function () { return currentPage; };

  /* ---------- Session : chargement et API staff -------------------- */
  let reindex = function () {
    scpById = {}; D.scp.forEach(function (x) { scpById[x.id] = x; });
    zoneById = {}; D.zones.forEach(function (z) { zoneById[z.id] = z; });
    S.scpById = scpById; S.zoneById = zoneById; pIndex = null;
  };
  let appliquerContenu = function (p) {
    Object.keys(p.data).forEach(function (k) { D[k] = p.data[k]; });
    reindex();
  };

  let appelStaff = function (options) {
    return fetch("/api/staff", Object.assign({ credentials: "same-origin" }, options)).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.erreur || "Erreur du serveur (" + r.status + ").");
        return j;
      });
    });
  };
  let sansServeur = function () { return Promise.reject(new Error("Serveur indisponible : l'espace staff a besoin du Worker du site.")); };
  S.api = {
    etat: function () { return sess.mode === "live" ? appelStaff({}) : sansServeur(); },
    action: function (action, corps) {
      if (sess.mode !== "live") return sansServeur();
      return appelStaff({ method: "POST", headers: { "content-type": "application/json", "x-s73": "1" }, body: JSON.stringify(Object.assign({ action: action }, corps)) });
    }
  };
  // Après une action du staff : recharge le contenu et prévient les pages.
  S.rafraichirContenu = function (action) {
    let fin = function () {
      if (action === "alerte") {
        alertLevel = D.config.alerte;
        applyAlert();
        S.alarme(alertLevel);
        renderStaffBar();
        doc.dispatchEvent(new CustomEvent("s73:alert", { detail: { level: alertLevel } }));
      }
      doc.dispatchEvent(new CustomEvent("s73:dynamic"));
    };
    if (sess.mode !== "live") { fin(); return Promise.resolve(); }
    return fetch("/api/contenu", { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json(); })
      .then(function (p) { if (p && p.data) appliquerContenu(p); fin(); }, fin);
  };

  let niveauVu = function () {
    let voir = S.modeStaff() ? parseInt(store.get("s73.voir", true), 10) : NaN;
    return !isNaN(voir) && voir >= 0 && voir <= sess.reel ? voir : sess.reel;
  };
  // Serveur injoignable : visiteur, sans connexion ni mode staff.
  let passerHorsLigne = function () {
    sess.mode = "horsligne";
    sess.admin = false; sess.user = null; sess.reel = 0; sess.source = "visiteur"; sess.fiche = null;
    sess.principal = false; sess.mdpProvisoire = false;
    clearance = 0;
  };
  let applySessionUI = function () {
    root.setAttribute("data-staff", S.modeStaff() ? "on" : "off");
    doc.querySelectorAll("[data-staff-only]").forEach(function (el) { el.hidden = !S.modeStaff(); });
    doc.querySelectorAll("[data-public-only]").forEach(function (el) { el.hidden = S.modeStaff(); });
    doc.querySelectorAll("[data-session-nom]").forEach(function (el) { el.textContent = sess.user ? sess.user.nom : "Visiteur"; });
    doc.querySelectorAll("[data-session-mode]").forEach(function (el) { el.textContent = sess.mode === "live" ? "En ligne" : "Hors ligne"; });
    renderClrPop();
    updateClearanceUI();
    doc.dispatchEvent(new CustomEvent("s73:session"));
  };
  // Après un changement de session : tout le site se remet à jour.
  let sessionChangee = function (prev) {
    rerender(prev);
    applySessionUI();
    doc.dispatchEvent(new CustomEvent("s73:clearance", { detail: { level: clearance, prev: prev } }));
    doc.dispatchEvent(new CustomEvent("s73:dynamic"));
    checkBadges();
  };
  S.entrerModeStaff = function () {
    if (!sess.admin) { if (!doc.getElementById("staff-guard")) S.go("staff.html"); return false; }
    let prev = clearance;
    activerStaff(true);
    clearance = niveauVu();
    sessionChangee(prev);
    S.animStaff("on");
    return true;
  };
  S.quitterModeStaff = function () {
    let prev = clearance;
    activerStaff(false);
    store.del("s73.voir", true);
    clearance = sess.reel;
    sessionChangee(prev);
    S.animStaff("off");
  };
  doc.addEventListener("click", function (e) {
    if (e.target.closest("[data-reessayer]")) location.reload();
    else if (e.target.closest("[data-staff-on]")) S.entrerModeStaff();
    else if (e.target.closest("[data-staff-off]")) S.quitterModeStaff();
  });
  doc.addEventListener("change", function (e) {
    if (e.target.id === "sb-alerte") {
      let v = e.target.value;
      e.target.value = D.config.alerte;
      S.proposerAlerte(v);
    } else if (e.target.id === "sb-voir") {
      S.setClearance(e.target.value);
    }
  });

  // Pourquoi le serveur ne répond pas (affiché dans « Hab. » et au sas staff)
  let raisonHorsLigne = null;
  S.texteRaisonHorsLigne = function () {
    let r = raisonHorsLigne;
    if (!r) return "";
    let local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (r.code === "fichier") return "Page ouverte sans serveur (fichier local ou aperçu) : lance « npm run dev » dans le dossier site-73.";
    if (r.code === "statique" || r.statut === 404) {
      return local ? "Normal avec Live Server : lance « npm run dev » pour faire tourner le vrai serveur."
        : "Le Worker Cloudflare ne tourne pas : le site est servi comme de simples fichiers. Redéploie avec « npm run deploy » ou l'import GitHub, pas en glisser-déposer.";
    }
    if (r.code === "http") return "Le serveur a répondu une erreur (code " + r.statut + ")" + (r.detail ? " : " + r.detail : "") + ". Diagnostic : /api/etat";
    return r.code === "delai" ? "Le serveur n'a pas répondu à temps." : "Le serveur est injoignable.";
  };
  let horsLigne = function (raison) {
    raisonHorsLigne = raison;
    if (window.console) console.warn("Site-73 : serveur indisponible. " + S.texteRaisonHorsLigne());
    passerHorsLigne();
  };
  // Adresse relative, pour que le site marche aussi dans un sous-dossier.
  // Sur Cloudflare, le Worker y répond avec le contenu et la session.
  let chargerSession = function () {
    if (BUNDLE || location.protocol === "file:") { horsLigne({ code: "fichier" }); return Promise.resolve(); }
    let ctrl = window.AbortController ? new AbortController() : null;
    let minuteur = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    return fetch("api/contenu.json", { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (r.ok) return r.json().catch(function () { return null; });
        return r.json().catch(function () { return {}; }).then(function (j) {
          let e = new Error("http " + r.status);
          e.statut = r.status; e.detail = j && j.erreur;
          throw e;
        });
      })
      .then(function (p) {
        clearTimeout(minuteur);
        // Réponse qui ne vient pas du Worker (hébergement de fichiers simples)
        if (!p || p.mode !== "live" || !p.data) { horsLigne({ code: "statique" }); return; }
        appliquerContenu(p);
        sess.mode = "live";
        sess.avertissement = p.avertissement || null;
        sess.codeInscription = !!(p.comptes && p.comptes.codeInscription);
        if (p.avertissement && window.console) console.warn("Site-73 : " + p.avertissement);
        if (p.session) {
          sess.user = { id: p.session.id, nom: p.session.nom };
          sess.admin = !!p.session.admin;
          sess.principal = !!p.session.principal;
          sess.mdpProvisoire = !!p.session.mdpProvisoire;
          sess.reel = p.session.habilitation;
          sess.source = p.session.source;
          sess.fiche = p.session.fiche || null;
        } else {
          sess.user = null; sess.admin = false; sess.reel = 0; sess.source = "visiteur"; sess.fiche = null;
          sess.principal = false; sess.mdpProvisoire = false;
        }
        clearance = niveauVu();
      })
      .catch(function (e) {
        clearTimeout(minuteur);
        horsLigne(e && e.statut ? { code: "http", statut: e.statut, detail: e.detail } : { code: e && e.name === "AbortError" ? "delai" : "reseau" });
      });
  };
  let apresSession = function () {
    alertLevel = D.config.alerte;
    applyAlert();
    // Le staff a changé l'alerte depuis la dernière visite : alarme une fois.
    let vue = store.get("s73.alerte.vue");
    if (vue && vue !== alertLevel) setTimeout(function () { S.alarme(alertLevel); }, BUNDLE || booting || bootPending ? 3200 : 700);
    else store.set("s73.alerte.vue", alertLevel);
    doc.querySelectorAll("[data-last-update]").forEach(function (el) {
      el.textContent = fmtDate(D.archives.map(function (a) { return a.date; }).sort().pop());
    });
    applySessionUI();
  };
  let MESSAGES = {
    ok: [false, function () { return "<b>Connecté · " + esc(sess.user ? sess.user.nom : "") + ".</b> Habilitation niveau " + sess.reel + " (" + esc(habName(sess.reel)) + ")."; }],
    bienvenue: [false, function () { return "<b>Compte créé · bienvenue au Site-73, " + esc(sess.user ? sess.user.nom : "") + ".</b> Habilitation niveau " + sess.reel + " (" + esc(habName(sess.reel)) + ") : le staff la relève selon ton rôle."; }],
    motdepasse: [false, "<b>Mot de passe changé.</b> Tes autres appareils ont été déconnectés."],
    fermee: [false, "<b>Déconnecté.</b> À bientôt au Site-73."]
  };
  let messageConnexion = function () {
    let q = /[?&]connexion=([a-z]+)/.exec(location.search);
    if (!q || !MESSAGES[q[1]]) return;
    let m = MESSAGES[q[1]];
    setTimeout(function () { S.toast(typeof m[1] === "function" ? m[1]() : m[1], { warn: m[0], duration: 6000 }); }, booting ? 2600 : 300);
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { /* ignoré */ }
  };

  /* ---------- Apparitions au défilement & compteurs ------------------ */
  let LISTES = ".cells, .sectors, .groups, .units, .steps, .badges, .evt-list, .tl, .articles, .codes, .clearance, .classes, .pclasses, .glossary, .zone-index, .st-list, .comms, .stats, .seen-grid, .faq, .plan-list, .status, .hero__facts, .st-journal, .ticks";
  let BLOCS = ".sec__head, .sec__row, .memo, .daily, .next, .toolbar, .map-layout, .dept, .quiz, .crt, .creator, .gen, .m914-layout, .g173, .simon, .pa, .phon, .proc, .cta-band, .evt-hero, .cal, .table-wrap, .rules-toc, .al-choix, .adm__card, .adm__stats, .adm__form, .adm__apercu, .idcard-stage, .settings, .compte, .proto-ctrl, .game-side, .creator__caption, .output";
  let observateur = null;
  let compter = function (el) {
    if (reduced || el.getAttribute("data-compte")) return;
    let txt = el.textContent, m = /\d[\d\s  ]*/.exec(txt);
    if (!m) return;
    let cible = parseInt(m[0].replace(/\D/g, ""), 10);
    if (!(cible > 1)) return;
    el.setAttribute("data-compte", "1");
    let avant = txt.slice(0, m.index), apres = txt.slice(m.index + m[0].length), debut = null;
    let etape = function (t) {
      if (debut === null) debut = t;
      let k = Math.min(1, (t - debut) / 1100), v = Math.round(cible * (1 - Math.pow(1 - k, 3)));
      el.textContent = avant + v.toLocaleString("fr-FR").replace(/ /g, " ") + (m[0].match(/\s$/) ? " " : "") + apres;
      if (k < 1) requestAnimationFrame(etape);
    };
    requestAnimationFrame(etape);
  };
  let reveler = function (el) {
    if (el.classList.contains("rv-wait")) {
      Array.prototype.forEach.call(el.children, function (c, i) { c.style.setProperty("--i", Math.min(i, 14)); });
      el.classList.remove("rv-wait");
      el.classList.add("rv-go");
      setTimeout(function () { el.classList.remove("rv-go"); }, 2200);
    } else if (el.classList.contains("rv-wait-b")) {
      el.classList.remove("rv-wait-b");
      el.classList.add("rv-go-b");
      setTimeout(function () { el.classList.remove("rv-go-b"); }, 1200);
    }
    el.querySelectorAll("[data-compter]").forEach(compter);
  };
  // Prépare les blocs et listes d'une zone : ceux déjà à l'écran s'animent tout de suite,
  // les autres attendent d'entrer dans l'écran.
  S.animer = function (zone) {
    if (reduced || !zone) return;
    if (!observateur && "IntersectionObserver" in window) {
      observateur = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (en) {
          if (!en.isIntersecting) return;
          observateur.unobserve(en.target);
          reveler(en.target);
        });
      }, { rootMargin: "0px 0px -8% 0px" });
    }
    let h = window.innerHeight || 800;
    let preparer = function (el, cls) {
      if (el.getAttribute("data-rv") || el.closest(".rv-wait, .rv-wait-b, [hidden]")) return;
      el.setAttribute("data-rv", "1");
      el.classList.add(cls);
      if (!observateur || el.getBoundingClientRect().top < h * 0.92) reveler(el);
      else observateur.observe(el);
    };
    zone.querySelectorAll(BLOCS).forEach(function (el) { preparer(el, "rv-wait-b"); });
    zone.querySelectorAll(LISTES).forEach(function (el) { if (el.children.length) preparer(el, "rv-wait"); });
    zone.querySelectorAll("[data-compter]").forEach(function (el) {
      if (!el.closest(".rv-wait, .rv-wait-b") && el.getBoundingClientRect().top < h) compter(el);
    });
  };
  // Rejoue l'apparition d'une liste après un filtre ou une recherche.
  S.rejouer = function (liste) {
    if (reduced || !liste || liste.classList.contains("rv-wait")) return;
    Array.prototype.forEach.call(liste.children, function (c, i) { c.style.setProperty("--i", Math.min(i, 14)); });
    liste.classList.remove("rv-go");
    void liste.offsetWidth;
    liste.classList.add("rv-go");
    clearTimeout(liste.__rv);
    liste.__rv = setTimeout(function () { liste.classList.remove("rv-go"); }, 2200);
  };
  let reinitAnimations = function (zone) {
    zone.querySelectorAll("[data-rv]").forEach(function (el) {
      el.removeAttribute("data-rv");
      el.classList.remove("rv-wait", "rv-wait-b", "rv-go", "rv-go-b");
      if (observateur) observateur.unobserve(el);
    });
    zone.querySelectorAll("[data-compte]").forEach(function (el) { el.removeAttribute("data-compte"); });
  };

  /* ---------- Mode staff : sas, alarme, effets ------------------------ */
  // Écran plein « Accès autorisé » / « Mode staff désactivé »
  S.animStaff = function (sens) {
    let nom = sess.user ? sess.user.nom : "";
    let msg = sens === "on"
      ? "<b>Mode staff activé.</b> Les commandes du staff apparaissent en haut de chaque page. Tu peux prévisualiser le site niveau par niveau."
      : "<b>Mode staff désactivé.</b> Tu vois l'intranet comme les membres.";
    if (reduced) { S.toast(msg); S.sfx(sens === "on" ? "ok" : "tick"); return; }
    let el = doc.createElement("div");
    el.className = "acces acces--" + sens;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<div class="acces__vol acces__vol--h"></div><div class="acces__vol acces__vol--b"></div>' +
      '<div class="acces__c"><div class="acces__ring">' + S.emblem() + "</div>" +
      '<p class="acces__k">' + (sens === "on" ? "Identité vérifiée · " + esc(nom) : "Fermeture de session") + "</p>" +
      '<p class="acces__t">' + (sens === "on" ? "Accès autorisé" : "Mode staff désactivé") + "</p>" +
      '<p class="acces__s">' + (sens === "on" ? "Console staff · Site-73" : "Retour à l'intranet") + "</p></div>";
    doc.body.appendChild(el);
    S.sfx(sens === "on" ? "badge" : "door");
    setTimeout(function () { el.classList.add("is-out"); }, sens === "on" ? 1500 : 1100);
    setTimeout(function () { el.remove(); S.toast(msg); }, sens === "on" ? 2100 : 1600);
  };
  // Alarme quand le niveau d'alerte officiel change
  S.alarme = function (level) {
    let A = D.alertes[level];
    if (!A) return;
    try { store.set("s73.alerte.vue", level); } catch (e) { /* ignoré */ }
    if (reduced) return;
    let el = doc.createElement("div");
    el.className = "alarme";
    el.setAttribute("aria-hidden", "true");
    el.style.setProperty("--c", "var(--a-" + level + ")");
    el.innerHTML = '<span class="alarme__gyro alarme__gyro--g"></span><span class="alarme__gyro alarme__gyro--d"></span>' +
      '<div class="alarme__bande"><p class="alarme__k">Niveau d\'alerte du site</p><p class="alarme__t">' + esc(A.code) + '</p><p class="alarme__s">' + esc(A.titre) + "</p></div>";
    doc.body.appendChild(el);
    if (level === "rouge" || level === "noir") { S.tone(880, 0.35, { type: "sawtooth", to: 440, vol: 0.04 }); S.tone(880, 0.35, { type: "sawtooth", to: 440, vol: 0.04, delay: 0.45 }); }
    else S.sfx("open");
    setTimeout(function () { el.classList.add("is-out"); }, 2300);
    setTimeout(function () { el.remove(); }, 2900);
  };

  // Barre de progression de lecture sous l'en-tête
  let prog = null, progRaf = 0;
  let majProgression = function () {
    progRaf = 0;
    if (!prog) return;
    let max = doc.documentElement.scrollHeight - window.innerHeight;
    prog.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ")";
  };
  window.addEventListener("scroll", function () { if (!progRaf) progRaf = requestAnimationFrame(majProgression); }, { passive: true });
  window.addEventListener("resize", function () { if (!progRaf) progRaf = requestAnimationFrame(majProgression); });

  // Onde au clic sur les boutons
  doc.addEventListener("pointerdown", function (e) {
    if (reduced) return;
    let b = e.target.closest(".btn, .seg button, .adm__nav button, .adm__rac, .al-carte, .staffbar__btn");
    if (!b || b.disabled) return;
    let r = b.getBoundingClientRect();
    let zone = doc.createElement("span");
    zone.className = "onde";
    zone.setAttribute("aria-hidden", "true");
    let t = Math.max(r.width, r.height) * 2.2;
    zone.innerHTML = '<i style="width:' + t + "px;height:" + t + "px;left:" + (e.clientX - r.left - t / 2) + "px;top:" + (e.clientY - r.top - t / 2) + 'px"></i>';
    b.appendChild(zone);
    setTimeout(function () { zone.remove(); }, 700);
  });

  // Lueur qui suit le pointeur sur les cartes
  let LUEUR = ".stat, .st-item, .badge, .adm__card, .adm__rac, .adm__stat, .fiche, .status__cell, .unit, .group, .step, .evt, .article, .code-card";
  let lueurRaf = 0, lueurEv = null;
  doc.addEventListener("pointermove", function (e) {
    if (reduced || e.pointerType === "touch") return;
    lueurEv = e;
    if (lueurRaf) return;
    lueurRaf = requestAnimationFrame(function () {
      lueurRaf = 0;
      let el = lueurEv.target.closest && lueurEv.target.closest(LUEUR);
      if (!el) return;
      let r = el.getBoundingClientRect();
      el.style.setProperty("--lx", (lueurEv.clientX - r.left) + "px");
      el.style.setProperty("--ly", (lueurEv.clientY - r.top) + "px");
      el.classList.add("lueur");
    });
  }, { passive: true });

  // Neige sur l'accueil (le site est à 2 140 m d'altitude)
  let neige = function () {
    let hero = doc.querySelector(".hero");
    if (!hero || hero.querySelector(".neige")) return;
    let cv = doc.createElement("canvas");
    cv.className = "neige";
    cv.setAttribute("aria-hidden", "true");
    hero.insertBefore(cv, hero.firstChild);
    let ctx = cv.getContext && cv.getContext("2d");
    if (!ctx) return;
    let W = 0, H = 0, dpr = 1, flocons = [], vent = 0;
    let taille = function () {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hero.clientWidth; H = hero.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let n = Math.round(Math.min(90, W * H / 9000));
      while (flocons.length < n) flocons.push({ x: Math.random() * W, y: Math.random() * H, r: .6 + Math.random() * 1.8, v: .25 + Math.random() * .7, o: .2 + Math.random() * .5, p: Math.random() * 6.28 });
      flocons.length = n;
    };
    taille();
    window.addEventListener("resize", taille);
    hero.addEventListener("pointermove", function (e) { let r = hero.getBoundingClientRect(); vent = ((e.clientX - r.left) / r.width - .5) * 1.2; });
    let visible = true;
    if (window.IntersectionObserver) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(hero);
    let boucle = function () {
      requestAnimationFrame(boucle);
      if (!visible || doc.hidden || root.getAttribute("data-motion") === "reduit") { if (cv.style.opacity !== "0") cv.style.opacity = "0"; return; }
      cv.style.opacity = "";
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < flocons.length; i++) {
        let f = flocons[i];
        f.p += .01;
        f.y += f.v;
        f.x += Math.sin(f.p) * .3 + vent * f.v;
        if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; }
        if (f.x > W + 4) f.x = -4; else if (f.x < -4) f.x = W + 4;
        ctx.globalAlpha = f.o;
        ctx.fillStyle = "#E8F0EE";
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, 6.2832);
        ctx.fill();
      }
    };
    requestAnimationFrame(boucle);
  };

  /* ---------- Démarrage ----------------------------------------------- */
  buildHeader();
  buildFooter();
  buildDoors();
  prog = doc.querySelector(".lecture i");
  majProgression();
  neige();
  let vig = doc.createElement("div");
  vig.className = "vignette";
  vig.setAttribute("aria-hidden", "true");
  doc.body.appendChild(vig);
  let cadre = doc.createElement("div");
  cadre.className = "cadre-staff";
  cadre.setAttribute("aria-hidden", "true");
  cadre.innerHTML = "<span>Mode staff</span>";
  doc.body.appendChild(cadre);

  applyAlert();
  updateClearanceUI();
  updateBadgeCount();
  applyDiscord();
  doc.querySelectorAll("[data-last-update]").forEach(function (el) {
    let last = D.archives.map(function (a) { return a.date; }).sort().pop();
    el.textContent = fmtDate(last);
  });
  doc.querySelectorAll("[data-emblem]").forEach(function (el) { el.innerHTML = S.emblem(); });
  let fill = function (sel, val) { doc.querySelectorAll(sel).forEach(function (el) { el.textContent = val; }); };
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
    let h0 = (location.hash || "").slice(1);
    let start = "accueil", sub = "";
    if (byId[h0]) start = h0;
    else if (/^scp-/.test(h0)) { start = "confinement"; sub = h0; }
    else if (/^zone-/.test(h0)) { start = "plan"; sub = h0; }
    else if (/^dept-/.test(h0)) { start = "personnel"; sub = h0; }
    else if (/^evt-/.test(h0)) { start = "evenements"; sub = h0; }
    else if (h0) {
      let t0 = doc.getElementById(h0);
      let v0 = t0 && t0.closest("main[data-view]");
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
    let hr = S.siteHour();
    if (hr >= 0 && hr < 5) carnet.flags.nuit = true;
    saveCarnet();
    badgeReady = true;
    S.animer(doc.querySelector("main:not([hidden])"));
    if (BUNDLE || bootPending) boot();
    messageConnexion();
    // L'appareil demande moins d'animations : on le signale une fois par session.
    if (reduced && !choixMouvement && systemeReduit && !store.get("s73.motion.info", true)) {
      store.set("s73.motion.info", "1", true);
      setTimeout(function () {
        S.toast("<b>Animations réduites.</b> Ton appareil demande moins d'animations, alors l'intranet les a coupées. Tu peux les réactiver.", {
          duration: 15000,
          actions: [
            ["Activer les animations", function () { S.setMotion("on"); S.toast("<b>Animations activées.</b> Tu peux changer ce choix dans Mon carnet → Réglages."); }],
            ["Garder réduites", function () { S.setMotion("off"); }]
          ]
        });
      }, 900);
    }
    setTimeout(function () { if (!booting) checkBadges(); }, 700);
    if (BUNDLE) {
      if (S._startHash) setTimeout(function () { scrollToHash(S._startHash); }, 80);
    } else if (location.hash) {
      setTimeout(function () { scrollToHash(location.hash.slice(1)); }, 60);
    }
  };
})();
