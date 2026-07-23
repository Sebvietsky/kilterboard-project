import { Tabs } from "expo-router";
import { colors } from "@/constants/theme";
import { AppHeader } from "@/components/AppHeader";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: true,
        header: () => <AppHeader />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="connect" options={{ title: "Connect" }} />
      <Tabs.Screen name="projects" options={{ title: "Projects" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
