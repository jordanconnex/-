/* ==========================================================================
   SITE-73 · CONSOLE STAFF
   Mode à part : un sas d'accès, puis une console à onglets. Il faut être
   administrateur (rôle Discord en ligne, code d'accès en démonstration)
   et activer le mode staff. Toutes les actions passent par S.api : le
   serveur (/api/staff) vérifie la session Discord à chaque appel.
   En mode démonstration, un faux serveur local répond à sa place.
   Chaque onglet est un panneau avec son propre titre dans staff.html.
   ========================================================================== */
(function () {
  "use strict";

  let S = window.S73, D = S.data, doc = document;
  let U = S.util, esc = U.esc, norm = U.norm;
  let $ = function (s, r) { return (r || doc).querySelector(s); };
  let $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };

  let dtFmt;
  try { dtFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: D.config.fuseau, dateStyle: "short", timeStyle: "short" }); }
  catch (e) { dtFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }); }
  let quand = function (iso) { return iso ? dtFmt.format(new Date(iso)) : "—"; };
  let SOURCE = {
    admin: ["Administrateur", "var(--signal)"],
    staff: ["Réglée par le staff", "var(--c-attente)"],
    role: ["Rôle Discord", "var(--c-sur)"],
    defaut: ["Par défaut", "var(--text-3)"]
  };
  let STATUT = {
    service: ["En service", "var(--c-sur)"],
    attente: ["En attente", "var(--signal)"],
    archive: ["Archivée", "var(--text-3)"]
  };
  let ONGLETS = ["tableau", "alerte", "membres", "fiches", "communiques", "evenements", "journal"];
  let aVenir = function (e) { return new Date(e.date).getTime() + e.duree * 60000 > Date.now(); };

  S.staffModule = function () {
    let app = $("#staff-app");
    if (!app) return;
    let guard = $("#staff-guard");
    let etat = null, filtre = { q: "", niveau: "all" }, filtreFiches = { q: "", statut: "all" }, confirmer = null;

    // Hauteur de l'en-tête collant : le menu de la console se cale dessous
    let majBarre = function () {
      let b = doc.querySelector(".bar-sticky");
      if (b && b.offsetHeight) doc.documentElement.style.setProperty("--barre", b.offsetHeight + "px");
    };
    majBarre();
    window.addEventListener("resize", majBarre);

    /* ---------- Sas d'accès ------------------------------------------ */
    let sasBody = $("#staff-guard-body");
    let minuteurBlocage = null;
    let renderGuard = function () {
      let se = S.session();
      clearInterval(minuteurBlocage);
      guard.classList.remove("is-refus");
      if (se.mode === "live") {
        if (!se.user) {
          sasBody.innerHTML = '<p class="sas__etat"><i></i>Identité inconnue</p>' +
            "<p>Connecte-toi avec ton compte Discord. Seuls les membres qui ont un rôle d'administrateur sur le serveur franchissent ce sas.</p>" +
            '<a class="btn btn--signal" href="' + S.loginUrl() + '">' + S.icon.chat + "Se connecter avec Discord</a>";
        } else if (!se.admin) {
          guard.classList.add("is-refus");
          sasBody.innerHTML = '<p class="sas__etat sas__etat--refus"><i></i>Accès refusé</p>' +
            "<p>Ton compte <b>" + esc(se.user.nom) + "</b> n'a pas le rôle d'administrateur sur le serveur Discord. Tu peux consulter l'intranet selon ton habilitation (niveau " + se.reel + ").</p>" +
            '<a class="btn" href="index.html">Retour à l\'intranet</a>';
        } else {
          sasBody.innerHTML = '<p class="sas__etat sas__etat--ok"><i></i>Identité vérifiée par Discord</p>' +
            '<div class="who">' + S.avatar(se.user) + "<div><b>" + esc(se.user.nom) + "</b><small>Administrateur du serveur</small></div></div>" +
            "<p>Active le mode staff pour ouvrir la console et afficher les commandes du staff sur tout le site.</p>" +
            '<button type="button" class="btn btn--signal" data-staff-on>' + S.icon.shield + "Activer le mode staff</button>";
        }
        return;
      }
      if (se.admin) {
        sasBody.innerHTML = '<p class="sas__etat sas__etat--ok"><i></i>Code vérifié</p>' +
          '<button type="button" class="btn btn--signal" data-staff-on>' + S.icon.shield + "Activer le mode staff</button>";
        return;
      }
      sasBody.innerHTML = '<p class="sas__etat"><i></i>Vérification requise</p>' +
        '<form class="sas__form" id="sas-form" autocomplete="off">' +
          '<label class="field"><span>Nom de code <small>(journal)</small></span><input class="input" id="sas-nom" maxlength="40" placeholder="Dr Varenne"></label>' +
          '<label class="field"><span>Code d\'accès staff</span><input class="input sas__code" id="sas-code" type="password" required autocomplete="off" spellcheck="false"></label>' +
          '<div class="sas__actions"><button type="submit" class="btn btn--signal" id="sas-ok">' + S.icon.lock + "Vérifier</button></div>" +
          '<p class="sas__msg" id="sas-msg" role="status" aria-live="polite"></p>' +
        "</form>" +
        '<p class="sas__note">Site hors ligne (démonstration) : l\'accès staff est protégé par un code, qui se règle dans <code>config.codeStaff</code>. En ligne, il passe par les rôles administrateur Discord, vérifiés par le serveur.</p>' +
        (S.texteRaisonDemo && S.texteRaisonDemo() ? '<p class="sas__note sas__raison">⚠ ' + esc(S.texteRaisonDemo()) + "</p>" : "");
      let form = $("#sas-form"), msg = $("#sas-msg"), ok = $("#sas-ok"), code = $("#sas-code");
      let bloquer = function () {
        let reste = S.blocageStaff();
        ok.disabled = !!reste;
        code.disabled = !!reste;
        if (reste) msg.textContent = "Trop d'essais. Réessaie dans " + Math.ceil(reste / 1000) + " s.";
        else { clearInterval(minuteurBlocage); if (/Trop d'essais|bloqué/.test(msg.textContent)) msg.textContent = ""; }
      };
      if (S.blocageStaff()) { bloquer(); minuteurBlocage = setInterval(bloquer, 500); }
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        ok.disabled = true;
        guard.classList.add("is-verif");
        S.sfx("tick");
        setTimeout(function () {
          guard.classList.remove("is-verif");
          let r = S.connexionStaffDemo($("#sas-nom").value, code.value);
          if (r.ok) return;
          ok.disabled = false;
          code.value = "";
          msg.textContent = r.message;
          guard.classList.remove("is-refus");
          void guard.offsetWidth;
          guard.classList.add("is-refus");
          S.sfx("deny");
          if (r.bloque) { bloquer(); minuteurBlocage = setInterval(bloquer, 500); }
          else code.focus();
        }, 650);
      });
    };

    /* ---------- Onglets ------------------------------------------------ */
    let nav = $("#adm-nav");
    let onglet = S.store.get("s73.console", true);
    if (ONGLETS.indexOf(onglet) < 0) onglet = "tableau";
    let horizontal = function () { return getComputedStyle(nav).flexDirection === "row"; };
    let ouvrir = function (id, opts) {
      if (ONGLETS.indexOf(id) < 0) return;
      opts = opts || {};
      onglet = id;
      S.store.set("s73.console", id, true);
      $$("[data-onglet]", nav).forEach(function (b) {
        let on = b.getAttribute("data-onglet") === id;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        if (on) {
          if (opts.focus) b.focus({ preventScroll: true });
          if (horizontal()) nav.scrollLeft = b.offsetLeft - nav.clientWidth / 2 + b.offsetWidth / 2;
        }
      });
      $$("[data-panneau]", app).forEach(function (p) { p.hidden = p.getAttribute("data-panneau") !== id; });
      let panneau = $("#p-" + id);
      if (opts.defiler && panneau) {
        // Le haut du panneau (son titre) doit être visible sous l'en-tête
        let barre = parseInt(getComputedStyle(doc.documentElement).getPropertyValue("--barre"), 10) || 72;
        let marge = horizontal() ? nav.offsetHeight : 0;
        let y = panneau.getBoundingClientRect().top + window.scrollY - barre - marge - 16;
        if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y) });
      }
      if (panneau && S.animer) S.animer(panneau);
      if (id === "fiches") dessinerCarte();
      S.sfx("tick");
    };
    nav.addEventListener("click", function (e) {
      let b = e.target.closest("[data-onglet]");
      if (b) ouvrir(b.getAttribute("data-onglet"), { defiler: true });
    });
    nav.addEventListener("keydown", function (e) {
      let i = ONGLETS.indexOf(onglet), n = ONGLETS.length, k = e.key, cible = null;
      if (k === "ArrowDown" || k === "ArrowRight") cible = ONGLETS[(i + 1) % n];
      else if (k === "ArrowUp" || k === "ArrowLeft") cible = ONGLETS[(i - 1 + n) % n];
      else if (k === "Home") cible = ONGLETS[0];
      else if (k === "End") cible = ONGLETS[n - 1];
      if (cible) { e.preventDefault(); ouvrir(cible, { focus: true }); }
    });
    app.addEventListener("click", function (e) {
      let r = e.target.closest("[data-aller]");
      if (r) ouvrir(r.getAttribute("data-aller"), { defiler: true });
    });

    /* ---------- Chargement --------------------------------------------- */
    let charger = function () {
      if (!S.modeStaff()) {
        app.hidden = true;
        guard.hidden = false;
        renderGuard();
        return;
      }
      let ouverture = app.hidden;
      guard.hidden = true;
      app.hidden = false;
      majBarre();
      let se = S.session();
      $("#adm-id").innerHTML = '<span class="adm__badge"><i></i>Mode staff</span>' +
        '<div class="who">' + S.avatar(se.user) + "<div><b>" + esc(se.user ? se.user.nom : "Staff") + "</b><small>Administrateur · " + (se.mode === "live" ? "Discord" : "démo") + "</small></div></div>";
      ouvrir(onglet);
      // Le focus était dans le sas, qui vient de disparaître
      if (ouverture) { let tb = $('[aria-selected="true"]', nav); if (tb) tb.focus({ preventScroll: true }); }
      let chargement = $("#st-loading");
      chargement.hidden = false;
      chargement.textContent = "Chargement des données du staff…";
      S.api.etat().then(function (e) {
        etat = e;
        chargement.hidden = true;
        render();
        S.animer(app);
      }, function (err) {
        chargement.textContent = "Chargement impossible : " + err.message;
      });
    };

    let agir = function (action, corps, message, bouton) {
      if (bouton) bouton.disabled = true;
      return S.api.action(action, corps).then(function (e) {
        etat = e;
        render();
        S.toast(message);
        S.sfx("ok");
        S.rafraichirContenu(action);
        return true;
      }, function (err) {
        S.toast("<b>Action refusée.</b> " + esc(err.message), { warn: true });
        S.sfx("deny");
        return false;
      }).then(function (ok) {
        if (bouton) bouton.disabled = false;
        return ok;
      });
    };

    /* ---------- Rendu --------------------------------------------------- */
    let render = function () {
      if (!etat) return;
      etat.fiches = etat.fiches || [];
      renderCompteurs();
      renderTableau();
      renderAlerte();
      renderMembres();
      renderFiches();
      renderCommuniques();
      renderEvenements();
      renderJournal();
    };

    let renderCompteurs = function () {
      let cur = etat.etat.alerte;
      $$("[data-cons-alerte]").forEach(function (el) { el.textContent = D.alertes[cur].code.replace("Code ", ""); el.style.setProperty("--c", "var(--a-" + cur + ")"); });
      let n = {
        membres: etat.membres.length,
        fiches: etat.fiches.filter(function (f) { return f.statut === "attente"; }).length || etat.fiches.length,
        communiques: etat.communiques.length,
        evenements: etat.evenements.filter(aVenir).length
      };
      $$("[data-cons-count]").forEach(function (el) { el.textContent = n[el.getAttribute("data-cons-count")]; });
    };

    let renderTableau = function () {
      let par = [0, 0, 0, 0, 0, 0];
      etat.membres.forEach(function (m) { par[m.habilitation]++; });
      let total = etat.membres.length || 1;
      let tuile = function (v, lbl, aller) {
        return '<button type="button" class="adm__stat" data-aller="' + aller + '"><b class="mono" data-compter>' + v + "</b><span>" + lbl + "</span></button>";
      };
      $("#st-resume").innerHTML =
        tuile(etat.membres.length, "Membres connus", "membres") +
        tuile(etat.membres.filter(function (m) { return m.override !== null && !m.admin; }).length, "Réglés par le staff", "membres") +
        tuile(etat.fiches.filter(function (f) { return f.statut === "service"; }).length, "Fiches en service", "fiches") +
        tuile(etat.fiches.filter(function (f) { return f.statut === "attente"; }).length, "Fiches en attente", "fiches") +
        tuile(etat.evenements.filter(aVenir).length, "Événements à venir", "evenements") +
        '<div class="adm__repart"><span class="label">Répartition des habilitations</span><div class="stack" aria-hidden="true">' + par.map(function (n, i) {
          return n ? '<i style="--c:' + S.levelColors[i] + ";flex:" + n / total + '" title="Niveau ' + i + " : " + n + '"></i>' : "";
        }).join("") + '</div><ul class="legend">' + par.map(function (n, i) {
          return n ? '<li style="--c:' + S.levelColors[i] + '">N' + i + " · " + n + "</li>" : "";
        }).join("") + "</ul></div>";

      let cur = etat.etat.alerte, A = D.alertes[cur];
      let carte = $("#st-dash-alerte");
      carte.style.setProperty("--c", "var(--a-" + cur + ")");
      carte.innerHTML = '<h3 class="label">Alerte officielle</h3><p class="adm__alerte">' + esc(A.code) + "</p><p>" + esc(A.titre) + ".</p>" +
        '<p class="muted">' + (etat.etat.par ? "Réglée par " + esc(etat.etat.par) + " · " + esc(quand(etat.etat.le)) : "Valeur du fichier de contenu.") + "</p>" +
        '<button type="button" class="btn btn--sm" data-aller="alerte">Changer</button>';

      let proch = etat.evenements.filter(aVenir).sort(function (a, b) { return new Date(a.date) - new Date(b.date); }).slice(0, 4);
      $("#st-dash-evt").innerHTML = proch.length ? proch.map(function (e) {
        let T = D.typesEvenement[e.type] || D.typesEvenement.evenement;
        return '<li><i style="--c:' + T.couleur + '"></i><span><b>' + esc(e.titre) + "</b><small>" + esc(S.fmtEvent(e.date)) + "</small></span></li>";
      }).join("") : '<li class="muted">Aucun événement à venir.</li>';
      $("#st-dash-journal").innerHTML = etat.journal.length ? etat.journal.slice(0, 5).map(function (j) {
        return "<li><i></i><span><b>" + esc(j.par) + "</b> · " + esc(j.action) + "<small>" + esc(quand(j.le)) + "</small></span></li>";
      }).join("") : '<li class="muted">Aucune action enregistrée.</li>';
    };

    /* ---------- Alerte ------------------------------------------------- */
    let alerteChoisie = null;
    let renderAlerte = function () {
      let cur = etat.etat.alerte;
      if (!alerteChoisie || alerteChoisie === cur) alerteChoisie = cur;
      $("#st-alerte-seg").innerHTML = S.alerts.map(function (a) {
        let A = D.alertes[a];
        return '<button type="button" role="radio" class="al-carte' + (a === cur ? " is-actuel" : "") + '" data-alerte="' + a + '" aria-checked="' + (a === alerteChoisie) + '" style="--c: var(--a-' + a + ')">' +
          '<span class="al-carte__code">' + esc(A.code) + '</span><span class="al-carte__titre">' + esc(A.titre) + "</span>" +
          '<span class="al-carte__txt">' + esc(A.texte) + "</span>" + (a === cur ? '<span class="al-carte__actuel">Actuel</span>' : "") + "</button>";
      }).join("");
      majChoixAlerte();
    };
    let majChoixAlerte = function () {
      let cur = etat.etat.alerte, change = alerteChoisie !== cur;
      $("#st-alerte-apply").disabled = !change;
      $("#st-alerte-info").innerHTML = change
        ? "Passer de <b>" + esc(D.alertes[cur].code) + "</b> à <b>" + esc(D.alertes[alerteChoisie].code) + "</b> pour tous les visiteurs ?"
        : "Niveau actuel : <b>" + esc(D.alertes[cur].code) + "</b>" + (etat.etat.par ? ', réglé par ' + esc(etat.etat.par) + " le " + esc(quand(etat.etat.le)) + "." : ", valeur du fichier de contenu.") + " Choisis un autre niveau pour le changer.";
    };
    $("#st-alerte-seg").addEventListener("click", function (e) {
      let b = e.target.closest("[data-alerte]");
      if (!b || !etat) return;
      alerteChoisie = b.getAttribute("data-alerte");
      $$("[data-alerte]", this).forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
      majChoixAlerte();
    });
    $("#st-alerte-apply").addEventListener("click", function () {
      if (!etat || alerteChoisie === etat.etat.alerte) return;
      let niveau = alerteChoisie;
      agir("alerte", { niveau: niveau }, "<b>Niveau d'alerte appliqué à tout le site :</b> " + esc(D.alertes[niveau].code) + ".", this);
    });

    /* ---------- Membres ------------------------------------------------ */
    let renderMembres = function () {
      let q = norm(filtre.q.trim());
      let liste = etat.membres.filter(function (m) {
        if (filtre.niveau !== "all" && String(m.habilitation) !== filtre.niveau) return false;
        return !q || norm(m.nom + " " + (m.pseudo || "") + " " + m.id).indexOf(q) >= 0;
      });
      $("#st-membres-count").textContent = liste.length + " membre" + (liste.length > 1 ? "s" : "") + " affiché" + (liste.length > 1 ? "s" : "") + " sur " + etat.membres.length;
      let body = $("#st-membres");
      if (!liste.length) {
        body.innerHTML = '<tr><td colspan="5" class="muted">' + (etat.membres.length ? "Aucun membre ne correspond." : "Aucun membre pour l'instant. Les membres apparaissent ici après leur première connexion avec Discord.") + "</td></tr>";
        return;
      }
      body.innerHTML = liste.map(function (m) {
        let src = SOURCE[m.source] || SOURCE.defaut;
        let select = m.admin
          ? '<span class="mono">5 · ' + esc(S.habName(5)) + "</span>"
          : '<select class="select st-hab" data-id="' + esc(m.id) + '" aria-label="Habilitation de ' + esc(m.nom) + '">' +
            D.habilitations.map(function (h) {
              return '<option value="' + h.niveau + '"' + (h.niveau === m.habilitation ? " selected" : "") + ">" + h.niveau + " · " + esc(h.nom) + "</option>";
            }).join("") + "</select>";
        return "<tr>" +
          '<td data-label="Membre"><div class="who">' + S.avatar(m) + "<div><b>" + esc(m.nom) + "</b><small>" + esc(m.pseudo ? "@" + m.pseudo : m.id) + "</small></div></div></td>" +
          '<td data-label="Habilitation">' + select + "</td>" +
          '<td data-label="Origine"><span class="chip" style="--c:' + src[1] + '">' + src[0] + "</span>" +
            (m.source === "staff" && m.modifiePar ? '<small class="st-by">par ' + esc(m.modifiePar) + ", " + esc(quand(m.modifieLe)) + "</small>" : "") +
            (m.source === "staff" && m.roleHab !== null ? '<small class="st-by">rôle Discord : niveau ' + m.roleHab + "</small>" : "") + "</td>" +
          '<td data-label="Dernière visite" class="mono st-date">' + esc(quand(m.derniereVisite)) + "</td>" +
          '<td data-label="">' + (m.override !== null && !m.admin ? '<button type="button" class="btn btn--sm" data-reset="' + esc(m.id) + '">Rendre au rôle</button>' : "") + "</td></tr>";
      }).join("");
    };
    $("#st-q").addEventListener("input", function () { filtre.q = this.value; if (etat) renderMembres(); });
    $("#st-niveau").addEventListener("change", function () { filtre.niveau = this.value; if (etat) renderMembres(); });
    $("#st-membres").addEventListener("change", function (e) {
      let sel = e.target.closest(".st-hab");
      if (!sel) return;
      let m = etat.membres.filter(function (x) { return x.id === sel.getAttribute("data-id"); })[0];
      agir("habilitation", { id: m.id, niveau: parseInt(sel.value, 10) }, "<b>" + esc(m.nom) + "</b> passe au niveau " + sel.value + " (" + esc(S.habName(+sel.value)) + ").", sel);
    });
    $("#st-membres").addEventListener("click", function (e) {
      let b = e.target.closest("[data-reset]");
      if (!b) return;
      let m = etat.membres.filter(function (x) { return x.id === b.getAttribute("data-reset"); })[0];
      agir("habilitation", { id: m.id, niveau: null }, "<b>" + esc(m.nom) + "</b> retrouve l'habilitation de ses rôles Discord.", b);
    });

    /* ---------- Fiches -------------------------------------------------- */
    let FF = {};
    ["id", "membre", "prenom", "nom", "age", "statut", "dept", "grade", "roblox", "apparence", "perso", "histoire", "comp"].forEach(function (k) { FF[k] = $("#st-fiche-" + k); });
    let ficheForm = $("#st-fiche-form"), ficheCarte = $("#st-fiche-card"), ficheErreur = $("#st-fiche-erreur");
    FF.dept.innerHTML = D.departements.map(function (d) { return '<option value="' + d.id + '">' + esc(d.nom) + "</option>"; }).join("");
    let remplirGrades = function (garder) {
      let d = D.departements.filter(function (x) { return x.id === FF.dept.value; })[0] || D.departements[0];
      FF.grade.innerHTML = d.grades.map(function (g) { return '<option value="' + esc(g[0]) + '">' + esc(g[0]) + " · hab. " + g[1] + "</option>"; }).join("");
      FF.grade.value = garder && d.grades.some(function (g) { return g[0] === garder; }) ? garder : d.grades[0][0];
    };
    let membreDe = function (id) { return etat && id ? etat.membres.filter(function (m) { return m.id === id; })[0] : null; };
    let remplirMembres = function () {
      let garde = FF.membre.value;
      FF.membre.innerHTML = '<option value="">Aucun (personnage non lié)</option>' + (etat ? etat.membres : []).map(function (m) {
        let deja = (etat.fiches || []).some(function (f) { return f.discordId === m.id && f.id !== FF.id.value && f.statut !== "archive"; });
        return '<option value="' + esc(m.id) + '">' + esc(m.nom) + (m.pseudo ? " (@" + esc(m.pseudo) + ")" : "") + (deja ? " · a déjà une fiche" : "") + "</option>";
      }).join("");
      FF.membre.value = garde && membreDe(garde) ? garde : "";
    };
    let lireFiche = function () {
      let v = {};
      Object.keys(FF).forEach(function (k) { v[k] = FF[k].value.trim(); });
      return v;
    };
    let MSG_PHOTO = {
      roblox: "✓ Photo Roblox sur la carte.", discord: "Photo de profil Discord du membre.", "discord-secours": "Pseudo Roblox introuvable : photo Discord du membre à la place.",
      introuvable: "Pseudo Roblox introuvable.", invalide: "3 à 20 caractères : lettres, chiffres ou _.", attente: "Recherche de l'avatar Roblox…",
      demo: "La photo Roblox s'affiche quand le site est en ligne.", aucune: ""
    };
    let dessinerCarte = function () {
      if (!ficheCarte) return;
      let v = lireFiche(), m = membreDe(v.membre);
      // Photo Discord du membre lié (jamais celle de l'admin connecté)
      v.avatar = m && m.avatar ? m.avatar : null;
      S.renderIdCard(ficheCarte, v, function (e) { $("#st-fiche-photo").textContent = MSG_PHOTO[e] || ""; });
      let statut = STATUT[v.statut] || STATUT.service;
      $("#st-fiche-texte").textContent = S.texteFiche(v, ["> **Statut :** " + statut[0]].concat(m ? ["> **Membre Discord :** " + m.nom + (m.pseudo ? " (@" + m.pseudo + ")" : "")] : []));
    };
    let modeFiche = function (f) {
      ficheErreur.textContent = "";
      FF.id.value = f ? f.id : "";
      remplirMembres();
      FF.membre.value = f && f.discordId && membreDe(f.discordId) ? f.discordId : "";
      ["prenom", "nom", "age", "roblox", "apparence", "perso", "histoire", "comp"].forEach(function (k) { FF[k].value = f && f[k] != null ? f[k] : ""; });
      FF.statut.value = f ? f.statut : "service";
      FF.dept.value = f ? f.dept : "securite";
      if (!FF.dept.value) FF.dept.value = D.departements[0].id;
      remplirGrades(f ? f.grade : null);
      $("#st-fiche-mode").textContent = f ? "Modification · " + (S.infosFiche(f).fullName) : "Nouvelle fiche";
      $("#st-fiche-submit").textContent = f ? "Enregistrer les modifications" : "Enregistrer la fiche";
      $("#st-fiche-cancel").hidden = !f;
      dessinerCarte();
    };
    ficheForm.addEventListener("input", function (e) {
      if (e.target === FF.dept) remplirGrades();
      if (e.target === FF.membre && !FF.prenom.value && !FF.nom.value) {
        // Pratique : reprend le pseudo Discord comme point de départ
        let m = membreDe(FF.membre.value);
        if (m) FF.prenom.value = String(m.nom || "").replace(/^Exemple · /, "").split(" ")[0].slice(0, 30);
      }
      ficheErreur.textContent = "";
      dessinerCarte();
    });
    ficheForm.addEventListener("submit", function (e) {
      e.preventDefault();
      let v = lireFiche(), age = parseInt(v.age, 10);
      if (!v.prenom && !v.nom) { ficheErreur.textContent = "Indique au moins un prénom ou un nom."; FF.prenom.focus(); return; }
      if (v.age && (isNaN(age) || age < 18 || age > 75)) { ficheErreur.textContent = "L'âge doit être compris entre 18 et 75 ans."; FF.age.focus(); return; }
      if (v.roblox && !/^[A-Za-z0-9_]{3,20}$/.test(v.roblox)) { ficheErreur.textContent = "Pseudo Roblox : 3 à 20 lettres, chiffres ou _."; FF.roblox.focus(); return; }
      let corps = {
        id: v.id || undefined, discordId: v.membre || null, prenom: v.prenom, nom: v.nom, age: v.age ? age : null, statut: v.statut,
        dept: v.dept, grade: v.grade, roblox: v.roblox, apparence: v.apparence, perso: v.perso, histoire: v.histoire, comp: v.comp
      };
      let nomF = S.infosFiche(v).fullName;
      agir("fiche.enregistrer", corps, v.id ? "<b>Fiche modifiée :</b> " + esc(nomF) + "." : "<b>Fiche enregistrée :</b> " + esc(nomF) + ".", $("#st-fiche-submit"))
        .then(function (ok) { if (ok) modeFiche(null); });
    });
    $("#st-fiche-cancel").addEventListener("click", function () { modeFiche(null); });
    $("#st-fiche-copy").addEventListener("click", function () {
      S.stat("copies");
      U.copy($("#st-fiche-texte").textContent, "<b>Fiche copiée.</b> Colle-la dans le salon des fiches sur Discord.", $("#st-fiche-texte"));
    });
    S.tiltCard($("#st-fiche-stage"), ficheCarte);

    let renderFiches = function () {
      remplirMembres();
      let q = norm(filtreFiches.q.trim());
      let toutes = etat.fiches.slice().sort(function (a, b) { return (b.modifieLe || b.creeLe || "").localeCompare(a.modifieLe || a.creeLe || ""); });
      let liste = toutes.filter(function (f) {
        if (filtreFiches.statut !== "all" && f.statut !== filtreFiches.statut) return false;
        if (!q) return true;
        let i = S.infosFiche(f), m = membreDe(f.discordId);
        return norm([i.fullName, i.matricule, f.prenom, f.nom, f.roblox, m ? m.nom + " " + (m.pseudo || "") : ""].join(" ")).indexOf(q) >= 0;
      });
      $("#st-fiches-count").textContent = liste.length + " fiche" + (liste.length > 1 ? "s" : "") + " affichée" + (liste.length > 1 ? "s" : "") + " sur " + toutes.length;
      $("#st-fiches").innerHTML = liste.length ? liste.map(function (f) {
        let i = S.infosFiche(f), m = membreDe(f.discordId), st = STATUT[f.statut] || STATUT.service;
        return '<li class="fiche" style="--dc:' + (S.levelColors[i.lvl] || "var(--line-2)") + '">' +
          '<div class="fiche__id"><span class="fiche__mat mono">' + esc(i.matricule) + "</span><b>" + esc(i.fullName) + "</b>" +
          "<small>" + esc(i.dept.nom) + " · " + esc(i.grade[0]) + " · hab. " + i.lvl + "</small></div>" +
          '<div class="fiche__meta"><span class="chip" style="--c:' + st[1] + '">' + st[0] + "</span>" +
            (m ? '<span class="fiche__lien">' + S.avatar(m, "av--sm") + esc(m.nom) + "</span>" : '<span class="muted">Non liée</span>') +
            (f.roblox ? '<span class="mono fiche__rbx">Roblox · ' + esc(f.roblox) + "</span>" : "") + "</div>" +
          '<div class="st-acts"><button type="button" class="btn btn--sm" data-edit-fiche="' + esc(f.id) + '">Modifier</button>' +
            '<button type="button" class="btn btn--sm" data-copy-fiche="' + esc(f.id) + '">Copier</button>' +
            '<button type="button" class="btn btn--sm btn--danger" data-del-fiche="' + esc(f.id) + '">' + (confirmer === "f" + f.id ? "Confirmer" : "Supprimer") + "</button></div></li>";
      }).join("") : '<li class="muted">' + (toutes.length ? "Aucune fiche ne correspond." : "Aucune fiche pour l'instant. Remplis le formulaire ci-dessus pour créer la première.") + "</li>";
    };
    $("#st-fiche-q").addEventListener("input", function () { filtreFiches.q = this.value; if (etat) renderFiches(); });
    $("#st-fiche-filtre").addEventListener("change", function () { filtreFiches.statut = this.value; if (etat) renderFiches(); });
    $("#st-fiches").addEventListener("click", function (e) {
      let ficheDe = function (attr) { let b = e.target.closest("[" + attr + "]"); return b ? etat.fiches.filter(function (f) { return f.id === b.getAttribute(attr); })[0] : null; };
      let ed = ficheDe("data-edit-fiche");
      if (ed) {
        modeFiche(ed);
        ficheForm.scrollIntoView({ behavior: "smooth", block: "start" });
        FF.prenom.focus({ preventScroll: true });
        return;
      }
      let cp = ficheDe("data-copy-fiche");
      if (cp) {
        let m = membreDe(cp.discordId);
        S.stat("copies");
        U.copy(S.texteFiche(cp, ["> **Statut :** " + (STATUT[cp.statut] || STATUT.service)[0]].concat(m ? ["> **Membre Discord :** " + m.nom] : [])), "<b>Fiche copiée.</b>");
        return;
      }
      let b = e.target.closest("[data-del-fiche]");
      if (!b) return;
      let id = b.getAttribute("data-del-fiche");
      if (confirmer !== "f" + id) { confirmer = "f" + id; renderFiches(); setTimeout(function () { if (confirmer === "f" + id) { confirmer = null; if (etat) renderFiches(); } }, 4000); return; }
      confirmer = null;
      if (FF.id.value === id) modeFiche(null);
      agir("fiche.supprimer", { id: id }, "<b>Fiche supprimée.</b>", b);
    });

    /* ---------- Communiqués ------------------------------------------- */
    let niveauLabel = function (n) { return n ? "Habilitation " + n + " et plus" : "Tout le monde"; };
    let renderCommuniques = function () {
      $("#st-comm-list").innerHTML = etat.communiques.length ? etat.communiques.map(function (c) {
        return '<li class="st-item"><div><b>' + esc(c.titre) + "</b><small>" + esc(U.fmtDate(c.date)) + " · " + esc(c.auteur || "") + " · " + esc(niveauLabel(c.niveau || 0)) + "</small>" +
          '<p class="st-extrait">' + esc(c.texte.replace(/\[\[(\d)\|([\s\S]*?)\]\]/g, "[N$1 : $2]").slice(0, 160)) + "</p></div>" +
          '<div class="st-acts"><button type="button" class="btn btn--sm btn--danger" data-del-comm="' + esc(c.id) + '">' + (confirmer === "c" + c.id ? "Confirmer" : "Supprimer") + "</button></div></li>";
      }).join("") : '<li class="muted">Aucun communiqué publié depuis la console. Les communiqués du fichier de contenu restent affichés.</li>';
    };
    let cf = $("#st-comm-form");
    cf.addEventListener("submit", function (e) {
      e.preventDefault();
      agir("communique.ajouter", { titre: $("#st-comm-titre").value, texte: $("#st-comm-texte").value, niveau: parseInt($("#st-comm-niveau").value, 10) },
        "<b>Communiqué publié.</b> Il apparaît sur l'accueil et dans les archives.", $("button[type=submit]", cf)).then(function (ok) { if (ok) cf.reset(); });
    });
    $("#st-comm-list").addEventListener("click", function (e) {
      let b = e.target.closest("[data-del-comm]");
      if (!b) return;
      let id = b.getAttribute("data-del-comm");
      if (confirmer !== "c" + id) { confirmer = "c" + id; renderCommuniques(); setTimeout(function () { if (confirmer === "c" + id) { confirmer = null; if (etat) renderCommuniques(); } }, 4000); return; }
      confirmer = null;
      agir("communique.supprimer", { id: id }, "<b>Communiqué supprimé.</b>", b);
    });

    /* ---------- Événements -------------------------------------------- */
    let renderEvenements = function () {
      let maintenant = Date.now();
      $("#st-evt-list").innerHTML = etat.evenements.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); }).map(function (e) {
        let passe = new Date(e.date).getTime() + e.duree * 60000 < maintenant;
        let T = D.typesEvenement[e.type] || D.typesEvenement.evenement;
        return '<li class="st-item' + (passe ? " is-past" : "") + '"><div><b>' + esc(e.titre) + "</b><small>" + esc(S.fmtEvent(e.date)) + " · " + e.duree + " min" + (e.lieu ? " · " + esc(e.lieu) : "") + "</small>" +
          '<span class="chip" style="--c:' + T.couleur + '">' + esc(T.nom) + (passe ? " · terminé" : "") + "</span></div>" +
          '<div class="st-acts"><button type="button" class="btn btn--sm" data-edit-evt="' + esc(e.id) + '">Modifier</button>' +
          '<button type="button" class="btn btn--sm btn--danger" data-del-evt="' + esc(e.id) + '">' + (confirmer === "e" + e.id ? "Confirmer" : "Supprimer") + "</button></div></li>";
      }).join("") || '<li class="muted">Aucun événement.</li>';
    };
    let ef = $("#st-evt-form");
    let typeSel = $("#st-evt-type");
    typeSel.innerHTML = Object.keys(D.typesEvenement).map(function (k) { return '<option value="' + k + '">' + esc(D.typesEvenement[k].nom) + "</option>"; }).join("");
    let modeEdition = function (ev) {
      $("#st-evt-id").value = ev ? ev.id : "";
      $("#st-evt-titre").value = ev ? ev.titre : "";
      typeSel.value = ev ? ev.type : "evenement";
      $("#st-evt-date").value = ev ? ev.date.slice(0, 16) : "";
      $("#st-evt-duree").value = ev ? ev.duree : 120;
      $("#st-evt-lieu").value = ev ? ev.lieu || "" : "";
      $("#st-evt-texte").value = ev ? ev.texte || "" : "";
      $("#st-evt-submit").textContent = ev ? "Enregistrer les modifications" : "Ajouter l'événement";
      $("#st-evt-cancel").hidden = !ev;
      $("#st-evt-mode").textContent = ev ? "Modification · " + ev.titre : "Nouvel événement";
    };
    ef.addEventListener("submit", function (e) {
      e.preventDefault();
      let id = $("#st-evt-id").value;
      agir("evenement.enregistrer", {
        id: id || undefined, titre: $("#st-evt-titre").value, type: typeSel.value, date: $("#st-evt-date").value,
        duree: parseInt($("#st-evt-duree").value, 10), lieu: $("#st-evt-lieu").value, texte: $("#st-evt-texte").value
      }, id ? "<b>Événement modifié.</b>" : "<b>Événement ajouté</b> au calendrier.", $("#st-evt-submit")).then(function (ok) { if (ok) modeEdition(null); });
    });
    $("#st-evt-cancel").addEventListener("click", function () { modeEdition(null); });
    $("#st-evt-list").addEventListener("click", function (e) {
      let ed = e.target.closest("[data-edit-evt]");
      if (ed) {
        modeEdition(etat.evenements.filter(function (x) { return x.id === ed.getAttribute("data-edit-evt"); })[0]);
        ef.scrollIntoView({ behavior: "smooth", block: "start" });
        $("#st-evt-titre").focus({ preventScroll: true });
        return;
      }
      let b = e.target.closest("[data-del-evt]");
      if (!b) return;
      let id = b.getAttribute("data-del-evt");
      if (confirmer !== "e" + id) { confirmer = "e" + id; renderEvenements(); setTimeout(function () { if (confirmer === "e" + id) { confirmer = null; if (etat) renderEvenements(); } }, 4000); return; }
      confirmer = null;
      agir("evenement.supprimer", { id: id }, "<b>Événement supprimé.</b>", b);
    });

    /* ---------- Journal ------------------------------------------------ */
    let renderJournal = function () {
      $("#st-journal").innerHTML = etat.journal.length ? etat.journal.map(function (j) {
        return '<li><time class="mono">' + esc(quand(j.le)) + "</time><span><b>" + esc(j.par) + "</b> · " + esc(j.action) + "</span></li>";
      }).join("") : '<li class="muted">Aucune action enregistrée.</li>';
    };

    modeEdition(null);
    modeFiche(null);
    doc.addEventListener("s73:session", charger);
    charger();
  };
})();
