// Écran d'essai BLE : outil de diagnostic devant la board, conservé tant que
// la vraie connexion ne le remplace pas (scan sans filtre, journal, motifs de
// test par taille). Protocole : docs/ble-protocol.md, encodé dans
// lib/board/protocol.ts. Marche à suivre : docs/notes/ble-essai-salle.md.
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { State, type BleManager, type Device } from 'react-native-ble-plx';
import { useBleManager } from '@/lib/board/BleManagerContext';
import { useBoardStore } from '@/lib/board/useBoardStore';
import type { LazyBleManager } from '@/lib/board/lazyBleManager';
import {
  ADVERTISING_SERVICE_UUID,
  UART_SERVICE_UUID,
  UART_WRITE_UUID,
  chunks,
  lightMessage,
  toBase64,
  toHex,
  turnOffMessage,
  type LitHold,
} from '@/lib/board/protocol';
import { colors, spacing, typography, radii } from '@/constants/theme';

const SCAN_DURATION_MS = 10_000;

type TestHold = LitHold & { hole: string };
type SizeTest = { label: string; holds: TestHold[] };

// Pour chaque taille candidate, les prises les plus proches des 4 coins et du
// centre de la board, avec leur LED dans cette taille (`board_leds`, catalogue
// du 2026-10-17). Seule la bonne taille allume les 4 coins et le centre : les
// autres allument des prises éparses, ou rien (la LED n'existe pas).
// Un rôle par coin : le même appui vérifie aussi les 4 couleurs.
const SIZE_TESTS: SizeTest[] = [
  {
    label: '12 x 12 with kickboard',
    holds: [
      { role: 'start', hole: '1,KB1', position: 33 }, // bas gauche
      { role: 'hand', hole: '35,KB1', position: 0 }, // bas droite
      { role: 'foot', hole: '2,35', position: 68 }, // haut gauche
      { role: 'finish', hole: '34,35', position: 476 }, // haut droite
      { role: 'start', hole: '18,17', position: 260 }, // centre
    ],
  },
  {
    label: '12 x 14',
    holds: [
      { role: 'start', hole: '1,KB1', position: 33 },
      { role: 'hand', hole: '35,KB1', position: 0 },
      { role: 'foot', hole: '2,41', position: 71 },
      { role: 'finish', hole: '34,41', position: 527 },
      { role: 'start', hole: '18,19', position: 285 },
    ],
  },
  {
    label: '12 x 12 without kickboard',
    holds: [
      { role: 'start', hole: '2,1', position: 0 },
      { role: 'hand', hole: '34,1', position: 416 },
      { role: 'foot', hole: '2,35', position: 32 },
      { role: 'finish', hole: '34,35', position: 440 },
      { role: 'start', hole: '17,18', position: 198 },
    ],
  },
];

// Dessin « Element x Millet » de l'app Kilter (image 3/3), relevé sur une
// capture le 2026-10-23 : 39 prises Bolt Ons, LED de la taille 12 x 12 with
// kickboard (`board_leds`, product_size_id 10). Anneau en pied, motif central
// en main, une prise finish en haut et une start sous le motif. `hole` : nom
// du trou, colonne,rangée.
const DRAWING: SizeTest = {
  label: 'Draw Element x Millet',
  holds: [
    { role: 'finish', hole: '18,31', position: 270 },
    { role: 'foot', hole: '14,31', position: 219 },
    { role: 'foot', hole: '22,31', position: 321 },
    { role: 'foot', hole: '10,29', position: 167 },
    { role: 'foot', hole: '26,29', position: 371 },
    { role: 'foot', hole: '6,25', position: 113 },
    { role: 'foot', hole: '30,25', position: 419 },
    { role: 'foot', hole: '4,21', position: 79 },
    { role: 'foot', hole: '32,21', position: 436 },
    { role: 'foot', hole: '4,17', position: 82 },
    { role: 'foot', hole: '32,17', position: 439 },
    { role: 'foot', hole: '4,13', position: 85 },
    { role: 'foot', hole: '32,13', position: 442 },
    { role: 'foot', hole: '6,9', position: 101 },
    { role: 'foot', hole: '30,9', position: 407 },
    { role: 'foot', hole: '10,5', position: 149 },
    { role: 'foot', hole: '26,5', position: 353 },
    { role: 'start', hole: '18,9', position: 254 },
    { role: 'foot', hole: '18,3', position: 249 },
    { role: 'hand', hole: '18,25', position: 266 },
    { role: 'hand', hole: '16,23', position: 230 },
    { role: 'hand', hole: '18,23', position: 264 },
    { role: 'hand', hole: '20,23', position: 281 },
    { role: 'hand', hole: '14,21', position: 212 },
    { role: 'hand', hole: '18,21', position: 263 },
    { role: 'hand', hole: '22,21', position: 314 },
    { role: 'hand', hole: '16,19', position: 233 },
    { role: 'hand', hole: '18,19', position: 261 },
    { role: 'hand', hole: '20,19', position: 284 },
    { role: 'hand', hole: '14,17', position: 209 },
    { role: 'hand', hole: '18,17', position: 260 },
    { role: 'hand', hole: '22,17', position: 311 },
    { role: 'hand', hole: '16,15', position: 236 },
    { role: 'hand', hole: '18,15', position: 258 },
    { role: 'hand', hole: '20,15', position: 287 },
    { role: 'hand', hole: '14,13', position: 206 },
    { role: 'hand', hole: '18,13', position: 257 },
    { role: 'hand', hole: '22,13', position: 308 },
    { role: 'hand', hole: '18,11', position: 255 },
  ],
};

// Logo Element, généré le 2026-10-23 par géométrie sur les coordonnées des
// Bolt Ons (catalogue, taille 10), centre (72, 84) : anneau extérieur coupé
// (main), anneau intérieur ouvert en haut (pied), arbre en chevrons (start),
// pointe en finish. 80 prises : sous les 84 d'un paquet unique.
const ELEMENT_LOGO: SizeTest = {
  label: 'Draw Element logo',
  holds: [
    { role: 'hand', hole: '14,33', position: 220 },
    { role: 'hand', hole: '22,33', position: 322 },
    { role: 'hand', hole: '10,31', position: 168 },
    { role: 'hand', hole: '12,31', position: 173 },
    { role: 'hand', hole: '24,31', position: 326 },
    { role: 'hand', hole: '26,31', position: 372 },
    { role: 'hand', hole: '8,29', position: 124 },
    { role: 'hand', hole: '28,29', position: 379 },
    { role: 'foot', hole: '12,25', position: 178 },
    { role: 'finish', hole: '18,25', position: 266 },
    { role: 'foot', hole: '24,25', position: 331 },
    { role: 'hand', hole: '4,23', position: 77 },
    { role: 'foot', hole: '10,23', position: 162 },
    { role: 'start', hole: '16,23', position: 230 },
    { role: 'start', hole: '18,23', position: 264 },
    { role: 'start', hole: '20,23', position: 281 },
    { role: 'foot', hole: '26,23', position: 366 },
    { role: 'hand', hole: '32,23', position: 434 },
    { role: 'hand', hole: '4,21', position: 79 },
    { role: 'foot', hole: '8,21', position: 130 },
    { role: 'foot', hole: '10,21', position: 161 },
    { role: 'start', hole: '14,21', position: 212 },
    { role: 'start', hole: '18,21', position: 263 },
    { role: 'start', hole: '22,21', position: 314 },
    { role: 'foot', hole: '26,21', position: 365 },
    { role: 'foot', hole: '28,21', position: 385 },
    { role: 'hand', hole: '32,21', position: 436 },
    { role: 'hand', hole: '2,19', position: 54 },
    { role: 'hand', hole: '4,19', position: 80 },
    { role: 'foot', hole: '8,19', position: 131 },
    { role: 'start', hole: '16,19', position: 233 },
    { role: 'start', hole: '18,19', position: 261 },
    { role: 'start', hole: '20,19', position: 284 },
    { role: 'foot', hole: '28,19', position: 386 },
    { role: 'hand', hole: '32,19', position: 437 },
    { role: 'hand', hole: '34,19', position: 465 },
    { role: 'hand', hole: '2,17', position: 52 },
    { role: 'hand', hole: '4,17', position: 82 },
    { role: 'foot', hole: '8,17', position: 133 },
    { role: 'start', hole: '14,17', position: 209 },
    { role: 'start', hole: '18,17', position: 260 },
    { role: 'start', hole: '22,17', position: 311 },
    { role: 'foot', hole: '28,17', position: 388 },
    { role: 'hand', hole: '32,17', position: 439 },
    { role: 'hand', hole: '34,17', position: 464 },
    { role: 'hand', hole: '4,15', position: 83 },
    { role: 'foot', hole: '8,15', position: 134 },
    { role: 'foot', hole: '10,15', position: 156 },
    { role: 'start', hole: '16,15', position: 236 },
    { role: 'start', hole: '18,15', position: 258 },
    { role: 'start', hole: '20,15', position: 287 },
    { role: 'foot', hole: '26,15', position: 360 },
    { role: 'foot', hole: '28,15', position: 389 },
    { role: 'hand', hole: '32,15', position: 440 },
    { role: 'hand', hole: '4,13', position: 85 },
    { role: 'foot', hole: '10,13', position: 155 },
    { role: 'start', hole: '14,13', position: 206 },
    { role: 'start', hole: '18,13', position: 257 },
    { role: 'start', hole: '22,13', position: 308 },
    { role: 'foot', hole: '26,13', position: 359 },
    { role: 'hand', hole: '32,13', position: 442 },
    { role: 'foot', hole: '12,11', position: 188 },
    { role: 'start', hole: '18,11', position: 255 },
    { role: 'foot', hole: '24,11', position: 341 },
    { role: 'foot', hole: '14,9', position: 203 },
    { role: 'foot', hole: '16,9', position: 241 },
    { role: 'foot', hole: '18,9', position: 254 },
    { role: 'foot', hole: '20,9', position: 292 },
    { role: 'foot', hole: '22,9', position: 305 },
    { role: 'hand', hole: '8,7', position: 140 },
    { role: 'hand', hole: '28,7', position: 395 },
    { role: 'hand', hole: '10,5', position: 149 },
    { role: 'hand', hole: '12,5', position: 193 },
    { role: 'hand', hole: '24,5', position: 346 },
    { role: 'hand', hole: '26,5', position: 353 },
    { role: 'hand', hole: '14,3', position: 198 },
    { role: 'hand', hole: '16,3', position: 245 },
    { role: 'hand', hole: '18,3', position: 249 },
    { role: 'hand', hole: '20,3', position: 296 },
    { role: 'hand', hole: '22,3', position: 300 },
  ],
};

// Logo Element, v2 (2026-10-23), à comparer avec la v1. Cercles de Bresenham
// (une prise d'épaisseur), centre (72, 80) : extérieur de rayon 8 prises sur
// les colonnes du bord, bas complet et haut en 4 bandes ; intérieur de rayon
// 6, complet ; sapin à branches de 3 prises. 97 prises : deux paquets
// (`first` puis `last`), premier essai du découpage sur la board.
const ELEMENT_LOGO_V2: SizeTest = {
  label: 'Draw Element logo v2',
  holds: [
    { role: 'hand', hole: '14,33', position: 220 },
    { role: 'hand', hole: '16,33', position: 223 },
    { role: 'hand', hole: '20,33', position: 274 },
    { role: 'hand', hole: '22,33', position: 322 },
    { role: 'hand', hole: '10,31', position: 168 },
    { role: 'hand', hole: '12,31', position: 173 },
    { role: 'hand', hole: '24,31', position: 326 },
    { role: 'hand', hole: '26,31', position: 372 },
    { role: 'foot', hole: '14,29', position: 218 },
    { role: 'foot', hole: '16,29', position: 226 },
    { role: 'foot', hole: '18,29', position: 269 },
    { role: 'foot', hole: '20,29', position: 277 },
    { role: 'foot', hole: '22,29', position: 320 },
    { role: 'foot', hole: '12,27', position: 176 },
    { role: 'foot', hole: '24,27', position: 329 },
    { role: 'hand', hole: '4,25', position: 76 },
    { role: 'foot', hole: '10,25', position: 164 },
    { role: 'finish', hole: '18,25', position: 266 },
    { role: 'foot', hole: '26,25', position: 368 },
    { role: 'hand', hole: '32,25', position: 433 },
    { role: 'hand', hole: '4,23', position: 77 },
    { role: 'foot', hole: '8,23', position: 128 },
    { role: 'start', hole: '16,23', position: 230 },
    { role: 'start', hole: '18,23', position: 264 },
    { role: 'start', hole: '20,23', position: 281 },
    { role: 'foot', hole: '28,23', position: 383 },
    { role: 'hand', hole: '32,23', position: 434 },
    { role: 'hand', hole: '2,21', position: 56 },
    { role: 'foot', hole: '6,21', position: 110 },
    { role: 'start', hole: '14,21', position: 212 },
    { role: 'start', hole: '18,21', position: 263 },
    { role: 'start', hole: '22,21', position: 314 },
    { role: 'foot', hole: '30,21', position: 416 },
    { role: 'hand', hole: '34,21', position: 467 },
    { role: 'hand', hole: '2,19', position: 54 },
    { role: 'foot', hole: '6,19', position: 108 },
    { role: 'start', hole: '12,19', position: 182 },
    { role: 'start', hole: '16,19', position: 233 },
    { role: 'start', hole: '18,19', position: 261 },
    { role: 'start', hole: '20,19', position: 284 },
    { role: 'start', hole: '24,19', position: 335 },
    { role: 'foot', hole: '30,19', position: 414 },
    { role: 'hand', hole: '34,19', position: 465 },
    { role: 'foot', hole: '6,17', position: 107 },
    { role: 'start', hole: '14,17', position: 209 },
    { role: 'start', hole: '18,17', position: 260 },
    { role: 'start', hole: '22,17', position: 311 },
    { role: 'foot', hole: '30,17', position: 413 },
    { role: 'hand', hole: '2,15', position: 50 },
    { role: 'foot', hole: '6,15', position: 105 },
    { role: 'start', hole: '12,15', position: 185 },
    { role: 'start', hole: '16,15', position: 236 },
    { role: 'start', hole: '18,15', position: 258 },
    { role: 'start', hole: '20,15', position: 287 },
    { role: 'start', hole: '24,15', position: 338 },
    { role: 'foot', hole: '30,15', position: 411 },
    { role: 'hand', hole: '34,15', position: 462 },
    { role: 'hand', hole: '2,13', position: 48 },
    { role: 'foot', hole: '6,13', position: 104 },
    { role: 'start', hole: '14,13', position: 206 },
    { role: 'start', hole: '18,13', position: 257 },
    { role: 'start', hole: '22,13', position: 308 },
    { role: 'foot', hole: '30,13', position: 410 },
    { role: 'hand', hole: '34,13', position: 461 },
    { role: 'hand', hole: '4,11', position: 86 },
    { role: 'foot', hole: '8,11', position: 137 },
    { role: 'start', hole: '12,11', position: 188 },
    { role: 'start', hole: '18,11', position: 255 },
    { role: 'start', hole: '24,11', position: 341 },
    { role: 'foot', hole: '28,11', position: 392 },
    { role: 'hand', hole: '32,11', position: 443 },
    { role: 'hand', hole: '4,9', position: 88 },
    { role: 'foot', hole: '10,9', position: 152 },
    { role: 'start', hole: '18,9', position: 254 },
    { role: 'foot', hole: '26,9', position: 356 },
    { role: 'hand', hole: '32,9', position: 445 },
    { role: 'hand', hole: '6,7', position: 99 },
    { role: 'foot', hole: '12,7', position: 191 },
    { role: 'start', hole: '18,7', position: 252 },
    { role: 'foot', hole: '24,7', position: 344 },
    { role: 'hand', hole: '30,7', position: 405 },
    { role: 'hand', hole: '8,5', position: 142 },
    { role: 'foot', hole: '14,5', position: 200 },
    { role: 'foot', hole: '16,5', position: 244 },
    { role: 'foot', hole: '18,5', position: 251 },
    { role: 'foot', hole: '20,5', position: 295 },
    { role: 'foot', hole: '22,5', position: 302 },
    { role: 'hand', hole: '28,5', position: 397 },
    { role: 'hand', hole: '10,3', position: 147 },
    { role: 'hand', hole: '12,3', position: 194 },
    { role: 'hand', hole: '24,3', position: 347 },
    { role: 'hand', hole: '26,3', position: 351 },
    { role: 'hand', hole: '14,1', position: 197 },
    { role: 'hand', hole: '16,1', position: 247 },
    { role: 'hand', hole: '18,1', position: 248 },
    { role: 'hand', hole: '20,1', position: 298 },
    { role: 'hand', hole: '22,1', position: 299 },
  ],
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function deviceLabel(device: Device): string {
  return device.name ?? device.localName ?? device.id;
}

// iOS démarre en `Unknown` : on attend `PoweredOn` avant de scanner.
function waitForPoweredOn(manager: BleManager): Promise<void> {
  return new Promise((resolve, reject) => {
    const subscription = manager.onStateChange((state) => {
      if (state === State.PoweredOn) {
        subscription.remove();
        resolve();
      } else if (state === State.PoweredOff || state === State.Unauthorized) {
        subscription.remove();
        reject(new Error(`Bluetooth is ${state}`));
      }
    }, true);
  });
}

export default function BleSpikeScreen() {
  // Le manager unique de l'app (RootLayout) ; `null` en connexion simulée.
  const lazyManager = useBleManager();
  if (!lazyManager) {
    return (
      <View style={styles.screen}>
        <Text style={styles.logEmpty}>
          Simulated board connection: no Bluetooth to test.
        </Text>
      </View>
    );
  }
  return <BleSpike lazyManager={lazyManager} />;
}

function BleSpike({ lazyManager }: { lazyManager: LazyBleManager }) {
  // Ouvrir l'écran d'essai, c'est vouloir le Bluetooth : le manager démarre
  // ici s'il ne l'a pas encore fait.
  const [manager] = useState(() => lazyManager.get());
  const [logs, setLogs] = useState<string[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connected, setConnected] = useState<Device | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  function log(message: string) {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`${time}  ${message}`, ...prev]);
  }

  // Le manager est partagé : en quittant l'écran, on coupe le scan et la
  // connexion de l'essai, sans le détruire.
  useEffect(() => {
    if (!connected) return;
    return () => {
      void manager.cancelDeviceConnection(connected.id).catch(() => {});
    };
  }, [manager, connected]);
  useEffect(() => {
    return () => {
      void manager.stopDeviceScan();
    };
  }, [manager]);

  // `filtered` : seulement les appareils qui diffusent le service Kilter.
  // Sans filtre (secours, si le filtre ne trouve rien) : tous les appareils
  // nommés, avec les services qu'ils diffusent, pour retrouver la board.
  async function handleScan(filtered: boolean) {
    if (isScanning) return;
    setDevices([]);
    try {
      await waitForPoweredOn(manager);
    } catch (error) {
      log(`Scan: ${errorMessage(error)}`);
      return;
    }

    setIsScanning(true);
    log(filtered ? 'Scan: started' : 'Scan (all devices): started');
    const found = new Set<string>();
    await manager.startDeviceScan(
      filtered ? [ADVERTISING_SERVICE_UUID] : null,
      null,
      (error, device) => {
        if (error) {
          log(`Scan error: ${error.message}`);
          return;
        }
        if (!device || found.has(device.id)) return;
        if (!filtered && !device.name && !device.localName) return;
        found.add(device.id);
        // Le nom porte le niveau d'API après un `@` (`…#75804@3`).
        const services = device.serviceUUIDs?.join(', ') ?? 'none';
        // Identifiant BLE et signal : une board qui change d'adresse en
        // s'annonçant à nouveau apparaît sous deux identifiants.
        log(
          `Found: ${deviceLabel(device)} [${device.id.slice(0, 8)}, ${device.rssi ?? '?'} dBm] (services: ${services})`,
        );
        setDevices((prev) => [...prev, device]);
      },
    );

    setTimeout(() => {
      void manager.stopDeviceScan();
      setIsScanning(false);
      log(
        found.size === 0
          ? 'Scan: nothing found (no board in range, or the Kilter app is connected to it)'
          : `Scan: stopped, ${found.size} device(s)`,
      );
    }, SCAN_DURATION_MS);
  }

  async function handleConnect(device: Device) {
    await manager.stopDeviceScan();
    setIsScanning(false);
    log(`Connect: ${deviceLabel(device)} [${device.id.slice(0, 8)}]…`);
    try {
      const connectedDevice = await manager.connectToDevice(device.id);
      await manager.discoverAllServicesAndCharacteristicsForDevice(
        connectedDevice.id,
      );
      manager.onDeviceDisconnected(connectedDevice.id, () => {
        setConnected(null);
        log('Disconnected');
      });
      setConnected(connectedDevice);
      log(`Connected (MTU ${connectedDevice.mtu})`);
    } catch (error) {
      log(`Connect error: ${errorMessage(error)}`);
    }
  }

  // Section 2 : tranches de 20 octets, écrites en série.
  // Connexion de l'essai si elle existe ; sinon celle de l'app (carte Board
  // de Home), qui passe par `BoardConnection` : on teste alors le vrai chemin.
  async function send(packet: number[]) {
    const board = useBoardStore.getState();
    if (!connected) {
      if (board.state.status !== 'connected' || !board.connection) {
        log('Not connected');
        return;
      }
      log(`Send (app connection): ${toHex(packet)}`);
      try {
        await board.connection.write(packet);
        log('Send: done');
      } catch (error) {
        log(`Send error: ${errorMessage(error)}`);
      }
      return;
    }
    log(`Send: ${toHex(packet)}`);
    try {
      for (const chunk of chunks(packet)) {
        await manager.writeCharacteristicWithoutResponseForDevice(
          connected.id,
          UART_SERVICE_UUID,
          UART_WRITE_UUID,
          toBase64(chunk),
        );
      }
      log('Send: done');
    } catch (error) {
      log(`Send error: ${errorMessage(error)}`);
    }
  }

  function handleSizeTest(test: SizeTest) {
    log(`Test: ${test.label}`);
    void send(lightMessage(test.holds));
  }

  // Liste vide : éteint la board (vérifié en salle le 2026-10-23).
  function handleTurnOff() {
    void send(turnOffMessage());
  }

  return (
    <View style={styles.screen}>
      <View style={styles.actions}>
        <View style={styles.row}>
          <SpikeButton
            label={isScanning ? 'Scanning…' : 'Scan'}
            onPress={() => void handleScan(true)}
          />
          <SpikeButton
            label="Scan all"
            variant="secondary"
            onPress={() => void handleScan(false)}
          />
        </View>
        {devices.map((device) => (
          <Pressable
            key={device.id}
            onPress={() => void handleConnect(device)}
            style={({ pressed }) => [
              styles.deviceRow,
              pressed && styles.deviceRowPressed,
            ]}
          >
            <Text style={styles.deviceName}>{deviceLabel(device)}</Text>
            <Text style={styles.deviceHint}>
              {connected?.id === device.id ? 'Connected' : 'Tap to connect'}
            </Text>
          </Pressable>
        ))}
        {SIZE_TESTS.map((test) => (
          <SpikeButton
            key={test.label}
            label={`Test ${test.label}`}
            onPress={() => handleSizeTest(test)}
          />
        ))}
        {[DRAWING, ELEMENT_LOGO, ELEMENT_LOGO_V2].map((drawing) => (
          <SpikeButton
            key={drawing.label}
            label={`${drawing.label} (${drawing.holds.length})`}
            onPress={() => handleSizeTest(drawing)}
          />
        ))}
        <SpikeButton
          label="Turn off"
          variant="secondary"
          onPress={handleTurnOff}
        />
      </View>
      <ScrollView
        style={styles.logBox}
        contentContainerStyle={styles.logContent}
      >
        {logs.length === 0 ? (
          <Text style={styles.logEmpty}>No events yet</Text>
        ) : (
          logs.map((line, index) => (
            <Text key={`${index}-${line}`} style={styles.logLine}>
              {line}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function SpikeButton({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonSecondary,
        pressed &&
          (isPrimary ? styles.buttonPrimaryPressed : styles.deviceRowPressed),
      ]}
    >
      <Text
        style={
          isPrimary ? styles.buttonTextPrimary : styles.buttonTextSecondary
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flexGrow: 1,
    alignItems: 'center',
    borderRadius: radii.full,
    paddingVertical: spacing.md,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonPrimaryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  buttonTextPrimary: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
  },
  buttonTextSecondary: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.primary,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  deviceRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  deviceName: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.sm,
    color: colors.text,
  },
  deviceHint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  logBox: {
    flex: 1,
    backgroundColor: colors.ink,
    borderRadius: radii.card,
  },
  logContent: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  logEmpty: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
  logLine: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    color: colors.textOnInk,
  },
});
