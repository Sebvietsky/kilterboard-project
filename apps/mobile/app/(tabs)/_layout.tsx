import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import {
  Home,
  Compass,
  Zap,
  Library,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, spacing, radii, typography } from '@/constants/theme';
import { AppHeader } from '@/components/AppHeader';

const ICON_SIZE = 22;

// Pill de l'onglet actif (« active indicator » Material 3). Elle entoure
// l'icône seule et non l'icône + le libellé : une pill qui englobe le texte
// change de largeur d'un onglet à l'autre (« Home » vs « Explore ») et rend
// l'espacement de la barre irrégulier.
// Le padding est porté par le style de BASE, pas par l'état actif : seul le
// fond change au focus, donc rien ne bouge en changeant d'onglet.
function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Icon
        size={ICON_SIZE}
        // Le trait s'épaissit légèrement à l'état actif : la couleur seule ne
        // suffit pas à distinguer un onglet à cette taille.
        strokeWidth={focused ? 2 : 1.75}
        color={focused ? colors.primary : colors.textMuted}
      />
    </View>
  );
}

// L'ordre de déclaration fixe l'ordre d'affichage : Session est 3e sur 5,
// donc au centre — c'est l'action principale de l'app.
const TABS: { name: string; title: string; icon: LucideIcon }[] = [
  { name: 'index', title: 'Home', icon: Home },
  { name: 'explore', title: 'Explore', icon: Compass },
  { name: 'session', title: 'Session', icon: Zap },
  { name: 'library', title: 'Library', icon: Library },
  { name: 'profile', title: 'Profile', icon: User },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        headerShown: true,
        header: () => <AppHeader />,
      }}
    >
      {TABS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ focused }) => (
              <TabIcon Icon={icon} focused={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Pas de hauteur imposée : React Navigation ajoute lui-même le safe area
  // inférieur. La fixer écraserait ce calcul et collerait la barre au bord sur
  // les appareils à indicateur d'accueil.
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tabBarItem: {
    paddingTop: spacing.sm,
  },
  tabBarLabel: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.xs,
  },
  iconPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: colors.primaryMuted,
  },
});
