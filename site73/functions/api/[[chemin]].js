// Cloudflare Pages : si le site est déployé avec Pages plutôt qu'avec Workers,
// toutes les routes /api/… passent ici, par le même code que le Worker.
import worker from "../../serveur/worker.mjs";

export const onRequest = (contexte) => worker.fetch(contexte.request, contexte.env, contexte);
