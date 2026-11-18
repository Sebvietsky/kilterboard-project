import { config } from './config';
import { NetworkError } from './errors';

// Sans limite, un hôte injoignable (IP du Mac changée, Wi-Fi de la salle)
// laisse la requête pendante : spinner infini. 10 s couvre un réseau mobile
// lent ; avec `retry: 1` des queries, l'écran d'erreur arrive au pire en 20 s.
export const REQUEST_TIMEOUT_MS = 10_000;

// Seul point d'accès réseau de l'app : le client `api` et AuthContext (qui
// ne passe pas par `api`, pour ne pas déclencher de refresh) s'en servent.
//
// Le timeout coupe l'attente du client, pas le traitement du serveur : un
// POST coupé a pu être enregistré. Seule la relecture de l'état le dit.
export async function request(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  try {
    return await fetch(`${config.API_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // `fetch` ne lève que si aucune réponse n'est arrivée : coupure réseau,
    // ou abort du timeout (DOMException `TimeoutError`, message illisible).
    throw new NetworkError();
  }
}
