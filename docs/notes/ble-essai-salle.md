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

Essai fait le 2026-10-23.

| Point | Résultat |
| --- | --- |
| Nom de la board (niveau d'API) | `Kilter Board#75804@3` : niveau 3, après un `@` et non un `#`. `parseBoardName` corrigé. |
| MTU | 23 (20 octets utiles) : le paquet de 21 octets part en 2 morceaux, sans erreur. |
| Test qui dessine le motif | **12 x 12 with kickboard** (taille id 10), du premier coup. Exactement 5 LED allumées. |
| Couleurs conformes aux 4 rôles | Oui. Le pied (`#FFA500`) paraît jaune : quantifié en R7 G5 B0, soit `#FFB600`. Attendu, pas une erreur d'ordre des bits (cyan et magenta justes). |
| Turn off éteint la board | Oui, tout s'éteint. |
| Erreurs du journal (capture d'écran) | Aucune. Paquet décodé : somme de contrôle juste (`0x36`), LED 33, 0, 68, 476 et 260. Une déconnexion venait d'un autre téléphone. |

- La board apparaissait deux fois au premier scan ; un seul appareil au second. Expliqué par la suite (ci-dessous) : ce sont deux identités Bluetooth.

## Suite du 2026-10-23 : vraie connexion (`feature/ble-connection`)

- **Plusieurs identités Bluetooth.** Autour d'une connexion (la sienne ou celle d'un autre grimpeur), la board s'annonce sous un second identifiant, en même temps que le premier, avec un signal voisin (-77 et -83 dBm). Les identités de passage disparaissent en moins de 2 minutes ; il reste alors une identité stable. Réponse de l'app : une ligne par série, et Connect essaie chaque identifiant dans l'ordre du scan, 8 s chacun.
- **Connexion pendant qu'un autre grimpeur est connecté : possible.** Hypothèse non vérifiée : une connexion par identité. Contredit « une seule connexion à la fois » (étape 1 ci-dessus), qui reste la consigne prudente pendant un essai.
- **Plusieurs paquets validés** : logo de 97 prises, en deux paquets (`first`, `last`), entièrement allumé. Dessins de test : Element x Millet (39 prises), logo Element v1 (80) et v2 (97), dans l'écran d'essai.
- **Non testé** : une identité qui accepterait la connexion sans rien allumer. À faire, board libre : se connecter à chaque identité tour à tour et envoyer un motif.

## Ce que chaque résultat décide

- **Un test dessine le motif** : la taille de la board est connue. À reporter dans `kilter-data.md` ; c'est la taille dont on importe les LED.
- **Couleurs fausses** : revoir la quantification (section 4) ou l'ordre des bits de couleur.
- **Aucun motif, mais des LED s'allument** : taille hors des trois candidates, ou position mal encodée. Noter quelles prises s'allument.
- **Connecté, mais rien ne s'allume** : vérifier le nom (`#2` ?), puis le format du paquet.
- **Board introuvable, même avec Scan all** : une autre app est connectée, ou la board ne diffuse pas le service attendu.

## Prochain essai : l'ampoule (`feature/light-boulder`)

Préparé le 2026-11-05. Bouton ampoule en bas à droite du plan de la board, sur le détail d'un bloc. Comportement retenu le 2026-11-05 : si deux téléphones sont connectés à la fois, le dernier envoi l'emporte, sans alerte (l'app ne peut pas savoir qu'un autre est connecté).

### Avant de partir

- L'app recompilée le 2026-11-05 expire le 2026-11-12 : au-delà, recompiler (`docs/notes/partage-ami.md`, commande `xcodebuild` en `Debug` pour l'iPhone de Seb).
- Le Mac sur `feature/light-boulder`, base avec le catalogue importé (`db:import-catalog`, `db:seed`, `db:seed:dev`).
- `EXPO_PUBLIC_BOARD_SIMULATED` absent ou à `0` dans `apps/mobile/.env`.
- Sur place, relier le Mac et l'iPhone comme ci-dessus (« Sur place : relier le Mac et l'iPhone »).

### Les tests

Blocs du seed sur de vrais trous : « Midnight Sun » (8 prises), « Silent Sky » (8), « The Orbit » (6).

1. **Board libre, cas nominal.** Home → se connecter. Ouvrir « Midnight Sun », taper l'ampoule (bleue). Attendu : exactement 8 LED ; 2 départs en vert à mi-hauteur basse, 3 mains en cyan, la fin en magenta en haut au centre, 2 pieds en jaune sur le kickboard ; toast « Shown on the board ».
2. **Changer de bloc.** Ouvrir « The Orbit », taper l'ampoule. Attendu : les 8 prises précédentes s'éteignent, seules les 6 nouvelles restent.
3. **Disconnect volontaire.** Home → Disconnect. Taper l'ampoule (neutre). Attendu : « No board connected », pas de proposition de reconnexion.
4. **Un autre grimpeur se connecte pendant qu'on l'est** (lui demander de lancer l'app Kilter et d'afficher un bloc). Noter lequel des deux cas se produit :
   - **Cas 1, coupure** : la carte Board de Home repasse « non connecté », l'ampoule devient neutre. Taper : alerte « Board disconnected », puis « Show ». Attendu : reconnexion, puis notre bloc remplace le sien. Chronométrer la reconnexion (plus de 8 s : un identifiant mort essayé en premier).
   - **Cas 2, toujours connecté** : l'ampoule reste bleue. Taper : notre bloc remplace le sien sans alerte.
   - Dans les deux cas, noter si **son** téléphone est déconnecté par notre envoi ou notre reconnexion.
5. **Identité de passage** (board libre, question ouverte). Se connecter, faire se connecter un autre téléphone puis le déconnecter, et taper l'ampoule pendant les 2 minutes où la seconde identité existe. Attendu : le bloc s'allume. Si le toast s'affiche et que rien ne s'allume, c'est le risque connu (écriture sans réponse).
6. **Bluetooth coupé** (question ouverte de la carte Board). Couper le Bluetooth, relancer l'app, ouvrir Home puis un bloc. Noter le message de la carte et celui de l'ampoule.

### À noter

| Test | Résultat |
| --- | --- |
| 1. 8 LED, couleurs et positions conformes | |
| 2. Changement de bloc : les anciennes s'éteignent | |
| 3. Disconnect : « No board connected » | |
| 4. Autre grimpeur : cas 1 ou cas 2 ; durée de la reconnexion ; son téléphone déconnecté ? | |
| 5. Identité de passage : allumé ou non | |
| 6. Bluetooth coupé : messages | |

### Ce que chaque résultat décide

- **1 ou 2 faux** : une prise mal placée = `holdCode` ou LED de la taille (`hold_leds`) ; une couleur fausse = `LED_ROLE` dans `lib/board/litHolds.ts`.
- **4, cas 1 lent** : essayer d'abord l'identifiant qui a servi à la dernière connexion (le garder dans `lastBoard`).
- **4, son téléphone déconnecté par notre envoi** : le dernier envoi l'emporte bien ; décision confirmée. **Les deux restent connectés** : une connexion par identité, à reporter dans les questions ouvertes de `DECISIONS.md`.
- **5, rien ne s'allume** : il faut une confirmation après envoi, ou éviter les identités de passage à la connexion.
