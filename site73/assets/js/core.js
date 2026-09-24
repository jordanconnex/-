/* ==========================================================================
   SITE-73 · NOYAU
   En-tête, pied de page, horloge, habilitation, niveau d'alerte, caviardage,
   dossiers, notifications, séquence de démarrage et transitions entre pages.
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
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + MOIS[parseInt(p[1], 10) - 1] + " " + p[0];
  };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  S.util = { esc: esc, norm: norm, hash: hash, fmtDate: fmtDate, pad: pad, MOIS: MOIS };

  /* ---------- Pages ---------------------------------------------------- */
  var PAGES = [
    { id: "accueil",     file: "index",       label: "Accueil",   lieu: "Niveau −1" },
    { id: "confinement", file: "confinement", label: "Dossiers",  lieu: "Niveau −5" },
    { id: "plan",        file: "plan",        label: "Plan",      lieu: "0 → −600 m" },
    { id: "personnel",   file: "personnel",   label: "Personnel", lieu: "Niveau −1" },
    { id: "archives",    file: "archives",    label: "Archives",  lieu: "Niveau −7" },
    { id: "reglement",   file: "reglement",   label: "Règlement", lieu: "Niveau −1" },
    { id: "rejoindre",   file: "rejoindre",   label: "Rejoindre", lieu: "Porte A" },
    { id: "terminal",    file: "terminal",    label: "Terminal",  lieu: "Niveau −1", cache: true }
  ];
  S.pages = PAGES;
  var byFile = {};
  PAGES.forEach(function (p) { byFile[p.file] = p; });
  var currentPage = (doc.body && doc.body.getAttribute("data-page")) || "accueil";

  /* ---------- Emblème ------------------------------------------------- */
  S.emblem = function (cls) {
    var arrows = [0, 120, 240].map(function (a) {
      return '<path transform="rotate(' + a + ' 50 50)" d="M45 1.5H55V16.5H62.5L50 31L37.5 16.5H45Z"/>';
    }).join("");
    return '<svg class="' + (cls || "") + '" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<circle cx="50" cy="50" r="41.5" fill="none" stroke="currentColor" stroke-width="8"/>' +
      '<circle cx="50" cy="50" r="18.5" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<g fill="currentColor" style="stroke: var(--emb-bg, #0C1215)" stroke-width="3.5" paint-order="stroke">' + arrows + "</g></svg>";
  };

  var ICON = {
    term: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M4 6l6 6-6 6M12 18h8"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 12h17M14 6l6 6-6 6"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h.01M12 10h.01M15 10h.01" stroke-linecap="round" stroke-width="2.6"/></svg>'
  };
  S.icon = ICON;

  /* ---------- Habilitation ------------------------------------------- */
  var clearance = parseInt(store.get("s73.hab"), 10);
  if (isNaN(clearance) || clearance < 0 || clearance > 5) clearance = D.config.habilitationParDefaut;
  S.getClearance = function () { return clearance; };
  var habName = function (n) { return D.habilitations[n].nom; };
  S.habName = habName;

  /* ---------- Caviardage ---------------------------------------------- */
  var TOKEN = /\[\[(\d)\|([\s\S]*?)\]\]|\[(DONNÉES SUPPRIMÉES|SUPPRIMÉ)\]/g;
  var supOnly = function (t) {
    return esc(t).replace(/\[(DONNÉES SUPPRIMÉES|SUPPRIMÉ)\]/g, '<span class="sup">[$1]</span>');
  };
  S.redact = function (text, prev) {
    var out = "", last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(text))) {
      out += esc(text.slice(last, m.index));
      if (m[1]) {
        var n = +m[1], inner = m[2];
        if (clearance >= n) {
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
      last = TOKEN.lastIndex;
    }
    return out + esc(text.slice(last));
  };
  S.redactPlain = function (text) {
    return text.replace(/\[\[(\d)\|([\s\S]*?)\]\]/g, function (_, n, inner) {
      return clearance >= +n ? inner : "\u0000" + "█".repeat(Math.min(Math.max(inner.length, 6), 42)) + "\u0001";
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
    var prev = clearance;
    clearance = n;
    store.set("s73.hab", n);
    updateClearanceUI();
    rerender(prev);
    doc.dispatchEvent(new CustomEvent("s73:clearance", { detail: { level: n, prev: prev } }));
    if (!(opts && opts.silent)) {
      var diff = n > prev ? "Informations déclassifiées." : n < prev ? "Informations reclassifiées." : "Aucun changement.";
      S.toast("<b>Habilitation · niveau " + n + "</b> " + esc(habName(n)) + ". " + diff);
    }
  };

  doc.addEventListener("click", function (e) {
    var bar = e.target.closest(".rd");
    if (bar) denied(bar);
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
    S.toast("<b>Accès refusé.</b> Niveau " + bar.getAttribute("data-lvl") + " requis, votre habilitation est de niveau " +
      clearance + ". Modifiez-la avec le bouton « Hab. » en haut de page.", { warn: true });
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
    if (!toastZone) {
      toastZone = doc.createElement("div");
      toastZone.className = "toast-zone";
      toastZone.setAttribute("role", "status");
      toastZone.setAttribute("aria-live", "polite");
      doc.body.appendChild(toastZone);
    }
    var t = doc.createElement("div");
    t.className = "toast" + (opts && opts.warn ? " toast--warn" : "");
    t.innerHTML = "<span>" + html + "</span>";
    toastZone.appendChild(t);
    while (toastZone.children.length > 3) toastZone.removeChild(toastZone.firstChild);
    setTimeout(function () {
      t.classList.add("is-out");
      setTimeout(function () { t.remove(); }, 320);
    }, (opts && opts.duration) || 4200);
  };

  /* ---------- En-tête -------------------------------------------------- */
  var navLinks = function (cls, withLieu) {
    return PAGES.filter(function (p) { return withLieu || !p.cache; }).map(function (p) {
      return '<a class="' + cls + '" href="' + p.file + '.html" data-nav="' + p.id + '">' + esc(p.label) +
        (withLieu ? "<small>" + esc(p.lieu) + "</small>" : "") + "</a>";
    }).join("");
  };

  var buildHeader = function () {
    var slot = doc.getElementById("s73-header");
    if (!slot) return;
    var levels = D.habilitations.map(function (h) {
      return '<li><button type="button" class="clr__opt" role="menuitemradio" data-lvl="' + h.niveau + '" aria-checked="false">' +
        "<b>" + h.niveau + "</b><span>" + esc(h.nom) + "</span><small>" + (h.niveau === 5 ? "O5" : "N" + h.niveau) + "</small></button></li>";
    }).join("");
    slot.outerHTML =
      '<div class="sysbar"><div class="wrap sysbar__in">' +
        '<div class="sysbar__group"><span>Fondation SCP · Réseau sécurisé</span></div>' +
        '<div class="sysbar__group sysbar__group--wide"><span>Site-73 · Massif alpin</span><span>Liaison chiffrée<i class="dot"></i></span></div>' +
        '<div class="sysbar__group"><span>Heure du site <b data-clock>--:--:--</b></span></div>' +
      "</div></div>" +
      '<div class="bar-sticky"><header class="bar"><div class="wrap bar__in">' +
        '<a class="brand" href="index.html" aria-label="Site-73, accueil">' + S.emblem() +
          '<span class="brand__txt"><span class="brand__name">SITE<i>-</i>73</span><span class="brand__sub">Intranet · Fondation SCP</span></span></a>' +
        '<nav class="nav" aria-label="Navigation principale">' + navLinks("nav__link") + "</nav>" +
        '<div class="bar__tools">' +
          '<a class="alert-chip" href="index.html#statut" title="Niveau d\'alerte du site"><i></i><span data-alert-code></span></a>' +
          '<div class="clr">' +
            '<button type="button" class="clr__btn" id="clr-btn" aria-haspopup="true" aria-expanded="false" aria-controls="clr-pop" title="Votre niveau d\'habilitation">' +
              '<span class="clr__lbl">Hab.</span><b data-hab-num></b></button>' +
            '<div class="clr__pop" id="clr-pop" hidden><p><b>Niveau d\'habilitation</b><br>Il détermine les informations visibles dans les dossiers et les archives.</p>' +
              '<ul class="clr__list" role="menu" aria-label="Choisir un niveau">' + levels + "</ul></div>" +
          "</div>" +
          '<a class="icon-btn" href="terminal.html" data-nav="terminal" title="Terminal" aria-label="Ouvrir le terminal">' + ICON.term + "</a>" +
          '<button type="button" class="icon-btn menu-btn" id="menu-btn" aria-expanded="false" aria-controls="drawer" aria-label="Ouvrir le menu">' + ICON.menu + "</button>" +
        "</div>" +
      '</div></header><div class="hazard" aria-hidden="true"></div></div>' +
      '<div class="drawer" id="drawer" hidden role="dialog" aria-modal="true" aria-label="Menu">' +
        '<div class="drawer__head wrap"><a class="brand" href="index.html">' + S.emblem() + '<span class="brand__txt"><span class="brand__name">SITE<i>-</i>73</span></span></a>' +
        '<button type="button" class="icon-btn" id="drawer-close" aria-label="Fermer le menu">' + ICON.close + "</button></div>" +
        '<nav class="drawer__nav" aria-label="Navigation">' + navLinks("", true) + "</nav>" +
      "</div>";

    // Habilitation
    var btn = doc.getElementById("clr-btn"), pop = doc.getElementById("clr-pop");
    var closePop = function () { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = pop.hidden;
      pop.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open) { var cur = pop.querySelector('[aria-checked="true"]'); if (cur) cur.focus(); }
    });
    pop.addEventListener("click", function (e) {
      var o = e.target.closest(".clr__opt");
      if (!o) return;
      S.setClearance(o.getAttribute("data-lvl"));
      closePop();
      btn.focus();
    });
    doc.addEventListener("click", function (e) { if (!pop.hidden && !e.target.closest(".clr")) closePop(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pop.hidden) { closePop(); btn.focus(); } });

    // Menu mobile
    var drawer = doc.getElementById("drawer"), mb = doc.getElementById("menu-btn");
    var openDrawer = function () { drawer.hidden = false; mb.setAttribute("aria-expanded", "true"); doc.body.style.overflow = "hidden"; doc.getElementById("drawer-close").focus(); };
    S.closeDrawer = function () { if (drawer.hidden) return; drawer.hidden = true; mb.setAttribute("aria-expanded", "false"); doc.body.style.overflow = ""; };
    mb.addEventListener("click", openDrawer);
    doc.getElementById("drawer-close").addEventListener("click", function () { S.closeDrawer(); mb.focus(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !drawer.hidden) { S.closeDrawer(); mb.focus(); } });
  };

  var markNav = function (id) {
    doc.querySelectorAll("[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  };

  /* ---------- Pied de page ------------------------------------------- */
  var buildFooter = function () {
    var slot = doc.getElementById("s73-footer");
    if (!slot) return;
    var c = D.config;
    slot.outerHTML =
      '<footer class="ftr">' + S.emblem("ftr__mark") +
      '<div class="wrap ftr__in">' +
        '<div class="ftr__brand"><a class="brand" href="index.html">' + S.emblem() +
          '<span class="brand__txt"><span class="brand__name">SITE<i>-</i>73</span><span class="brand__sub">Installation de confinement alpine</span></span></a>' +
          "<p>Serveur de jeu de rôle communautaire dans l'univers de la Fondation SCP. Chercheurs, gardes, FIM et Classe-D : le site recrute.</p></div>" +
        '<div><h2>Intranet</h2><ul class="ftr__links">' + PAGES.map(function (p) {
          return '<li><a href="' + p.file + '.html">' + esc(p.label) + "</a></li>";
        }).join("") + "</ul></div>" +
        '<div><h2>Communauté</h2><ul class="ftr__links">' +
          '<li><a data-discord-link href="rejoindre.html">Discord du Site-73</a></li>' +
          '<li><a href="rejoindre.html#fiche">Créer sa fiche personnage</a></li>' +
          '<li><a href="reglement.html#examen">Examen d\'aptitude</a></li>' +
          '<li><a href="https://scp-wiki.wikidot.com/" target="_blank" rel="noopener">Wiki SCP (anglais)</a></li>' +
          '<li><a href="http://fondationscp.wikidot.com/" target="_blank" rel="noopener">Wiki SCP francophone</a></li>' +
        "</ul></div>" +
      "</div>" +
      '<div class="wrap ftr__legal">' +
        "<span>Projet de fans, non affilié au Wiki SCP. Contenus inspirés de la Fondation SCP (<a href=\"https://scp-wiki.wikidot.com/licensing-guide\" target=\"_blank\" rel=\"noopener\">scp-wiki.wikidot.com</a>), sous licence CC BY-SA 3.0.</span>" +
        '<span class="ftr__motto">Sécuriser · Contenir · Protéger · v' + esc(c.version) + "</span>" +
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
  var clockFmt, dateFmt;
  try {
    clockFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: D.config.fuseau, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: D.config.fuseau, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch (e) {
    clockFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    dateFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  var tick = function () {
    var now = new Date();
    var t = clockFmt.format(now), d = dateFmt.format(now);
    doc.querySelectorAll("[data-clock]").forEach(function (el) { el.textContent = t; });
    doc.querySelectorAll("[data-date]").forEach(function (el) { el.textContent = d; });
    doc.dispatchEvent(new CustomEvent("s73:tick", { detail: { now: now } }));
  };
  S.formatClock = function (d) { return clockFmt.format(d); };

  /* ---------- Dossier (fenêtre papier) ------------------------------ */
  var modal, modalList = [], modalIndex = 0, lastFocus = null;
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

  var MENACE = ["", "Minime", "Faible", "Modérée", "Élevée", "Extrême"];
  S.menaceLabel = function (n) { return MENACE[n]; };
  var STAMPS = ["Usage officiel", "Confidentiel", "Restreint", "Secret", "Très secret", "Thaumiel"];

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
          '<button type="button" class="icon-btn" data-next aria-label="Dossier suivant">' + ICON.next + "</button></div>" +
          '<span class="label" data-pos></span>' +
          '<button type="button" class="icon-btn" data-close aria-label="Fermer le dossier">' + ICON.close + "</button>" +
        "</div>" +
        '<div class="modal__scroll"><article class="doc paper" data-doc></article></div>' +
      "</div>";
    doc.body.appendChild(modal);
    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) S.closeDossier();
      else if (e.target.closest("[data-prev]")) step(-1);
      else if (e.target.closest("[data-next]")) step(1);
      else if (e.target.closest("[data-open-hab]")) { S.closeDossier(); var b = doc.getElementById("clr-btn"); if (b) b.click(); }
    });
    modal.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); S.closeDossier(); }
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Tab") {
        var f = modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  };
  var step = function (d) {
    if (modalList.length < 2) return;
    modalIndex = (modalIndex + d + modalList.length) % modalList.length;
    renderDossier();
    modal.querySelector(".modal__scroll").scrollTop = 0;
  };
  var renderDossier = function () {
    var s = scpById[modalList[modalIndex]];
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
        '<button type="button" data-open-hab>Changer d\'habilitation</button></footer>';
    S.redactInto(art.querySelector('[data-part="proc"]'), s.procedures);
    S.redactInto(art.querySelector('[data-part="desc"]'), s.description);
    modal.querySelector("[data-pos]").textContent = (modalIndex + 1) + " / " + modalList.length;
    modal.querySelector("[data-prev]").disabled = modalList.length < 2;
    modal.querySelector("[data-next]").disabled = modalList.length < 2;
  };
  S.openDossier = function (id, list) {
    if (!scpById[id]) return;
    if (!modal) buildModal();
    modalList = list && list.length ? list.slice() : D.scp.map(function (s) { return s.id; });
    modalIndex = Math.max(0, modalList.indexOf(id));
    if (modalList.indexOf(id) < 0) { modalList.unshift(id); modalIndex = 0; }
    lastFocus = doc.activeElement;
    renderDossier();
    modal.hidden = false;
    doc.body.style.overflow = "hidden";
    modal.querySelector(".modal__scroll").scrollTop = 0;
    modal.querySelector("[data-close].icon-btn").focus();
  };
  S.closeDossier = function () {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    doc.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  doc.addEventListener("s73:clearance", function () {
    if (modal && !modal.hidden) renderDossier();
  });

  /* ---------- Séquence de démarrage -------------------------------- */
  var boot = function () {
    if (!store.ok(true) || store.get("s73.boot", true) || reduced) { store.set("s73.boot", "1", true); return; }
    store.set("s73.boot", "1", true);
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
    var lines = [
      "> Initialisation du terminal ............ <span class=\"ok\">OK</span>",
      "> Liaison avec le nœud alpin ............ <span class=\"ok\">OK</span>",
      "> Vérification des signatures ........... <span class=\"ok\">OK</span>",
      "> Chargement de " + D.scp.length + " dossiers de confinement ... <span class=\"ok\">OK</span>",
      "> Niveau d'alerte : <span class=\"hl\">" + esc(D.alertes[alertLevel].code.toUpperCase()) + "</span>",
      "> Habilitation détectée : <span class=\"hl\">NIVEAU " + clearance + " · " + esc(habName(clearance).toUpperCase()) + "</span>"
    ];
    var timers = [], done = false;
    var finish = function () {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      el.classList.add("is-done");
      setTimeout(function () { el.remove(); }, 520);
      doc.removeEventListener("keydown", finish);
    };
    lines.forEach(function (l, i) {
      timers.push(setTimeout(function () {
        log.innerHTML += (i ? "\n" : "") + l;
        bar.style.width = ((i + 1) / lines.length) * 100 + "%";
      }, 180 + i * 290));
    });
    timers.push(setTimeout(function () {
      log.innerHTML += '\n\n<span class="boot__granted">Accès autorisé</span>';
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
  var scrollToHash = function (h) {
    if (!h) return false;
    if (h === "contenu") {
      var m = doc.querySelector("main:not([hidden])");
      if (m) { m.setAttribute("tabindex", "-1"); m.focus(); }
      return true;
    }
    if (/^scp-/.test(h)) {
      var s = S.findScp(h.slice(4));
      if (s) { S.openDossier(s.id); return true; }
    }
    var t = doc.getElementById(h);
    if (t) { t.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); return true; }
    return false;
  };
  S.go = function (href) {
    var target = parseHref(href);
    if (!target) { location.href = href; return; }
    if (S.closeDrawer) S.closeDrawer();
    var samePage = BUNDLE ? target.page.id === currentPage : target.page.id === currentPage;
    if (samePage) {
      if (target.hash) scrollToHash(target.hash);
      else window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      return;
    }
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
    if (href.charAt(0) === "#" && BUNDLE) {
      e.preventDefault();
      scrollToHash(href.slice(1));
      return;
    }
    if (!parseHref(href)) return;
    e.preventDefault();
    S.go(href);
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && doors) doors.classList.remove("is-closed");
  });

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
    var p = PAGES.filter(function (x) { return x.id === id; })[0];
    doc.title = id === "accueil" ? "Intranet du Site-73" : p.label + " · Site-73";
    window.scrollTo(0, 0);
    try { history.replaceState(null, "", "#" + (h || id)); } catch (e) { /* ignoré */ }
    if (h) setTimeout(function () { scrollToHash(h); }, 60);
    var main = doc.querySelector('main[data-view="' + id + '"]');
    if (main) { main.setAttribute("tabindex", "-1"); main.focus({ preventScroll: true }); }
    doc.dispatchEvent(new CustomEvent("s73:view", { detail: { id: id } }));
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
  tick();
  setInterval(tick, 1000);

  if (BUNDLE) {
    var h = (location.hash || "").slice(1);
    var start = "accueil", sub = "";
    if (PAGES.some(function (p) { return p.id === h; })) start = h;
    else if (/^scp-/.test(h)) { start = "confinement"; sub = h; }
    else if (h) {
      var t = doc.getElementById(h);
      var v = t && t.closest("main[data-view]");
      if (v) { start = v.getAttribute("data-view"); sub = h; }
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
      boot();
    }
  }

  // Appelé par pages.js une fois les pages construites.
  S.ready = function () {
    if (BUNDLE) {
      boot();
      if (S._startHash) setTimeout(function () { scrollToHash(S._startHash); }, 80);
    } else if (location.hash) {
      var hh = location.hash.slice(1);
      if (/^scp-/.test(hh)) scrollToHash(hh);
    }
  };
})();
