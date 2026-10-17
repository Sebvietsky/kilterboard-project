# Protocole BLE — board Aurora / Kilter

Spec de référence pour notre implémentation. Nous **réécrivons l'encodeur
nous-mêmes** ; ce document décrit le format du fil, pas une bibliothèque.

## Sources

Protocole reconstitué par rétro-ingénierie communautaire (aucune spec
officielle publiée par Aurora Climbing) :

- [`1-max-1/fake_kilter_board`](https://github.com/1-max-1/fake_kilter_board) —
  simulateur ESP32 + Processing, README et code du parser de trames. Source
  principale pour le format de paquet et les deux niveaux d'API.
- [`bazun.me/blog/kiterboard`](https://bazun.me/blog/kiterboard) — article de
  rétro-ingénierie du protocole (UUID, découpage, checksum).
- [`lemeryfertitta/BoardLib`](https://github.com/lemeryfertitta/BoardLib) —
  package Python de synchronisation de la base SQLite officielle
  (`placements`, `placement_roles`, `leds`) : source de la correspondance
  prise → position LED et rôle → couleur.

⚠️ Ces sources sont non officielles. Tout ce qui est marqué **À VÉRIFIER**
ci-dessous doit être confirmé contre un board réel ou contre la base SQLite
avant d'être figé dans le code.

---

## 1. Découverte et connexion

| Élément | UUID |
| --- | --- |
| Service d'advertising (filtre de scan) | `4488B571-7806-4DF6-BCFF-A2897E4953FF` |
| Service UART (Nordic NUS) | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` |
| Caractéristique d'écriture | `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` |

Le scan se filtre sur le **service d'advertising**, pas sur le service UART :
seul le premier est diffusé dans les trames d'advertising.

La communication est **unidirectionnelle** : on écrit sur la caractéristique
d'écriture, le board n'a rien à nous renvoyer. Pas de notify à souscrire pour
allumer des prises. Écriture **sans réponse** (write-without-response), d'où la
contrainte de 20 octets ci-dessous.

### Nom du board et niveau d'API

Le nom advertisé suit le format `alphanumérique[#série][#niveauAPI]`.
Le dernier segment donne le **niveau d'API** : `2` ou `3`. C'est ce niveau qui
détermine l'encodage des prises (section 4). **3 est le standard actuel.**

Si le nom ne porte pas de niveau, on suppose `3`.

---

## 2. Découpage en chunks de 20 octets

La MTU BLE par défaut permet 20 octets utiles par écriture sans réponse. Le
message complet (potentiellement plusieurs centaines d'octets) est donc
**découpé en tranches de 20 octets**, écrites séquentiellement sur la
caractéristique.

Points d'attention pour notre implémentation :

- Le découpage est purement mécanique — il ne respecte **pas** les frontières
  de paquets ni de groupes de prises. On sérialise d'abord le message complet
  en un buffer, on le tranche ensuite.
- Écrire les chunks **en série**, en attendant la résolution de chaque
  écriture. En parallèle, la pile BLE peut réordonner ou saturer.
- Un petit délai entre chunks (quelques ms) est souvent nécessaire en pratique
  sur Android. **À VÉRIFIER** sur device réel.

## 3. Format d'un paquet

Un message = une suite de **paquets**, chacun limité à **260 octets** au total.
Quand ajouter un groupe de prises ferait dépasser cette limite, on clôt le
paquet courant et on en ouvre un nouveau.

```
┌────────┬────────┬──────────┬────────┬──────────────┬────────┐
│  0x01  │  len   │ checksum │  0x02  │   payload    │  0x03  │
└────────┴────────┴──────────┴────────┴──────────────┴────────┘
   en-tête  taille   contrôle  début     données       fin
```

| Octet | Valeur | Rôle |
| --- | --- | --- |
| 0 | `0x01` | En-tête de paquet |
| 1 | `len` | Longueur du **payload** (octets 4..4+len-1), en octets |
| 2 | `checksum` | Somme de contrôle du payload (voir ci-dessous) |
| 3 | `0x02` | Marqueur de début de données |
| 4..n | payload | Données (voir section 4) |
| n+1 | `0x03` | Terminateur de paquet |

### Checksum

Somme de tous les octets du payload, repliée sur un octet puis complémentée :

```
checksum = (~(sum(payload) & 0xFF)) & 0xFF
```

En TypeScript, penser à `>>> 0` / masquage explicite : `~` opère sur un entier
signé 32 bits.

---

## 4. Payload : encodage des prises

Le payload commence par un **indicateur de position dans le message**, qui
indique où se situe ce paquet dans la séquence. Sa valeur dépend du niveau
d'API :

| Position dans le message | API 2 | API 3 |
| --- | --- | --- |
| Premier paquet (`first`) | `78` (`'N'`) | `82` (`'R'`) |
| Paquet intermédiaire (`middle`) | `77` (`'M'`) | `81` (`'Q'`) |
| Dernier paquet (`last`) | `79` (`'O'`) | `83` (`'S'`) |
| Paquet unique (`only`) | `80` (`'P'`) | `84` (`'T'`) |

Un message qui tient dans un seul paquet utilise donc `only`, pas `first`.

Suit une **suite de groupes de prises**, un groupe par LED à allumer.

### API level 2 — groupe de 2 octets

Position sur 10 bits, couleur sur 6 bits (2 bits par canal → 64 couleurs).

```
octet 0 : position & 0xFF                       (8 bits bas de la position)
octet 1 : ((position >> 8) & 0x03)              (2 bits hauts de la position)
        | ((R2 & 0x03) << 2)                    (rouge sur 2 bits)
        | ((G2 & 0x03) << 4)                    (vert sur 2 bits)
        | ((B2 & 0x03) << 6)                    (bleu sur 2 bits)
```

**À VÉRIFIER** : l'ordre exact des champs de couleur dans l'octet 1 (R en bits
hauts ou bas) diffère selon les descriptions communautaires. Vérifier contre le
simulateur avant de figer.

Réduction 8 bits → 2 bits par canal : `c2 = round(c8 / 255 * 3)`.

### API level 3 — groupe de 3 octets

Position sur 16 bits (little-endian), couleur sur 8 bits (3 bits R, 3 bits G,
2 bits B → 512 combinaisons nominales, 256 valeurs encodables).

```
octet 0 : position & 0xFF          (8 bits bas)
octet 1 : (position >> 8) & 0xFF   (8 bits hauts)
octet 2 : ((R3 & 0x07) << 5)       (rouge sur 3 bits)
        | ((G3 & 0x07) << 2)       (vert sur 3 bits)
        | ( B2 & 0x03)             (bleu sur 2 bits)
```

Réduction : `R3 = round(R8 / 255 * 7)`, `G3` idem, `B2 = round(B8 / 255 * 3)`.

C'est le format que nous implémentons **en premier** (standard actuel).

### `position` : ce que c'est

`position` n'est **pas** une coordonnée de grille (x, y). C'est l'**index de la
LED** dans la chaîne physique du board, donné par la table `leds` de la base
SQLite officielle, jointe à `placements` (voir section 5 et
`docs/` sur les données de prises).

Conséquence : on ne peut pas calculer une position à partir de nos coordonnées
`Hold.x` / `Hold.y`. Il faut une table de correspondance
`holdCode → ledPosition` propre au layout et à l'angle du board.

---

## 5. Couleurs LED et rôles de prise

### ⚠️ Deux systèmes de couleurs distincts — ne pas confondre

| | Couleurs LED (ce document) | Tokens `holds` de notre DA |
| --- | --- | --- |
| Où | Board **physique**, via BLE | Visualisation **in-app** du bloc |
| Qui décide | Le protocole / la base officielle | Notre design system |
| Contrainte | Imposées, non négociables | Libres, cohérentes avec la charte |
| Palette | 3+3+2 bits (quantifiée) | RGB complet |

Un grimpeur qui regarde le board voit les couleurs Aurora ; le même bloc dans
l'app est rendu avec nos tokens. **C'est normal et voulu.** Ne jamais envoyer
un token de la DA sur le fil BLE, ni recolorer la carte board de l'app avec les
couleurs LED pour « faire pareil ».

### Correspondance rôle → couleur (Kilter Original)

| Rôle (notre `HoldRole`) | Rôle Aurora | Couleur | Hex |
| --- | --- | --- | --- |
| `START` | start | vert | `#00DD00` |
| `HAND` | middle | cyan | `#00FFFF` |
| `FINISH` | finish | magenta | `#FF00FF` |
| `FOOT` | foot | orange | `#FFA500` |

**À VÉRIFIER** — ces valeurs sont la convention Kilter largement documentée,
mais la source d'autorité est la table `placement_roles` (`led_color`) de la
base SQLite, et elle **varie selon le produit** (Tension, Decoy, Grasshopper
n'ont pas la même palette). Notre implémentation doit :

1. lire les couleurs depuis une table de correspondance versionnée dans le repo,
   extraite de `placement_roles` — pas des constantes inventées ;
2. ne pas supposer que les 4 rôles de notre enum `HoldRole` couvrent tous les
   rôles Aurora (certains layouts en ont davantage).

Après quantification en API 3, ces couleurs deviennent :

| Hex | R8,G8,B8 | R3,G3,B2 | Octet couleur |
| --- | --- | --- | --- |
| `#00DD00` | 0, 221, 0 | 0, 6, 0 | `0b000_110_00` = `0x18` |
| `#00FFFF` | 0, 255, 255 | 0, 7, 3 | `0b000_111_11` = `0x1F` |
| `#FF00FF` | 255, 0, 255 | 7, 0, 3 | `0b111_000_11` = `0xE3` |
| `#FFA500` | 255, 165, 0 | 7, 5, 0 | `0b111_101_00` = `0xF4` |

(Valeurs dérivées de la formule de la section 4 — à recalculer dans le code,
pas à recopier en dur, pour rester juste si les couleurs sources changent.)

---

## 6. Séquence complète d'envoi d'un bloc

1. Récupérer les prises du bloc et leurs rôles.
2. Mapper chaque prise vers sa `ledPosition` (table de correspondance layout).
3. Mapper chaque rôle vers sa couleur, puis quantifier selon le niveau d'API.
4. Sérialiser les groupes de prises en paquets ≤ 260 octets, avec l'indicateur
   de position (`only` / `first` / `middle` / `last`) correct.
5. Concaténer les paquets, découper en chunks de 20 octets.
6. Écrire chaque chunk en série sur la caractéristique d'écriture.

**Éteindre le board** = envoyer un message avec une liste de prises vide (un
seul paquet `only`, payload réduit à l'indicateur). **À VÉRIFIER** sur le
simulateur.

---

## 7. Ce que ce document ne couvre pas

- Le pairing / bonding : le board ne demande pas d'appairage, connexion GATT
  directe.
- La lecture d'état : le protocole est en écriture seule côté board LED.
- Les autres produits Aurora (Tension, Decoy…) : mêmes UUID et même format de
  paquet, mais tables de positions et palettes différentes.
