import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { ANGLES } from '@/lib/filters/const';
import { colors, radii, spacing, typography } from '@/constants/theme';

const ICON_SIZE = spacing.xl - spacing.xs;

/**
 * Choix de l'inclinaison sur le détail d'un bloc.
 *
 * Choix local à l'écran : il change la cotation affichée, les statuts
 * disponibles et l'inclinaison envoyée avec l'ascension, jamais le filtre
 * d'Explore.
 *
 * Même feuille native que « Add to playlist » (`pageSheet`, fermeture par
 * geste ou bouton retour Android).
 */
export function AnglePickerSheet({
  visible,
  selected,
  creatorAngle,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: number;
  // Signalée dans la liste : c'est la seule cotée à cette étape.
  creatorAngle: number;
  onSelect: (angle: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Board angle</Text>
          <Pressable onPress={onClose} hitSlop={spacing.md}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <FlatList
          data={ANGLES}
          keyExtractor={(angle) => String(angle)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: angle }) => {
            const active = angle === selected;
            return (
              <Pressable
                onPress={() => {
                  onSelect(angle);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowAngle}>{angle}°</Text>
                  {angle === creatorAngle && (
                    <Text style={styles.rowMeta}>Set angle</Text>
                  )}
                </View>
                {active && <Check size={ICON_SIZE} color={colors.primary} />}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.text,
  },
  done: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  rowAngle: {
    fontFamily: typography.family.data,
    fontSize: typography.size.lg,
    color: colors.text,
  },
  rowMeta: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
