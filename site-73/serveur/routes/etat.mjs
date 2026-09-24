// GET /api/etat : diagnostic de la mise en ligne, sans rien dévoiler de secret.
// Ouvre https://ton-site/api/etat pour voir ce qui manque (stockage, variables Discord…).
import { json, env, urlDuSite, stockage, rolesAdmin, idsAdmin } from "../commun.mjs";

export default async function etat(req) {
  let stock;
  try {
    await stockage().get("site");
    stock = "ok";
  } catch (e) {
    stock = "PROBLÈME : " + e.message;
  }
  const present = (k) => (env(k) ? "ok" : "MANQUANT");
  const secret = env("SESSION_SECRET");
  const discord = {
    DISCORD_CLIENT_ID: present("DISCORD_CLIENT_ID"),
    DISCORD_CLIENT_SECRET: present("DISCORD_CLIENT_SECRET"),
    DISCORD_GUILD_ID: present("DISCORD_GUILD_ID"),
    SESSION_SECRET: secret.length >= 32 ? "ok" : secret ? "TROP COURT (32 caractères minimum)" : "MANQUANT"
  };
  const pret = stock === "ok" && Object.values(discord).every((v) => v === "ok");
  return json({
    serveur: "ok (le Worker Cloudflare répond)",
    stockage_kv: stock,
    variables: discord,
    administrateurs: { ADMIN_ROLES: rolesAdmin().length + " rôle(s)", ADMIN_IDS: idsAdmin().length + " compte(s)" },
    adresse_de_retour_discord: urlDuSite(req) + "/api/auth/callback",
    connexion_discord: pret ? "prête" : "incomplète : corrige les lignes marquées PROBLÈME, MANQUANT ou TROP COURT"
  });
}
