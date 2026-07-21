import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  colors,
  spacing,
  typography,
  radii,
  shadows,
} from "@/constants/theme";

export default function LoginScreen() {
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(identifier, password);
      // Pas besoin de naviguer : le gating bascule automatiquement
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>

      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Email or username</Text>
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="you@email.com"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textSubtle}
            secureTextEntry
            editable={!isSubmitting}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting || !identifier || !password}
          style={({ pressed }) => [
            styles.button,
            (isSubmitting || !identifier || !password) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Text>
        </Pressable>
      </View>

      <Link href="/register" asChild>
        <Pressable>
          <Text style={styles.link}>Don&apos;t have an account? Sign up</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl,
    gap: spacing.lg,
  },
  title: {
    fontFamily: typography.family.display,
    fontSize: typography.size.display,
    letterSpacing: typography.size.display * typography.letterSpacing.tight,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.card,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  button: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonText: {
    color: colors.surface,
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
  },
  link: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.primary,
    textAlign: "center",
  },
  error: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    color: colors.danger,
  },
});
