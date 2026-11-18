import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';
import { Lightbulb } from 'lucide-react-native';
import { colors, radii, shadows, spacing } from '@/constants/theme';
import { litHolds } from '@/lib/board/litHolds';
import { useBoardStore } from '@/lib/board/useBoardStore';
import { BoardSize } from '@/lib/boardSizes/types';
import { Hold } from '@/lib/boulders/types';
import { showToast } from '@/lib/toast/useToastStore';

const BUTTON_SIZE = spacing.xxxl;
const ICON_SIZE = spacing.xl;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Ampoule posée sur le plan de la board : allume le bloc sur la board
// connectée. Sans board, un tap explique où se connecter : un bouton sans
// effet se lirait comme une panne (décision du 2026-10-12).
export function LightBoulderButton({
  holds,
  size,
}: {
  holds: Hold[];
  size: BoardSize | undefined;
}) {
  const status = useBoardStore((store) => store.state.status);
  const [sending, setSending] = useState(false);

  const connected = status === 'connected';
  const busy = sending || status === 'connecting';
  // Le temps du chargement, le détail du bloc n'a pas encore ses prises : un
  // message sans prise éteindrait la board.
  const ready = size !== undefined && holds.length > 0;

  async function send() {
    if (!size) return;
    const { lit, missing } = litHolds(holds, size);
    setSending(true);
    try {
      await useBoardStore.getState().light(lit);
      showToast(
        missing.length === 0
          ? 'Shown on the board'
          : `Shown on the board · ${missing.length} holds off this board`,
      );
    } catch (error) {
      Alert.alert('Could not light the boulder', errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  // Un autre grimpeur a pris la board : on propose de la reprendre, comme
  // l'app Kilter, puis on allume si la reconnexion aboutit.
  async function reconnectAndSend() {
    const { lastBoard, connect } = useBoardStore.getState();
    if (!lastBoard) return;
    setSending(true);
    try {
      await connect(lastBoard);
    } finally {
      setSending(false);
    }
    const after = useBoardStore.getState().state;
    if (after.status === 'connected') {
      await send();
    } else if (after.status === 'error') {
      Alert.alert('Could not reconnect', after.message);
    }
  }

  function onPress() {
    if (busy || !ready) return;
    if (connected) {
      void send();
      return;
    }
    const { lastBoard } = useBoardStore.getState();
    if (lastBoard) {
      Alert.alert(
        'Board disconnected',
        'Someone else may be using it. Reconnect and show this boulder?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Show', onPress: () => void reconnectAndSend() },
        ],
      );
      return;
    }
    Alert.alert('No board connected', 'Connect to a board from Home first.');
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={busy || !ready}
      accessibilityRole="button"
      accessibilityLabel="Show on the board"
      accessibilityState={{ busy, disabled: busy || !ready }}
      style={({ pressed }) => [
        styles.button,
        connected ? styles.buttonConnected : styles.buttonIdle,
        pressed && connected && styles.buttonConnectedPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={connected ? colors.textOnPrimary : colors.primary}
        />
      ) : (
        <Lightbulb
          size={ICON_SIZE}
          color={connected ? colors.textOnPrimary : colors.textMuted}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  // Connectée : bouton plein, l'action est disponible tout de suite.
  buttonConnected: {
    backgroundColor: colors.primary,
  },
  buttonConnectedPressed: {
    backgroundColor: colors.primaryPressed,
  },
  // Pas de board : neutre, comme la pastille de session au repos.
  buttonIdle: {
    backgroundColor: colors.surface,
  },
});
