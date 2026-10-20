# Essai BLE en salle — marche à suivre

Préparé le 2026-10-20 sur `feature/ble-spike`. Écran : `apps/mobile/app/ble-spike.tsx`, accessible par le lien « BLE test » sous la carte Board de Home. Protocole : `docs/ble-protocol.md`.

Déjà vérifié à la maison (2026-10-20) : ble-plx 3.5.1 tourne sous React Native 0.88, l'autorisation Bluetooth est demandée, le scan démarre et s'arrête après 10 s.

## Avant de partir

- L'app installée a été compilée le 2026-10-20 avec une signature gratuite : elle expire au bout de 7 jours. Au-delà, recompiler : `pnpm --filter mobile exec expo run:ios --device <udid> --no-bundler`.
- Le Mac a besoin de PostgreSQL (local) et du dépôt sur `feature/ble-spike`.

## Sur place : relier le Mac et l'iPhone

L'app de développement charge son code depuis Metro, et l'écran BLE est derrière la connexion : sans API au lancement, l'app s'ouvre sur l'écran de connexion.

1. iPhone : activer le partage de connexion. Mac : rejoindre ce réseau Wi-Fi.
2. Mac : `ipconfig getifaddr en0` donne l'IP du Mac (en général `172.20.10.x`).
3. `apps/mobile/.env` : `EXPO_PUBLIC_API_URL=http://<ip>:3000`. À remettre à la maison (fichier ignoré par git, rien à commiter).
4. `pnpm --filter api start:dev`, puis `pnpm --filter mobile start --clear`.
5. Ouvrir KilterBoard. Si le serveur Metro n'apparaît pas, saisir `http://<ip>:8081` dans l'écran du dev client.

## Sur place : l'essai

1. Fermer l'app Kilter officielle (la sienne, et demander autour) : la board n'accepte qu'une connexion à la fois.
2. Home → « BLE test » → **Scan**.
   - Noter le nom de la board. Il doit finir par `#3` (niveau d'API 3). S'il finit par `#2` : **ne rien envoyer**, le format API 2 n'est pas implémenté.
   - Rien trouvé : **Scan all**, chercher un nom qui ressemble à la board, noter les services affichés.
3. Taper sur la board : le journal doit afficher `Connected (MTU n)`. Noter n.
4. **Test 12 x 12 with kickboard** (hypothèse la plus probable). Attendu, si c'est la bonne taille :
   - bas gauche (prise du kickboard) en vert, bas droite (kickboard) en cyan ;
   - haut gauche en orange, haut droite en magenta ;
   - une prise au centre en vert.
5. Si le motif ne correspond pas : **Turn off**, puis **Test 12 x 14**, puis **Test 12 x 12 without kickboard**. Les deux premiers tests ont les mêmes coins du bas : c'est le haut qui tranche.
6. **Turn off** : noter si la board s'éteint (À VÉRIFIER dans le protocole).

Chaque test envoie 21 octets, donc 2 chunks : le découpage est testé du même coup.

## À noter

| Point | Résultat |
| --- | --- |
| Nom de la board (niveau d'API) | |
| MTU | |
| Test qui dessine le motif | |
| Couleurs conformes aux 4 rôles | |
| Turn off éteint la board | |
| Erreurs du journal (capture d'écran) | |

## Ce que chaque résultat décide

- **Un test dessine le motif** : la taille de la board est connue. À reporter dans `kilter-data.md` ; c'est la taille dont on importe les LED.
- **Couleurs fausses** : revoir la quantification (section 4) ou l'ordre des bits de couleur.
- **Aucun motif, mais des LED s'allument** : taille hors des trois candidates, ou position mal encodée. Noter quelles prises s'allument.
- **Connecté, mais rien ne s'allume** : vérifier le nom (`#2` ?), puis le format du paquet.
- **Board introuvable, même avec Scan all** : une autre app est connectée, ou la board ne diffuse pas le service attendu.
