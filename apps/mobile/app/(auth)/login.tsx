import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/lib/auth/AuthContext";
import { colors, spacing, typography, radii } from "@/constants/theme";

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
      <Text style={styles.title}>Connexion</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Email or username</Text>
        <TextInput
          style={styles.input}
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="ton@email.com"
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!isSubmitting}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Mot de passe</Text>
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
          {isSubmitting ? "Connexion..." : "Se connecter"}
        </Text>
      </Pressable>

      <Link href="/register" asChild>
        <Pressable>
          <Text style={styles.link}>Pas encore de compte ? S'inscrire</Text>
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
    fontSize: typography.size.display,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textMuted,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  button: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  link: {
    color: colors.primary,
    fontSize: typography.size.sm,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: typography.size.sm,
  },
});
