import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthField } from '@/components/auth/AuthField';
import { AuthButton } from '@/components/auth/AuthButton';
import { AuthError } from '@/components/auth/AuthError';

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
    <AuthLayout
      title="Create account"
      footerHref="/login"
      footerLabel="Already have an account? Sign in"
    >
      <AuthField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@email.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        editable={!isSubmitting}
      />

      <AuthField
        label="Username"
        value={username}
        onChangeText={setUsername}
        placeholder="your_username"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isSubmitting}
      />

      <AuthField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••••••"
        secureTextEntry
        autoComplete="new-password"
        hint="12+ characters, with an uppercase, a number and a special character (#?!@$%^&*-)"
        editable={!isSubmitting}
      />

      {error && <AuthError message={error} />}

      <AuthButton
        label={isSubmitting ? 'Creating account...' : 'Sign up'}
        onPress={handleSubmit}
        disabled={!canSubmit}
      />
    </AuthLayout>
  );
}
