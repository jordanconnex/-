// POST /api/auth/connexion { identifiant, motDePasse } : ouvre une session.
import { json, env, cookie, stockage, creerSession, refuserAutreSite, lireCorps } from "../commun.mjs";
import {
  normaliser, identifiantValide, motDePasseCorrect, hachageLeurre, memeTexte,
  adminPrincipal, jetonPrincipal, blocage, noterEchec, effacerEchecs
} from "../comptes.mjs";

export default async function connexion(req) {
  if (req.method !== "POST") return json({ erreur: "Méthode non autorisée." }, 405);
  const refus = refuserAutreSite(req);
  if (refus) return refus;
  if (env("SESSION_SECRET").length < 32) return json({ erreur: "Connexion indisponible : SESSION_SECRET manque sur le serveur (voir /api/etat)." }, 503);
  const corps = await lireCorps(req);
  const id = normaliser(corps && corps.identifiant);
  const mdp = corps && typeof corps.motDePasse === "string" ? corps.motDePasse : "";
  if (!id || !mdp) return json({ erreur: "Indique ton identifiant et ton mot de passe." }, 400);
  const refuse = () => json({ erreur: "Identifiant ou mot de passe incorrect." }, 401);
  if (!identifiantValide(id) || mdp.length > 128) { await hachageLeurre(mdp.slice(0, 128)); return refuse(); }

  const minutes = await blocage(id, req);
  if (minutes) return json({ erreur: `Trop d'essais. Réessaie dans ${minutes} min.` }, 429);

  const s = stockage();
  let membre = await s.get("membres/" + id);
  let ok;
  if (id === adminPrincipal()) {
    // Administrateur principal : mot de passe lu dans les secrets Cloudflare
    ok = env("ADMIN_MOT_DE_PASSE").length >= 8 && (await memeTexte(mdp, env("ADMIN_MOT_DE_PASSE")));
    if (ok) {
      membre = { ...(membre || {}), id, nom: (membre && membre.nom) || env("ADMIN_IDENTIFIANT"), jeton: await jetonPrincipal() };
      delete membre.mdp;
      delete membre.mdpProvisoire;
    }
  } else if (membre && membre.mdp) {
    ok = await motDePasseCorrect(mdp, membre.mdp);
  } else {
    await hachageLeurre(mdp);
    ok = false;
  }
  if (!ok) {
    if (membre) await noterEchec(id, req);
    return refuse();
  }
  await effacerEchecs(id, req);
  const maintenant = new Date().toISOString();
  membre.premiereVisite = membre.premiereVisite || maintenant;
  membre.derniereVisite = maintenant;
  await s.setJSON("membres/" + id, membre);
  const { jeton, maxAge } = await creerSession({ id, nom: membre.nom, v: membre.jeton });
  return json({ ok: true, nom: membre.nom }, 200, { "set-cookie": cookie("s73_session", jeton, maxAge) });
}
