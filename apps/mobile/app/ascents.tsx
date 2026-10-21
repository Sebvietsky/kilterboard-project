import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AscentHistoryRow } from '@/components/profile/AscentHistoryRow';
import { AscentsEmptyState } from '@/components/profile/ProfileView';
import { useMyAscentsInfinite } from '@/lib/ascents/queries';
import { boulderHref } from '@/lib/boulders/href';
import { colors, spacing } from '@/constants/theme';

// Historique complet de mes ascensions, ouvert depuis « See all » du profil.
// Même tri que l'aperçu (date d'envoi, projets ouverts en tête), par pages de
// 20 chargées au scroll.
export default function AscentsScreen() {
  const router = useRouter();
  const {
    data,
    isPending,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMyAscentsInfinite();

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={data ?? []}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            router.push(boulderHref(item.boulderId, item.angle.valueDegrees))
          }
        >
          <AscentHistoryRow ascent={item} />
        </Pressable>
      )}
      ListEmptyComponent={
        <AscentsEmptyState
          isPending={isPending}
          isError={isError}
          onRetry={() => void refetch()}
        />
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} style={styles.footer} />
        ) : undefined
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.primary}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  footer: {
    paddingVertical: spacing.lg,
  },
});
