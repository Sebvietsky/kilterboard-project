import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthContext';
import { colors, spacing, typography, radii, shadows } from '@/constants/theme';

export default function RegisterScreen() {
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = !!email && !!username && !!password && !isSubmitting;

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email, password, username);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Register failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>

      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="your_username"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••••••"
            placeholderTextColor={colors.textSubtle}
            secureTextEntry
            autoComplete="new-password"
            editable={!isSubmitting}
          />
          <Text style={styles.hint}>
            12+ characters, with an uppercase, a number and a special character
            (#?!@$%^&*-)
          </Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.button,
            !canSubmit && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Creating account...' : 'Sign up'}
          </Text>
        </Pressable>
      </View>

      <Link href="/login" asChild>
        <Pressable>
          <Text style={styles.link}>Already have an account? Sign in</Text>
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
  hint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.xs,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
    color: colors.textSubtle,
  },
  button: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
  },
  error: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    color: colors.danger,
  },
});
