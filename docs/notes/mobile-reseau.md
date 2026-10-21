# Mobile — refresh et robustesse réseau

Relevé le 2026-09-29. Le refresh et le timeout sont corrigés ; l'IP de dev reste à traiter.

## Le refresh déconnectait sur n'importe quel échec — corrigé le 2026-10-12 (`fix/auth-refresh`)

Deux défauts se cumulaient.

Côté mobile, `refreshTokens` traitait tout échec comme une session morte : erreur réseau, 5xx et 429 effaçaient le refresh token. Un serveur qui redémarre pendant le refresh suffisait.

- `refresh` renvoie maintenant un `RefreshResult` à trois états (`lib/api/authBridge.ts`) : `refreshed`, `rejected` (401 ou 400 du serveur, seul cas qui déconnecte), `unavailable` (tout le reste, le token est conservé).
- `lib/api/client.ts` : sur `unavailable`, la requête échoue avec un message réseau, sans logout.
- Au lancement, `unavailable` est réessayé trois fois à 1,5 s d'intervalle, puis l'écran de connexion s'affiche sans effacer le token.
- **Non vérifié sur téléphone** : le cas « serveur injoignable ». Pour le reproduire : arrêter l'API, attendre 15 min que le token d'accès expire, utiliser l'app (une erreur doit s'afficher, sans retour à l'écran de connexion), relancer l'API, réessayer.
- Limite : dans ce dernier cas l'utilisateur voit l'écran de connexion alors que sa session est peut-être bonne. Un état « hors ligne » dédié serait plus juste.

Côté API, `generateTokens` supprimait tous les refresh tokens du compte à chaque connexion et à chaque refresh : un seul appareil pouvait rester connecté, et une connexion depuis Bruno ou un script déconnectait le téléphone.

- Un refresh token par appareil : seuls les tokens expirés de l'utilisateur sont supprimés.
- Au refresh, le token présenté reste valide `REFRESH_REUSE_GRACE_MS` (60 s) au lieu d'être supprimé. Si la réponse se perd (app rechargée, réseau coupé), le client rejoue l'ancien token sans être déconnecté. Contrepartie assumée : un token volé reste utilisable pendant ce délai.
- `POST /auth/logout` accepte `refreshToken` dans le corps et ne révoque que celui-là ; sans lui, tous les appareils du compte.
- Non fait : détection de réutilisation d'un token hors délai de grâce (signe de vol), qui révoquerait toute la famille de tokens.

## Aucun timeout sur `fetch` — corrigé le 2026-10-21 (`fix/fetch-timeout`)

- Un hôte injoignable donnait un spinner infini (« Signing in… ») au lieu d'une erreur.
- Tous les appels passent par `request` (`lib/api/request.ts`) : `AbortSignal.timeout(10 s)`, et toute requête sans réponse lève une `NetworkError` lisible. Le client `api` et `AuthContext` s'en servent ; plus aucun `fetch` direct.
- Au refresh, un timeout donne `unavailable` : la session est conservée.
- Limite : le timeout coupe l'attente, pas le traitement serveur. Un `POST` coupé a pu être enregistré ; le renvoyer à la main peut donner un 409 (projet déjà ouvert) ou un second envoi.
- **Non vérifié sur téléphone.** Pour le reproduire : mettre une IP injoignable dans `EXPO_PUBLIC_API_URL` (par exemple `http://10.255.255.1:3000`), `start --clear`, tenter un login : erreur au bout de 10 s.

## IP de dev en dur

- `EXPO_PUBLIC_API_URL` dans `apps/mobile/.env` (gitignoré) contient l'IP du Mac. Elle change avec le réseau (DHCP de la box, partage de connexion), et le login tourne alors en boucle.
- Pistes : réserver l'IP dans la box, ou dériver l'hôte de `Constants.expoConfig.hostUri` en dev.
- Après modification du `.env` : `pnpm --filter mobile start --clear` (les variables sont inlinées au bundle).
