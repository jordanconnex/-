// POST /api/auth/inscription { identifiant, motDePasse, code } : crée un compte.
// Si CODE_INSCRIPTION est réglé, il faut ce code (donné par le staff).
import { json, env, cookie, stockage, creerSession, refuserAutreSite, lireCorps, journaliser } from "../commun.mjs";
import { verifierIdentifiant, verifierMotDePasse, hacher, memeTexte, adminPrincipal, nouveauJeton } from "../comptes.mjs";

export default async function inscription(req) {
  if (req.method !== "POST") return json({ erreur: "Méthode non autorisée." }, 405);
  const refus = refuserAutreSite(req);
  if (refus) return refus;
  if (env("SESSION_SECRET").length < 32) return json({ erreur: "Inscription indisponible : SESSION_SECRET manque sur le serveur (voir /api/etat)." }, 503);
  const corps = await lireCorps(req);
  if (!corps) return json({ erreur: "Requête illisible." }, 400);

  const code = env("CODE_INSCRIPTION");
  if (code && !(await memeTexte(String(corps.code || "").trim(), code))) {
    return json({ erreur: "Code d'inscription incorrect. Demande-le au staff sur Discord." }, 403);
  }
  const v = verifierIdentifiant(corps.identifiant);
  if (v.erreur) return json({ erreur: v.erreur }, 400);
  const erreurMdp = verifierMotDePasse(corps.motDePasse, v.id);
  if (erreurMdp) return json({ erreur: erreurMdp }, 400);

  const s = stockage();
  if (v.id === adminPrincipal() || (await s.get("membres/" + v.id))) {
    return json({ erreur: "Cet identifiant est déjà pris." }, 409);
  }
  const maintenant = new Date().toISOString();
  const membre = {
    id: v.id, nom: v.nom, mdp: await hacher(corps.motDePasse), jeton: nouveauJeton(),
    creeLe: maintenant, premiereVisite: maintenant, derniereVisite: maintenant
  };
  await s.setJSON("membres/" + v.id, membre);
  await journaliser(v.nom, "Compte créé");
  const { jeton, maxAge } = await creerSession({ id: v.id, nom: v.nom, v: membre.jeton });
  return json({ ok: true, nom: v.nom }, 201, { "set-cookie": cookie("s73_session", jeton, maxAge) });
}
