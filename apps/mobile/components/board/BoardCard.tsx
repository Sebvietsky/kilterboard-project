import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from 'lucide-react-native';
import {
  IS_SIMULATED_CONNECTION,
  useBoardStore,
} from '@/lib/board/useBoardStore';
import type {
  BluetoothUnavailableReason,
  BoardConnectionState,
  DiscoveredBoard,
} from '@/lib/board/types';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';

const ICON_SIZE = spacing.xl - spacing.xs;

const UNAVAILABLE_MESSAGES: Record<BluetoothUnavailableReason, string> = {
  poweredOff: 'Turn on Bluetooth to find your board.',
  unauthorized: 'Allow Bluetooth for KilterBoard in Settings.',
  unsupported: "This device doesn't support Bluetooth.",
};

// Carte de connexion à une board, sur Home. Elle lit l'état dans le store ;
// elle ne sait de la connexion que si elle est simulée, pour l'étiqueter.
export function BoardCard() {
  const state = useBoardStore((store) => store.state);
  const scan = useBoardStore((store) => store.scan);
  const connect = useBoardStore((store) => store.connect);
  const disconnect = useBoardStore((store) => store.disconnect);

  return (
    <View style={styles.card}>
      <CardHeader state={state} />
      <CardBody
        state={state}
        onScan={() => void scan()}
        onConnect={(board) => void connect(board)}
        onDisconnect={() => void disconnect()}
      />
    </View>
  );
}

function CardHeader({ state }: { state: BoardConnectionState }) {
  const Icon =
    state.status === 'connected'
      ? BluetoothConnected
      : state.status === 'unavailable'
        ? BluetoothOff
        : Bluetooth;
  const isConnected = state.status === 'connected';

  return (
    <View style={styles.header}>
      <Icon
        size={ICON_SIZE}
        color={isConnected ? colors.success : colors.textMuted}
      />
      <Text style={styles.title}>Board</Text>
      {IS_SIMULATED_CONNECTION ? (
        <View style={styles.demoChip}>
          <Text style={styles.demoChipText}>Demo</Text>
        </View>
      ) : null}
      <View style={styles.statusRow}>
        <View style={[styles.dot, isConnected && styles.dotConnected]} />
        <Text style={styles.statusText}>
          {isConnected ? 'Connected' : 'Not connected'}
        </Text>
      </View>
    </View>
  );
}

function CardBody({
  state,
  onScan,
  onConnect,
  onDisconnect,
}: {
  state: BoardConnectionState;
  onScan: () => void;
  onConnect: (board: DiscoveredBoard) => void;
  onDisconnect: () => void;
}) {
  switch (state.status) {
    case 'idle':
      return (
        <>
          <Text style={styles.hint}>
            Connect to the board in your gym to light up boulders.
          </Text>
          <PrimaryButton label="Find a board" onPress={onScan} />
        </>
      );

    case 'unavailable':
      return (
        <>
          <Text style={styles.hint}>{UNAVAILABLE_MESSAGES[state.reason]}</Text>
          <PrimaryButton label="Try again" onPress={onScan} />
        </>
      );

    case 'scanning':
      return (
        <>
          <View style={styles.searching}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.hint}>Searching for boards nearby…</Text>
          </View>
          <BoardList boards={state.boards} onConnect={onConnect} />
        </>
      );

    case 'scanned':
      return state.boards.length === 0 ? (
        <>
          <Text style={styles.hint}>
            No board found. Make sure it&apos;s on and that no other app is
            connected to it.
          </Text>
          <PrimaryButton label="Search again" onPress={onScan} />
        </>
      ) : (
        <>
          <BoardList boards={state.boards} onConnect={onConnect} />
          <SecondaryButton label="Search again" onPress={onScan} />
        </>
      );

    case 'connecting':
      return (
        <View style={styles.boardRow}>
          <BoardIdentity board={state.board} />
          <ActivityIndicator color={colors.primary} />
        </View>
      );

    case 'connected':
      return (
        <>
          <View style={styles.boardRow}>
            <BoardIdentity board={state.board} />
          </View>
          <SecondaryButton label="Disconnect" onPress={onDisconnect} />
        </>
      );

    case 'error':
      return (
        <>
          <Text style={styles.errorText}>{state.message}</Text>
          <PrimaryButton label="Try again" onPress={onScan} />
        </>
      );
  }
}

function BoardList({
  boards,
  onConnect,
}: {
  boards: DiscoveredBoard[];
  onConnect: (board: DiscoveredBoard) => void;
}) {
  return (
    <View style={styles.list}>
      {boards.map((board) => (
        <View key={board.key} style={styles.boardRow}>
          <BoardIdentity board={board} />
          <SignalIcon rssi={board.rssi} />
          <Pressable
            onPress={() => onConnect(board)}
            style={({ pressed }) => [
              styles.connectButton,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.connectButtonText}>Connect</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function BoardIdentity({ board }: { board: DiscoveredBoard }) {
  return (
    <View style={styles.identity}>
      <Text style={styles.boardName}>{board.name}</Text>
      {board.serial ? (
        <Text style={styles.boardSerial}>#{board.serial}</Text>
      ) : null}
    </View>
  );
}

// Seuils usuels du RSSI en BLE : au-dessus de -60 dBm la board est proche,
// sous -80 elle est en limite de portée.
function SignalIcon({ rssi }: { rssi: number | null }) {
  if (rssi === null) return null;
  const Icon = rssi > -60 ? SignalHigh : rssi > -80 ? SignalMedium : SignalLow;
  return <Icon size={ICON_SIZE} color={colors.textMuted} />;
}

function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.primaryButtonPressed,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.secondaryButtonPressed,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.text,
  },
  demoChip: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  demoChipText: {
    fontFamily: typography.family.dataBold,
    fontSize: typography.size.xs,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // Contour neutre au repos, comme la pastille de session : ne pas être
  // connecté n'est pas une alerte.
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.textSubtle,
  },
  dotConnected: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  statusText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  hint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    color: colors.textMuted,
  },
  errorText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.danger,
  },
  searching: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  identity: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  boardName: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.text,
  },
  boardSerial: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  connectButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  connectButtonText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.sm,
    color: colors.textOnPrimary,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: spacing.md,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  primaryButtonText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.full,
    paddingVertical: spacing.md,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  secondaryButtonText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.primary,
  },
});
