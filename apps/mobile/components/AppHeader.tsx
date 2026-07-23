import { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BetaLogo } from "./BetaLogo";
import { colors, spacing, typography } from "@/constants/theme";

// Header applicatif réutilisable.
// - par défaut : marque (logo + wordmark "beta")
// - avec `title` : nom de la page à la place de la marque
// - `right` : slot d'action à droite (vide pour l'instant)
export function AppHeader({
  title,
  right,
}: {
  title?: string;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.left}>
        {title ? (
          <Text style={styles.pageTitle}>{title}</Text>
        ) : (
          <>
            <BetaLogo size={28} />
            <Text style={styles.wordmark}>beta</Text>
          </>
        )}
      </View>

      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  wordmark: {
    fontFamily: typography.family.display,
    fontSize: typography.size.xl,
    letterSpacing: typography.size.xl * typography.letterSpacing.tight,
    color: colors.text,
  },
  pageTitle: {
    fontFamily: typography.family.display,
    fontSize: typography.size.xl,
    letterSpacing: typography.size.xl * typography.letterSpacing.tight,
    color: colors.text,
  },
});
