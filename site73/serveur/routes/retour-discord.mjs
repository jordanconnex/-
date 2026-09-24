// GET /api/auth/callback : Discord renvoie ici après la connexion.
// Vérifie l'appartenance au serveur, lit les rôles, enregistre le membre
// et ouvre une session signée.
import {
  env, rediriger, cookie, lireCookie, urlDuSite, retourSur, stockage,
  creerSession, rolesAdmin, idsAdmin, habilitationDesRoles, apiDiscord
} from "../commun.mjs";

const effacerEtat = cookie("s73_oauth", "", 0);

export default async function retourDiscord(req) {
  const API = apiDiscord();
  const url = new URL(req.url);
  const [etatAttendu, retourBrut] = (lireCookie(req, "s73_oauth") || "").split("|");
  const retour = retourSur(retourBrut);
  const fin = (code) => rediriger(retour + "?connexion=" + code, [effacerEtat]);

  if (url.searchParams.get("error")) return fin("annulee");
  const code = url.searchParams.get("code");
  if (!code || !etatAttendu || url.searchParams.get("state") !== etatAttendu) return fin("expiree");

  // 1. Échange du code contre un jeton d'accès
  const reponseJeton = await fetch(API + "/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("DISCORD_CLIENT_ID"),
      client_secret: env("DISCORD_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: urlDuSite(req) + "/api/auth/callback"
    })
  });
  if (!reponseJeton.ok) return fin("discord");
  const { access_token: jeton } = await reponseJeton.json();
  const auth = { authorization: "Bearer " + jeton };

  // 2. Identité et appartenance au serveur
  const [repUtilisateur, repMembre] = await Promise.all([
    fetch(API + "/users/@me", { headers: auth }),
    fetch(API + "/users/@me/guilds/" + env("DISCORD_GUILD_ID") + "/member", { headers: auth })
  ]);
  if (!repUtilisateur.ok) return fin("discord");
  if (!repMembre.ok) return fin(repMembre.status === 429 ? "discord" : "serveur");
  const utilisateur = await repUtilisateur.json();
  const membreDiscord = await repMembre.json();

  const roles = Array.isArray(membreDiscord.roles) ? membreDiscord.roles : [];
  const admin = roles.some((r) => rolesAdmin().includes(r)) || idsAdmin().includes(utilisateur.id);
  const nom = membreDiscord.nick || utilisateur.global_name || utilisateur.username;
  const avatar = utilisateur.avatar
    ? `https://cdn.discordapp.com/avatars/${utilisateur.id}/${utilisateur.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(utilisateur.id) >> 22n) % 6n)}.png`;

  // 3. Fiche du membre (l'éventuel réglage du staff est conservé)
  const s = stockage();
  const cle = "membres/" + utilisateur.id;
  const ancien = (await s.get(cle)) || {};
  const maintenant = new Date().toISOString();
  await s.setJSON(cle, {
    ...ancien,
    id: utilisateur.id,
    nom,
    pseudo: utilisateur.username,
    avatar,
    roleHab: habilitationDesRoles(roles),
    admin,
    premiereVisite: ancien.premiereVisite || maintenant,
    derniereVisite: maintenant
  });

  // 4. Session
  const { jeton: session, maxAge } = await creerSession({ id: utilisateur.id, nom, avatar, admin });
  return rediriger(retour + "?connexion=ok", [cookie("s73_session", session, maxAge), effacerEtat]);
}
