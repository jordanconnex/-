// POST /api/auth/mot-de-passe { actuel, nouveau } : le membre change son mot de passe.
// Les autres sessions de ce compte sont fermées ; celle-ci reste ouverte.
import { json, cookie, stockage, creerSession, refuserAutreSite, lireCorps } from "../commun.mjs";
import {
  membreConnecte, estPrincipal, motDePasseCorrect, verifierMotDePasse, hacher, nouveauJeton,
  blocage, noterEchec, effacerEchecs
} from "../comptes.mjs";

export default async function motDePasse(req) {
  if (req.method !== "POST") return json({ erreur: "Méthode non autorisée." }, 405);
  const refus = refuserAutreSite(req);
  if (refus) return refus;
  const membre = await membreConnecte(req);
  if (!membre) return json({ erreur: "Connecte-toi d'abord." }, 401);
  if (estPrincipal(membre)) {
    return json({ erreur: "Le mot de passe de l'administrateur principal se change dans Cloudflare (secret ADMIN_MOT_DE_PASSE)." }, 400);
  }
  const corps = await lireCorps(req);
  if (!corps) return json({ erreur: "Requête illisible." }, 400);
  const minutes = await blocage(membre.id, req);
  if (minutes) return json({ erreur: `Trop d'essais. Réessaie dans ${minutes} min.` }, 429);
  const erreur = verifierMotDePasse(corps.nouveau, membre.id);
  if (erreur) return json({ erreur }, 400);
  if (typeof corps.actuel !== "string" || !(await motDePasseCorrect(corps.actuel, membre.mdp))) {
    await noterEchec(membre.id, req);
    return json({ erreur: "Mot de passe actuel incorrect." }, 403);
  }
  await effacerEchecs(membre.id, req);
  membre.mdp = await hacher(corps.nouveau);
  membre.jeton = nouveauJeton();
  delete membre.mdpProvisoire;
  await stockage().setJSON("membres/" + membre.id, membre);
  const { jeton, maxAge } = await creerSession({ id: membre.id, nom: membre.nom, v: membre.jeton });
  return json({ ok: true }, 200, { "set-cookie": cookie("s73_session", jeton, maxAge) });
}
