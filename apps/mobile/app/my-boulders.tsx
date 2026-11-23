import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { MyBoulderRow } from '@/components/profile/MyBoulderRow';
import { MyBouldersEmptyState } from '@/components/profile/ProfileView';
import { boulderBrowseItem, useOpenBoulder } from '@/lib/boulders/browse';
import { useMyBouldersInfinite } from '@/lib/boulders/queries';
import { colors, spacing } from '@/constants/theme';

// Tous mes blocs publiés, ouverts depuis « See all » du profil. Du plus
// récent au plus ancien, par pages de 20 chargées au scroll.
export default function MyBouldersScreen() {
  const openBoulder = useOpenBoulder();
  const {
    data,
    isPending,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMyBouldersInfinite();

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
            openBoulder(
              (data ?? []).map(boulderBrowseItem),
              boulderBrowseItem(item),
            )
          }
        >
          <MyBoulderRow boulder={item} />
        </Pressable>
      )}
      ListEmptyComponent={
        <MyBouldersEmptyState
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
