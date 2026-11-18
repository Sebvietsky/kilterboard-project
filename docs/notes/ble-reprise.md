# BLE — décisions pour la reprise

Reco faite le 2026-07-31, puis chantier gelé : le périmètre de l'écran Session a été resserré au cycle de vie. Le BLE reviendra comme un widget autonome dans `session.tsx`. Rien n'est installé, rien n'est câblé.

La spec du protocole est dans `docs/ble-protocol.md` (UUID, chunks de 20 octets, format de paquet, encodage API 2/3, table couleurs ↔ rôles). À la reprise, la lire en premier et ne pas re-sourcer le protocole. Les points incertains y sont marqués À VÉRIFIER.

## Déjà arbitré

- **Lib** : `react-native-ble-plx` (config plugin Expo). Risque à revalider : compatibilité New Architecture (`newArchEnabled: true`).
- **Le BLE impose un development build** : Expo Go ne charge pas de module natif custom. Voir `docs/notes/expo-dev-build.md`, qui devient un prérequis bloquant.
- **Architecture** : interface `BoardConnection` + adaptateur simulé d'abord. Elle permet de construire l'encodeur et l'UI sans avoir fait le dev build.
- **Données LED** : s'aligner sur le modèle d'origine Aurora et réutiliser leurs données (base SQLite : `placements`, `leds`, `placement_roles`), plus rapide que de reconstruire.

## Écart à combler

- Notre modèle `Hold` n'a pas de position LED.
- `prisma/seed.ts` génère une grille synthétique 12×12 qui ne correspond à aucun board physique. À réaligner.

## À ne pas confondre

Les couleurs LED du board physique sont imposées par le matériel. Les tokens `holds` de la DA servent à la visualisation dans l'app. Ce sont deux choses distinctes.
