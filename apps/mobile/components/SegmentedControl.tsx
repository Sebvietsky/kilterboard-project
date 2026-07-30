import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography, shadows } from '@/constants/theme';

/**
 * Bascule entre plusieurs vues d'un même écran.
 *
 * Générique par la valeur : `T extends string` permet à l'appelant de garder
 * son union littérale (« 'projects' | 'playlists' ») de bout en bout, plutôt
 * que de recevoir un `string` qu'il devrait re-valider.
 *
 * Volontairement neutre : StatusSegmented, dans boulder/[id], porte une
 * couleur par statut et une notion de disponibilité qui lui sont propres.
 * Le faire hériter d'ici demanderait de rendre ce composant configurable
 * jusqu'à ne plus rien simplifier — deux composants qui se ressemblent ne
 * sont pas forcément le même.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Le conteneur porte un padding fin : c'est lui qui creuse la gouttière
  // autour de la pill active, sans marge sur les segments (qui casserait
  // leur répartition en flex: 1).
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    padding: spacing.xs,
    gap: spacing.xs,
    ...shadows.card,
  },
  // flex: 1 sur chaque segment : la largeur ne dépend pas de la longueur du
  // libellé, sinon la pill se déplacerait ET changerait de taille au tap.
  segment: {
    flex: 1,
    borderRadius: radii.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  label: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.textOnPrimary,
  },
});
