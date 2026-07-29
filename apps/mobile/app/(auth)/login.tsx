import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthField } from '@/components/auth/AuthField';
import { AuthButton } from '@/components/auth/AuthButton';
import { AuthError } from '@/components/auth/AuthError';

export default function LoginScreen() {
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = !!identifier && !!password && !isSubmitting;

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(identifier, password);
      // Pas besoin de naviguer : le gating bascule automatiquement
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      footerHref="/register"
      footerLabel="Don't have an account? Sign up"
    >
      <AuthField
        label="Email or username"
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="you@email.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="username"
        editable={!isSubmitting}
      />

      <AuthField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        autoComplete="current-password"
        editable={!isSubmitting}
      />

      {error && <AuthError message={error} />}

      <AuthButton
        label={isSubmitting ? 'Signing in...' : 'Sign in'}
        onPress={handleSubmit}
        disabled={!canSubmit}
      />
    </AuthLayout>
  );
}
