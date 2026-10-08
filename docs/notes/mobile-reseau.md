# Mobile — refresh et robustesse réseau

Relevé le 2026-09-29, pas encore traité. À reprendre comme un `fix/` mobile séparé.

## Le refresh déconnecte sur n'importe quel échec

- `refreshTokens` dans `apps/mobile/lib/auth/AuthContext.tsx` : tout `!res.ok` et toute exception (dont une erreur réseau de `fetch`) tombent dans le même `catch`, qui fait `clearRefreshToken()` puis `return null` → `onAuthFailure` → logout.
- Conséquence : un grimpeur sans réseau au moment où son access token (15 min) expire perd sa session. Un 5xx passager ou un 429 du throttler aussi.
- Piste : ne détruire le refresh token que sur un 401 du serveur. Sur erreur réseau, 5xx ou 429, conserver le token et faire échouer la requête sans déconnecter.
- Principe : une déconnexion ne doit arriver que quand le serveur dit explicitement que la session est morte.

## Aucun timeout sur `fetch`

- Concerne `lib/api/client.ts` et `AuthContext.login`.
- Un hôte injoignable donne un spinner infini (« Signing in… ») au lieu d'une erreur.
- Piste : `AbortSignal.timeout(...)`.

## IP de dev en dur

- `EXPO_PUBLIC_API_URL` dans `apps/mobile/.env` (gitignoré) contient l'IP du Mac. Elle change avec le réseau (DHCP de la box, partage de connexion), et le login tourne alors en boucle.
- Pistes : réserver l'IP dans la box, ou dériver l'hôte de `Constants.expoConfig.hostUri` en dev.
- Après modification du `.env` : `pnpm --filter mobile start --clear` (les variables sont inlinées au bundle).
