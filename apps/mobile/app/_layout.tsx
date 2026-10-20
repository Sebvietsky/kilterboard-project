import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext';
import SplashScreenComponent from '@/components/SplashScreen';
import { ToastHost } from '@/components/Toast';
import { SessionHeaderPill } from '@/components/SessionIndicator';
import * as SplashScreen from 'expo-splash-screen';
import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';

SplashScreen.preventAutoHideAsync();

// En-tête des écrans de détail (un bloc, une session, une playlist) : la barre native, pour
// garder la flèche et le geste de retour d'iOS, avec l'état de la session.
// Pas d'annotation de type : celui des options vit dans un paquet qui n'est
// pas une dépendance directe de l'app. L'objet est vérifié là où il est passé
// à `Stack.Screen`.
const DETAIL_HEADER = {
  headerShown: true,
  title: '',
  headerBackButtonDisplayMode: 'minimal' as const,
  headerShadowVisible: false,
  // Même fond que les écrans : sans cela la barre est blanche et se détache
  // du reste de l'app, dont le fond est `background` et non `surface`.
  headerStyle: { backgroundColor: colors.background },
  headerRight: () => <SessionHeaderPill />,
  // iOS 26 entoure chaque élément de la barre d'une capsule de verre. La
  // pastille a déjà son contour : sans `hidesSharedBackground` elle se
  // retrouve dans une seconde capsule. Cette option remplace `headerRight`
  // sur iOS ; Android continue d'utiliser `headerRight`. API marquée
  // instable par React Navigation : à revoir à chaque montée de version.
  unstable_headerRightItems: () => [
    {
      type: 'custom' as const,
      element: <SessionHeaderPill />,
      hidesSharedBackground: true,
    },
  ],
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
      },
    },
  });
}

export default function RootLayout() {
  // Dans un state et non en constante de module : quand ce fichier est
  // rechargé à chaud (une simple édition, ou un changement de branche pendant
  // que l'app tourne), une constante de module est recréée — nouveau cache —
  // alors que les écrans déjà montés restent abonnés à l'ancien. Les
  // invalidations partaient alors dans un cache vide et plus rien ne se
  // mettait à jour. Le state, lui, survit au rechargement.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <RootNavigation />
          {/* Après la navigation : rendu en dernier, donc au-dessus de tous
              les écrans, quel que soit celui qui déclenche le toast. */}
          <ToastHost />
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigation() {
  const { status } = useAuth(); // OK, on est dans AuthProvider
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontError) {
      // On ne bloque jamais l'app sur un échec de police : on log et on
      // continue en police système.
      console.warn('Font loading failed:', fontError);
    }
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync(); // fonts résolues (succès ou échec) → on lâche le splash natif
    }
  }, [fontsLoaded, fontError]);

  // Après tous les hooks (l'ordre des hooks doit rester inconditionnel).
  // Deux portes empilées : fonts (splash natif) PUIS auth (splash custom,
  // qui rend ainsi toujours avec les vraies polices).
  if (!fontsLoaded && !fontError) return null;
  if (status === 'loading') return <SplashScreenComponent />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* `redirectTo` obligatoire depuis expo-router 58 : une route gardée
          redirige vers le premier enfant accessible, ici le groupe `(auth)`,
          dont l'URL est `/`… elle-même gardée. Sans cible explicite, un
          utilisateur déconnecté tombe sur « Unmatched route ». */}
      <Stack.Protected guard={status === 'authenticated'} redirectTo="/login">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" />
        {/* Écrans de détail : la barre native (flèche et geste de retour) est
            conservée, on y ajoute seulement l'état de la session — c'est
            depuis un bloc qu'on logge, donc là qu'il faut le voir. */}
        <Stack.Screen name="boulder/[id]" options={DETAIL_HEADER} />
        <Stack.Screen name="session/[id]" options={DETAIL_HEADER} />
        <Stack.Screen name="playlist/[id]" options={DETAIL_HEADER} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'unauthenticated'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
