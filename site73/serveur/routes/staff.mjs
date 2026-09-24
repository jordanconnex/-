// /api/staff : espace d'administration. Réservé aux administrateurs.
//   GET  → membres, niveau d'alerte, communiqués, événements, journal
//   POST → { action, ... } puis renvoie l'état à jour
import {
  json, lireSession, estAdmin, stockage, lireDynamique, ecrireDynamique, habilitationPourMembre, journaliser,
  donnees, ALERTES, TYPES_EVENEMENT, dateParis, isoParis, aleatoireHex
} from "../commun.mjs";

const texte = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const niveauValide = (n) => Number.isInteger(n) && n >= 0 && n <= 5;

async function etatStaff() {
  const s = stockage();
  const cles = await s.list({ prefix: "membres/" });
  const [membres, dyn, journal] = await Promise.all([
    Promise.all(cles.map((c) => s.get(c))),
    lireDynamique(),
    s.get("journal")
  ]);
  return {
    membres: membres.filter(Boolean).map((m) => {
      const hab = habilitationPourMembre(m, { id: m.id, adm: m.admin });
      return {
        id: m.id, nom: m.nom, pseudo: m.pseudo, avatar: m.avatar, admin: !!m.admin,
        habilitation: hab.niveau, source: hab.source, override: Number.isInteger(m.override) ? m.override : null,
        roleHab: Number.isInteger(m.roleHab) ? m.roleHab : null,
        derniereVisite: m.derniereVisite, modifiePar: m.modifiePar || null, modifieLe: m.modifieLe || null
      };
    }).sort((a, b) => (b.derniereVisite || "").localeCompare(a.derniereVisite || "")),
    etat: dyn.etat || { alerte: donnees.config.alerte, par: null, le: null },
    communiques: dyn.communiques,
    evenements: Array.isArray(dyn.evenements) ? dyn.evenements : donnees.evenements,
    journal: (journal || []).slice(0, 60)
  };
}

export default async function staff(req) {
  const session = await lireSession(req);
  if (!estAdmin(session)) return json({ erreur: "Accès réservé à l'administration." }, 403);
  if (req.method === "GET") return json(await etatStaff());
  if (req.method !== "POST") return json({ erreur: "Méthode non autorisée." }, 405);

  // Protection contre les requêtes venues d'un autre site
  const origine = req.headers.get("origin");
  if (req.headers.get("x-s73") !== "1" || (origine && origine !== new URL(req.url).origin)) {
    return json({ erreur: "Requête refusée." }, 403);
  }
  let corps;
  try { corps = await req.json(); } catch { return json({ erreur: "Requête illisible." }, 400); }

  const s = stockage();
  const par = session.nom;
  const maintenant = new Date().toISOString();

  switch (corps.action) {
    case "habilitation": {
      const cle = "membres/" + String(corps.id || "").replace(/\D/g, "");
      const membre = await s.get(cle);
      if (!membre) return json({ erreur: "Membre introuvable." }, 404);
      if (corps.niveau === null) {
        delete membre.override;
      } else if (niveauValide(corps.niveau)) {
        membre.override = corps.niveau;
      } else {
        return json({ erreur: "Niveau invalide (0 à 5)." }, 400);
      }
      membre.modifiePar = par;
      membre.modifieLe = maintenant;
      await s.setJSON(cle, membre);
      await journaliser(par, corps.niveau === null
        ? `Habilitation de ${membre.nom} rendue à ses rôles Discord`
        : `Habilitation de ${membre.nom} réglée sur le niveau ${corps.niveau}`);
      break;
    }
    case "alerte": {
      if (!ALERTES.includes(corps.niveau)) return json({ erreur: "Niveau d'alerte inconnu." }, 400);
      await ecrireDynamique({ etat: { alerte: corps.niveau, par, le: maintenant } });
      await journaliser(par, `Niveau d'alerte du site : ${donnees.alertes[corps.niveau].code}`);
      break;
    }
    case "communique.ajouter": {
      const titre = texte(corps.titre, 120), contenu = texte(corps.texte, 2000);
      const niveau = niveauValide(corps.niveau) ? corps.niveau : 0;
      if (!titre || !contenu) return json({ erreur: "Titre et texte obligatoires." }, 400);
      const liste = (await lireDynamique()).communiques;
      liste.unshift({ id: crypto.randomUUID(), date: dateParis(), titre, texte: contenu, niveau, auteur: par, creeLe: maintenant });
      await ecrireDynamique({ communiques: liste.slice(0, 100) });
      await journaliser(par, `Communiqué publié : « ${titre} »` + (niveau ? ` (niveau ${niveau})` : ""));
      break;
    }
    case "communique.supprimer": {
      const liste = (await lireDynamique()).communiques;
      const cible = liste.find((c) => c.id === corps.id);
      if (!cible) return json({ erreur: "Communiqué introuvable." }, 404);
      await ecrireDynamique({ communiques: liste.filter((c) => c.id !== corps.id) });
      await journaliser(par, `Communiqué supprimé : « ${cible.titre} »`);
      break;
    }
    case "evenement.enregistrer": {
      const titre = texte(corps.titre, 100), lieu = texte(corps.lieu, 120), contenu = texte(corps.texte, 1000);
      const date = isoParis(corps.date);
      const duree = Number(corps.duree);
      if (!titre || !date) return json({ erreur: "Titre et date obligatoires." }, 400);
      if (!TYPES_EVENEMENT.includes(corps.type)) return json({ erreur: "Type d'événement inconnu." }, 400);
      if (!(duree >= 15 && duree <= 720)) return json({ erreur: "Durée entre 15 et 720 minutes." }, 400);
      const liste = (await lireDynamique()).evenements || structuredClone(donnees.evenements);
      const ev = { id: corps.id || "evt-" + aleatoireHex(4), date, duree, type: corps.type, titre, lieu, texte: contenu };
      const i = liste.findIndex((e) => e.id === ev.id);
      if (i >= 0) liste[i] = ev; else liste.push(ev);
      liste.sort((a, b) => new Date(a.date) - new Date(b.date));
      await ecrireDynamique({ evenements: liste });
      await journaliser(par, `Événement ${i >= 0 ? "modifié" : "ajouté"} : « ${titre} »`);
      break;
    }
    case "evenement.supprimer": {
      const liste = (await lireDynamique()).evenements || structuredClone(donnees.evenements);
      const cible = liste.find((e) => e.id === corps.id);
      if (!cible) return json({ erreur: "Événement introuvable." }, 404);
      await ecrireDynamique({ evenements: liste.filter((e) => e.id !== corps.id) });
      await journaliser(par, `Événement supprimé : « ${cible.titre} »`);
      break;
    }
    default:
      return json({ erreur: "Action inconnue." }, 400);
  }
  return json(await etatStaff());
}
