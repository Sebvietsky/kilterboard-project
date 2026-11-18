// Protocole BLE de la Kilter (docs/ble-protocol.md), niveau d'API 3.
// Validé sur une vraie board le 2026-10-23 (docs/notes/ble-essai-salle.md) :
// fonctions pures, partagées par la connexion et l'écran d'essai.

// Section 1. Le scan filtre sur le service d'advertising : c'est le seul que
// la board diffuse. L'écriture passe par le service UART.
export const ADVERTISING_SERVICE_UUID = '4488b571-7806-4df6-bcff-a2897e4953ff';
export const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const UART_WRITE_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// Section 2 : une écriture BLE porte 20 octets (MTU 23, relevé en salle).
export const CHUNK_SIZE = 20;

// Section 3, API 3 : place du paquet dans le message, premier octet du
// payload. Un message d'un seul paquet utilise `only`, jamais `first`.
// `only` envoyé sans prise éteint la board.
const PACKET_API3 = {
  only: 0x54, // 'T'
  first: 0x52, // 'R'
  middle: 0x51, // 'Q'
  last: 0x53, // 'S'
} as const;

// Un paquet fait au plus 260 octets, dont 5 d'encadrement : 255 octets de
// payload, que la longueur (un octet) ne peut pas dépasser. Soit l'indicateur
// et 84 prises de 3 octets (253 octets).
const MAX_HOLDS_PER_PACKET = 84;

// `led_color` de `board_placement_roles` (Kilter Original, product 1), et non
// `screen_color` : la couleur d'écran du start est 00DD00.
export const ROLE_LED_COLORS = {
  start: '00FF00',
  hand: '00FFFF',
  finish: 'FF00FF',
  foot: 'FFA500',
} as const;
export type LedRole = keyof typeof ROLE_LED_COLORS;

// Une prise à allumer : sa LED dans la taille de la board, et son rôle.
export type LitHold = { position: number; role: LedRole };

// Section 4, API 3 : 3 bits de rouge, 3 de vert, 2 de bleu. L'orange des
// pieds (FFA500) devient FFB600, qui paraît jaune sur la board : attendu.
export function colorApi3(hex: string): number {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const r3 = Math.round((r / 255) * 7);
  const g3 = Math.round((g / 255) * 7);
  const b2 = Math.round((b / 255) * 3);
  return (r3 << 5) | (g3 << 2) | b2;
}

// Section 4 : par prise, la position sur 2 octets (little-endian), puis la
// couleur.
function holdBytes({ position, role }: LitHold): number[] {
  return [
    position & 0xff,
    (position >> 8) & 0xff,
    colorApi3(ROLE_LED_COLORS[role]),
  ];
}

// Section 3 : 0x01, longueur du payload, checksum, 0x02, payload, 0x03.
function framePacket(payload: number[]): number[] {
  const sum = payload.reduce((acc, byte) => acc + byte, 0);
  const checksum = ~(sum & 0xff) & 0xff;
  return [0x01, payload.length, checksum, 0x02, ...payload, 0x03];
}

// Message complet qui allume ces prises, et seulement elles : un paquet par
// tranche de 84 prises, mis bout à bout. Le découpage en morceaux BLE de 20
// octets (`chunks`) ignore ensuite ces frontières (section 2).
export function lightMessage(holds: LitHold[]): number[] {
  const groups: LitHold[][] = [];
  for (let start = 0; start < holds.length; start += MAX_HOLDS_PER_PACKET) {
    groups.push(holds.slice(start, start + MAX_HOLDS_PER_PACKET));
  }
  // Aucune prise : un paquet `only` vide, qui éteint la board.
  if (groups.length <= 1) {
    return framePacket([
      PACKET_API3.only,
      ...(groups[0] ?? []).flatMap(holdBytes),
    ]);
  }
  return groups.flatMap((group, index) => {
    const place =
      index === 0
        ? PACKET_API3.first
        : index === groups.length - 1
          ? PACKET_API3.last
          : PACKET_API3.middle;
    return framePacket([place, ...group.flatMap(holdBytes)]);
  });
}

// Message qui éteint toute la board.
export function turnOffMessage(): number[] {
  return lightMessage([]);
}

// Section 2 : le paquet part en tranches de CHUNK_SIZE octets, écrites en série.
export function chunks(packet: number[]): number[][] {
  const result: number[][] = [];
  for (let start = 0; start < packet.length; start += CHUNK_SIZE) {
    result.push(packet.slice(start, start + CHUNK_SIZE));
  }
  return result;
}

// ble-plx échange des valeurs en base64.
export function toBase64(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes));
}

export function toHex(bytes: number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}
