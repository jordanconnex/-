// Magasin Netlify Blobs vu par le serveur : { get, set, delete, list }.
// Cohérence « forte » : une écriture est lue aussitôt, partout.
import { getStore } from "@netlify/blobs";

export const NOM_MAGASIN = "site-73";

// options : réglages de connexion, seulement pour le serveur local (scripts/dev.mjs)
export function magasinBlobs(options = {}) {
  const store = getStore({ name: NOM_MAGASIN, consistency: "strong", ...options });
  return {
    get: (cle) => store.get(cle, { type: "json" }),
    set: (cle, valeur) => store.setJSON(cle, valeur),
    delete: (cle) => store.delete(cle),
    list: async (prefix) => (await store.list({ prefix })).blobs.map((b) => b.key)
  };
}
