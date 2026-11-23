import { useEffect, useState } from 'react';
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

function missingSuffix(missing: string[]): string {
  return missing.length === 0
    ? ''
    : ` · ${missing.length} holds off this board`;
}

// Ampoule posée sur le plan de la board (décision du 2026-11-23) :
// - neutre tant que l'utilisateur n'a rien affiché : se connecter ne prend
//   pas la board à celui qui l'utilise ;
// - un tap affiche le bloc et passe en mode « suivre » (ampoule pleine) :
//   chaque bloc ouvert ou atteint par un swipe s'affiche alors tout seul ;
// - un second tap arrête le mode, les LED restent allumées.
// Sans board, un tap explique où se connecter : un bouton sans effet se
// lirait comme une panne (décision du 2026-10-12).
export function LightBoulderButton({
  boulderId,
  isActive,
  holds,
  size,
}: {
  boulderId: number;
  // Page au centre du pager : seule elle envoie son bloc en mode « suivre ».
  isActive: boolean;
  holds: Hold[];
  size: BoardSize | undefined;
}) {
  const status = useBoardStore((store) => store.state.status);
  const following = useBoardStore((store) => store.following);
  const shownBoulderId = useBoardStore((store) => store.shownBoulderId);
  const [sending, setSending] = useState(false);

  const connected = status === 'connected';
  const active = connected && following;
  const busy = sending || status === 'connecting';
  // Le temps du chargement, le détail du bloc n'a pas encore ses prises : un
  // message sans prise éteindrait la board.
  const ready = size !== undefined && holds.length > 0;

  // Mode « suivre » : le bloc regardé s'affiche, sauf s'il l'est déjà
  // (retour sur un bloc, relecture de ses prises). Le toast ne dit que ce
  // qui manque : un toast à chaque swipe serait du bruit.
  useEffect(() => {
    if (!isActive || !active || !size || holds.length === 0) return;
    if (shownBoulderId === boulderId) return;
    const { lit, missing } = litHolds(holds, size);
    useBoardStore
      .getState()
      .show(boulderId, lit)
      .then(
        () => {
          if (missing.length > 0) {
            showToast(`Shown on the board${missingSuffix(missing)}`);
          }
        },
        () => showToast('Could not show this boulder on the board'),
      );
  }, [isActive, active, size, holds, boulderId, shownBoulderId]);

  // Tap : affiche le bloc, puis active le mode « suivre » si l'envoi a
  // abouti.
  async function send() {
    if (!size) return;
    const { lit, missing } = litHolds(holds, size);
    setSending(true);
    try {
      const store = useBoardStore.getState();
      await store.show(boulderId, lit);
      store.setFollowing(true);
      showToast(`Shown on the board${missingSuffix(missing)}`);
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
    if (active) {
      useBoardStore.getState().setFollowing(false);
      showToast('Stopped showing boulders');
      return;
    }
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
      accessibilityLabel={
        active ? 'Stop showing boulders on the board' : 'Show on the board'
      }
      accessibilityState={{
        busy,
        disabled: busy || !ready,
        selected: active,
      }}
      style={({ pressed }) => [
        styles.button,
        active
          ? styles.buttonActive
          : connected
            ? styles.buttonReady
            : styles.buttonIdle,
        pressed && active && styles.buttonActivePressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={active ? colors.textOnPrimary : colors.primary}
        />
      ) : (
        <Lightbulb
          size={ICON_SIZE}
          color={
            active
              ? colors.textOnPrimary
              : connected
                ? colors.primary
                : colors.textMuted
          }
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
  // Mode « suivre » : bouton plein, les blocs s'affichent sur la board.
  buttonActive: {
    backgroundColor: colors.primary,
  },
  buttonActivePressed: {
    backgroundColor: colors.primaryPressed,
  },
  // Connectée, rien d'affiché : neutre, avec le contour de l'action
  // disponible.
  buttonReady: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  // Pas de board : neutre, comme la pastille de session au repos.
  buttonIdle: {
    backgroundColor: colors.surface,
  },
});
