# Expo SDK 55 et development build

## Pourquoi le SDK 55

`apps/mobile` est sur Expo SDK 55 / RN 0.83 / React 19.2, New Architecture activée (`newArchEnabled: true`). Choix délibéré de Seb, raisons reconstituées le 2026-07-29 :

- démarrer sur l'architecture cible plutôt que d'accumuler une dette de migration ;
- React 19 et ses règles de lint plus strictes ;
- éviter un upgrade de SDK, l'opération de maintenance la plus pénible en Expo.

## Conséquence : Expo Go ne peut pas lancer le projet

- Message : « requires a newer version of Expo Go ». L'Expo Go de l'App Store ne supporte que le dernier SDK stable ; il n'en existe pas de plus récent à installer.
- Ce n'est pas vraiment un coût du SDK : « Display on Board » (Bluetooth) demande un module natif, qu'Expo Go ne charge pas. Un development build était inévitable.

## Premier build, 2026-10-19 : Xcode 27 casse le SDK 55

Machine : Xcode 27.1 (iOS SDK 27.1), iPhone 15 sous iOS 27. CocoaPods 1.17.0 installé (`brew install cocoapods`).

- **`expo run:ios` échoue** (« Can't determine id of Simulator app ») : Xcode 27 a remplacé `Simulator.app` par `DeviceHub.app`, et le contrôle de `@expo/cli` 55 (55.0.36 compris) ne connaît que l'ancien. Contournement : `prebuild`, puis `xcodebuild` (ou Run dans Xcode sur `KilterBoard.xcworkspace`), puis `xcrun devicectl device install app`.
- **Cible iOS des Pods** : Xcode 27 refuse une cible sous 15.0 (SDWebImage, RNSVG), et `expo-router` 55 appelle une API iOS 16. Cible de l'app fixée à 16.0 par `expo-build-properties` ; le plugin `apps/mobile/plugins/with-pods-deployment-target.js` aligne chaque Pod dessus.
- **Signature** : `ios.appleTeamId` dans `app.json` (Personal Team), sinon perdue à chaque `prebuild --clean`. Au premier build, autoriser `codesign` dans le trousseau (« Toujours autoriser »).
- **L'app compile et s'installe, puis plante au lancement** (SIGTRAP, `UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`) : iOS 27 exige le cycle de vie UIScene des apps compilées avec son SDK. Le modèle iOS du SDK 55 crée la fenêtre dans l'`AppDelegate` ; celui du SDK 58 a un `SceneDelegate` (vérifié dans `expo-template-bare-minimum` 58.0.25). Décision : monter en SDK 58 (`chore/expo-sdk-58`).

## SDK 58, 2026-10-19 : l'app démarre sur iOS 27

- Expo 58.0.16, React Native 0.88, React 19.3, expo-router 58, TypeScript 6.0. Le modèle iOS a un `SceneDelegate` : plus de crash au lancement.
- Cible iOS 16.4 (défaut du SDK 58), toujours fixée par `expo-build-properties`. Le plugin des Pods reste.
- `@expo/cli` 58.1.13 reconnaît DeviceHub : `pnpm --filter mobile exec expo run:ios --device` devrait refonctionner (non testé ; le build a été fait par `xcodebuild`).
- Adaptations du code : `baseUrl` retiré du `tsconfig` (déprécié en TS 6) ; `onRefresh={() => void x.refetch()}` (RN 0.88 type `onRefresh` en `() => void | Promise<void>`) ; `undefined` et non `null` dans `ListFooterComponent` ; `redirectTo="/login"` sur le `Stack.Protected` authentifié (expo-router 58 redirige une route gardée vers le premier enfant accessible, `(auth)`, dont l'URL est `/`).
- pnpm 11 refuse les paquets publiés depuis trop peu de temps : `minimumReleaseAgeExclude` dans `pnpm-workspace.yaml` liste les paquets Expo 58 concernés, chacun à sa version exacte.
- Après une mise à jour des dépendances : redémarrer Metro avec `--clear`.
- Signature gratuite : l'app expire au bout de 7 jours, il faut alors recompiler.

## Build iOS sur iPhone physique — reporté le 2026-07-30

- `brew install cocoapods` (absent de la machine).
- `pnpm --filter mobile exec expo run:ios --device`, téléphone branché en USB.
- Le prebuild génère `ios/` et `android/` : ils sont déjà dans `.gitignore`.
- Apple ID gratuit : signature valable 7 jours. Compte payant (99 $/an) : un an.
- EAS Build ne dépanne pas : installer sur un iPhone physique passe par une distribution ad-hoc, qui exige le compte développeur payant.

## À valider au build natif

- Comportement du clavier sur Android pour les écrans d'auth : `app.json` a `edgeToEdgeEnabled: true`, et en edge-to-edge les insets du clavier ne suivent pas toujours `adjustResize`. Si le CTA reste masqué, chercher côté insets, pas côté `behavior`.
- Autofill de bout en bout : dépend des associated domains.
