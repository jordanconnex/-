// GET /api/auth/login?retour=/page.html : redirige vers la connexion Discord.
import crypto from "node:crypto";
import { env, rediriger, cookie, urlDuSite, retourSur } from "../lib/commun.mjs";

export default async (req) => {
  const clientId = env("DISCORD_CLIENT_ID");
  if (!clientId || !env("DISCORD_CLIENT_SECRET") || !env("DISCORD_GUILD_ID") || env("SESSION_SECRET").length < 32) {
    return rediriger("/?connexion=config");
  }
  const retour = retourSur(new URL(req.url).searchParams.get("retour"));
  const etat = crypto.randomBytes(18).toString("base64url");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: urlDuSite(req) + "/api/auth/callback",
    scope: "identify guilds.members.read",
    state: etat,
    prompt: "none"
  });
  return rediriger("https://discord.com/oauth2/authorize?" + params, [
    cookie("s73_oauth", etat + "|" + retour, 600)
  ]);
};

export const config = { path: "/api/auth/login" };
