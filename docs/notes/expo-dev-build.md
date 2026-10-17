# Expo SDK 55 et development build

## Pourquoi le SDK 55

`apps/mobile` est sur Expo SDK 55 / RN 0.83 / React 19.2, New Architecture activée (`newArchEnabled: true`). Choix délibéré de Seb, raisons reconstituées le 2026-07-29 :

- démarrer sur l'architecture cible plutôt que d'accumuler une dette de migration ;
- React 19 et ses règles de lint plus strictes ;
- éviter un upgrade de SDK, l'opération de maintenance la plus pénible en Expo.

## Conséquence : Expo Go ne peut pas lancer le projet

- Message : « requires a newer version of Expo Go ». L'Expo Go de l'App Store ne supporte que le dernier SDK stable ; il n'en existe pas de plus récent à installer.
- Ce n'est pas vraiment un coût du SDK : « Display on Board » (Bluetooth) demande un module natif, qu'Expo Go ne charge pas. Un development build était inévitable.

## Build iOS sur iPhone physique — reporté le 2026-07-30

- `brew install cocoapods` (absent de la machine).
- `pnpm --filter mobile exec expo run:ios --device`, téléphone branché en USB.
- Le prebuild génère `ios/` et `android/` : ils sont déjà dans `.gitignore`.
- Apple ID gratuit : signature valable 7 jours. Compte payant (99 $/an) : un an.
- EAS Build ne dépanne pas : installer sur un iPhone physique passe par une distribution ad-hoc, qui exige le compte développeur payant.

## À valider au build natif

- Comportement du clavier sur Android pour les écrans d'auth : `app.json` a `edgeToEdgeEnabled: true`, et en edge-to-edge les insets du clavier ne suivent pas toujours `adjustResize`. Si le CTA reste masqué, chercher côté insets, pas côté `behavior`.
- Autofill de bout en bout : dépend des associated domains.
