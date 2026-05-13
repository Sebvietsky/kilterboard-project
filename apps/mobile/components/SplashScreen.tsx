import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { colors, typography, spacing } from "@/constants/theme";

export default function SplashScreenComponent() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kilterboard</Text>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
});
