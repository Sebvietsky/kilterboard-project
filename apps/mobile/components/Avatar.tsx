import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography, radii } from '@/constants/theme';

// Avatar avec repli sur l'initiale. Le repli n'est pas décoratif : avatarUrl
// est nullable côté API, et une image absente laisserait un trou dans la mise
// en page. On garde donc toujours la même empreinte.
export function Avatar({
  uri,
  name,
  size = 64,
}: {
  uri: string | null;
  name: string;
  size?: number;
}) {
  // La taille pilote le cercle ET la police : passée en style inline parce
  // qu'elle est un paramètre du composant, pas une constante de la DA.
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, box]} />;
  }

  return (
    <View style={[styles.fallback, box]}>
      <Text style={[styles.initial, { fontSize: size / 2 }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceMuted,
  },
  fallback: {
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  initial: {
    fontFamily: typography.family.heading,
    color: colors.primary,
  },
});
