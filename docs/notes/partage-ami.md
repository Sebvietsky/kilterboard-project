# Faire tester l'app à un ami, sans environnement local

Mis en place le 2026-10-24 pour Nicolas (iPhone 12, iOS 18.7, UDID `00008101-0005311E22E1001E`).

## Principe

- Build Release : le JS est intégré à l'app, pas de Metro.
- L'API et Postgres restent sur le Mac de Seb, exposés par ngrok avec un domaine fixe : `https://autopilot-cofounder-outlet.ngrok-free.dev`.
- L'URL est figée au build par `EXPO_PUBLIC_API_URL` en début de commande (le `.env` n'est pas modifié).
- Domaine fixe et non tunnel rapide cloudflared : recompiler demande d'avoir l'iPhone de l'ami en main.

## Pour qu'il puisse s'en servir (3 terminaux, à laisser ouverts)

1. `pnpm --filter api start:dev`
2. `ngrok http --url=autopilot-cofounder-outlet.ngrok-free.dev 3000`
3. `caffeinate -i`

Écran fermé = veille = tout est coupé ; au réveil, ngrok se reconnecte seul. Changer de réseau ou d'IP ne casse rien.
Vérification : `https://autopilot-cofounder-outlet.ngrok-free.dev/grades` (cliquer « Visit Site »).

## Installer ou renouveler (tous les 7 jours, iPhone branché), depuis `apps/mobile/ios`

```
EXPO_PUBLIC_API_URL=https://autopilot-cofounder-outlet.ngrok-free.dev xcodebuild -workspace KilterBoard.xcworkspace -scheme KilterBoard -configuration Release -destination 'id=00008101-0005311E22E1001E' -allowProvisioningUpdates -allowProvisioningDeviceRegistration build
xcrun devicectl device install app --device 00008101-0005311E22E1001E ~/Library/Developer/Xcode/DerivedData/KilterBoard-*/Build/Products/Release-iphoneos/KilterBoard.app
```

## Pièges

- `expo run:ios --device` échoue : « Provisioning profile doesn't include the currently selected device ». Expo ne passe pas `-allowProvisioningUpdates`, d'où `xcodebuild` en direct.
- iOS 18 : « Mode développeur » est caché tant que Xcode n'a pas vu l'iPhone (`devicectl` affiche `no DDI`). Il apparaît après la première installation.
- Au premier lancement : Réglages › Général › VPN et gestion de l'appareil › faire confiance au certificat.
- Compte Apple gratuit : ni TestFlight ni ad hoc, installation par câble uniquement.

## Sécurité

- L'API est joignable depuis internet tant que le tunnel tourne. Mots de passe du seed (`kilter_admin`, `test_user_N`) dans le dépôt : ne lancer le tunnel que pendant l'usage.
- L'authtoken ngrok a été collé dans une conversation : à régénérer.
