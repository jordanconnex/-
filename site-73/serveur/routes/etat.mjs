// GET /api/etat : diagnostic de la mise en ligne, sans rien dévoiler de secret.
// Ouvre https://ton-site/api/etat pour voir ce qui manque (stockage, variables…).
import { json, env, stockage } from "../commun.mjs";
import { adminPrincipal } from "../comptes.mjs";

export default async function etat() {
  let stock;
  try {
    await stockage().get("site");
    stock = "ok";
  } catch (e) {
    stock = "PROBLÈME : " + e.message;
  }
  const secret = env("SESSION_SECRET"), mdp = env("ADMIN_MOT_DE_PASSE");
  const variables = {
    SESSION_SECRET: secret.length >= 32 ? "ok" : secret ? "TROP COURT (32 caractères minimum)" : "MANQUANT",
    ADMIN_IDENTIFIANT: adminPrincipal() ? "ok" : env("ADMIN_IDENTIFIANT") ? "INVALIDE (3 à 20 caractères : lettres sans accent, chiffres, . _ -)" : "MANQUANT",
    ADMIN_MOT_DE_PASSE: mdp.length >= 8 ? "ok" : mdp ? "TROP COURT (8 caractères minimum)" : "MANQUANT"
  };
  const pret = stock === "ok" && Object.values(variables).every((v) => v === "ok");
  return json({
    serveur: "ok (la fonction Netlify répond)",
    stockage: stock,
    variables,
    inscription: env("CODE_INSCRIPTION") ? "protégée par CODE_INSCRIPTION" : "ouverte à tous (règle CODE_INSCRIPTION pour la limiter)",
    connexion: pret ? "prête" : "incomplète : corrige les lignes marquées PROBLÈME, MANQUANT, INVALIDE ou TROP COURT"
  });
}
