// Essai BLE jetable : se connecter à la board et allumer des LED codées en dur.
// À supprimer quand `BoardConnection` existera (docs/DECISIONS.md, chantier BLE).
// Protocole : docs/ble-protocol.md. Marche à suivre : docs/notes/ble-essai-salle.md.
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { BleManager, State, type Device } from 'react-native-ble-plx';
import { colors, spacing, typography, radii } from '@/constants/theme';

// Section 1 du protocole. Le scan filtre sur le service d'advertising : c'est
// le seul que la board diffuse. L'écriture passe par le service UART.
const ADVERTISING_SERVICE_UUID = '4488b571-7806-4df6-bcff-a2897e4953ff';
const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_WRITE_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

const SCAN_DURATION_MS = 10_000;
const CHUNK_SIZE = 20;

// API 3, paquet unique (`'T'`).
const ONLY_PACKET_API3 = 0x54;

// `led_color` de `board_placement_roles` (Kilter Original, product 1).
const ROLE_LED_COLORS = {
  start: '00FF00',
  hand: '00FFFF',
  finish: 'FF00FF',
  foot: 'FFA500',
} as const;
type Role = keyof typeof ROLE_LED_COLORS;

type TestHold = { role: Role; hole: string; position: number };
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

// Section 4, API 3 : 3 bits de rouge, 3 de vert, 2 de bleu.
function colorApi3(hex: string): number {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const r3 = Math.round((r / 255) * 7);
  const g3 = Math.round((g / 255) * 7);
  const b2 = Math.round((b / 255) * 3);
  return (r3 << 5) | (g3 << 2) | b2;
}

// Section 4 : position sur 2 octets (little-endian), puis la couleur.
function holdsPayload(holds: TestHold[]): number[] {
  return [
    ONLY_PACKET_API3,
    ...holds.flatMap(({ role, position }) => [
      position & 0xff,
      (position >> 8) & 0xff,
      colorApi3(ROLE_LED_COLORS[role]),
    ]),
  ];
}

// Section 3 : 0x01, longueur du payload, checksum, 0x02, payload, 0x03.
// Un seul paquet suffit tant que le payload reste sous 260 octets.
function buildPacket(payload: number[]): number[] {
  const sum = payload.reduce((acc, byte) => acc + byte, 0);
  const checksum = ~(sum & 0xff) & 0xff;
  return [0x01, payload.length, checksum, 0x02, ...payload, 0x03];
}

function toBase64(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes));
}

function toHex(bytes: number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

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
  // Une seule instance par app (doc de ble-plx). Dans un state et non en
  // constante de module, comme le `QueryClient` : elle survit au
  // rechargement à chaud, qui en créerait sinon une seconde.
  const [manager] = useState(() => new BleManager());
  const [logs, setLogs] = useState<string[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connected, setConnected] = useState<Device | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  function log(message: string) {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`${time}  ${message}`, ...prev]);
  }

  // Détruire le manager coupe aussi le scan et la connexion.
  useEffect(() => {
    return () => {
      void manager.destroy();
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
        // Le nom porte le niveau d'API en dernier segment (`…#3`).
        const services = device.serviceUUIDs?.join(', ') ?? 'none';
        log(`Found: ${deviceLabel(device)} (services: ${services})`);
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
    log(`Connect: ${deviceLabel(device)}…`);
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
  async function send(packet: number[]) {
    if (!connected) {
      log('Not connected');
      return;
    }
    log(`Send: ${toHex(packet)}`);
    try {
      for (let start = 0; start < packet.length; start += CHUNK_SIZE) {
        await manager.writeCharacteristicWithoutResponseForDevice(
          connected.id,
          UART_SERVICE_UUID,
          UART_WRITE_UUID,
          toBase64(packet.slice(start, start + CHUNK_SIZE)),
        );
      }
      log('Send: done');
    } catch (error) {
      log(`Send error: ${errorMessage(error)}`);
    }
  }

  function handleSizeTest(test: SizeTest) {
    log(`Test: ${test.label}`);
    void send(buildPacket(holdsPayload(test.holds)));
  }

  // Liste vide : section 6 du protocole, À VÉRIFIER.
  function handleTurnOff() {
    void send(buildPacket([ONLY_PACKET_API3]));
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
