import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Animated,
  StyleSheet,
} from 'react-native';
import { useBouldersInfinite } from '@/lib/boulders/queries';
import type { BoulderFilters, BoulderSummary } from '@/lib/boulders/types';
import { colors, spacing, typography, radii, shadows } from '@/constants/theme';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useFiltersStore } from '@/lib/filters/useFiltersStore';
import { ActiveFilters } from '@/components/filters/ActiveFilters';

function BoulderCard({ item }: { item: BoulderSummary }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.boulderName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.gradeBadge}>
          <Text style={styles.gradeText}>{item.gradeLabel}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaData}>{item.angleDegrees}°</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaData}>{item.ascentCount} ascents</Text>
        {item.averageRating !== null && (
          <>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.ratingText}>
              ★ {item.averageRating.toFixed(1)}
            </Text>
          </>
        )}
      </View>

      <Text style={styles.creator}>by {item.creatorUsername}</Text>
    </View>
  );
}

// Repli du grand titre au scroll (pattern large-title). Seul le titre disparaît :
// recherche, Filters et chips de filtres actifs sont rendus HORS de la liste,
// donc fixes — ce sont des actions primaires, les masquer forcerait un
// scroll-to-top pour re-filtrer une longue liste.
// Hauteur de repli mesurée au premier layout plutôt que déduite des tokens : la
// hauteur réelle dépend des métriques de la police, une constante calculée
// collapserait trop tôt ou laisserait un résidu.
const TITLE_HEIGHT_FALLBACK =
  typography.size.display * typography.lineHeight.tight + spacing.md;

export default function ExploreScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // useState + initialiseur paresseux, pas useRef : la valeur est consommée
  // pendant le rendu (interpolate), ce qu'un ref n'a pas le droit de faire.
  // L'initialiseur garantit une seule instance sur toute la vie du composant.
  const [scrollY] = useState(() => new Animated.Value(0));
  const [titleHeight, setTitleHeight] = useState(TITLE_HEIGHT_FALLBACK);
  const titleMeasured = useRef(false);

  const creator = useFiltersStore((s) => s.creator);
  const angle = useFiltersStore((s) => s.angle);
  const gradeMin = useFiltersStore((s) => s.gradeMin);
  const gradeMax = useFiltersStore((s) => s.gradeMax);
  const tags = useFiltersStore((s) => s.tags);

  const filters: BoulderFilters = {
    name: debouncedSearch || undefined,
    creator: creator || undefined,
    angle,
    gradeMin,
    gradeMax,
    tags: tags.length ? tags : undefined,
  };

  const {
    data: boulders,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useBouldersInfinite(filters);

  function loadMore() {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }

  // L'opacité s'éteint avant la hauteur (0,6) : sans ça le texte reste lisible
  // jusqu'au dernier pixel et paraît coupé au rasoir.
  const collapsingTitle = {
    height: scrollY.interpolate({
      inputRange: [0, titleHeight],
      outputRange: [titleHeight, 0],
      extrapolate: 'clamp',
    }),
    opacity: scrollY.interpolate({
      inputRange: [0, titleHeight * 0.6],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
  };

  // État 1 — premier chargement (aucune donnée en cache encore).
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // État 2 — erreur : message + retry (refetch relance la query).
  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn&apos;t load boulders.</Text>
        <Pressable
          onPress={() => refetch()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryPressed,
          ]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.titleBlock, collapsingTitle]}>
        <Text
          style={styles.title}
          onLayout={(e) => {
            // Une seule mesure : le bloc parent voit sa hauteur animée, relayer
            // chaque layout rouvrirait une boucle set state → layout.
            if (titleMeasured.current) return;
            titleMeasured.current = true;
            setTitleHeight(e.nativeEvent.layout.height + spacing.md);
          }}
        >
          Explore
        </Text>
      </Animated.View>

      <View style={styles.header}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search boulders"
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <Pressable
          style={({ pressed }) => [
            styles.filtersButton,
            pressed && styles.filtersButtonPressed,
          ]}
          onPress={() => router.push('/search')}
        >
          <Text style={styles.filtersButtonText}>Filters</Text>
        </Pressable>
      </View>

      <ActiveFilters />

      <FlatList
        style={styles.list}
        data={boulders}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/boulder/${item.id}`)}>
            <BoulderCard item={item} />
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          // useNativeDriver: false — on anime une hauteur, propriété de layout
          // que le driver natif ne sait pas piloter.
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No boulders found.</Text>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator
              color={colors.primary}
              style={styles.footerSpinner}
            />
          ) : !hasNextPage && boulders && boulders.length > 0 ? (
            <Text style={styles.endText}>You&apos;ve reached the end.</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  // overflow: hidden — le texte garde sa hauteur naturelle pendant que le bloc
  // se referme, c'est le clipping qui produit le repli.
  titleBlock: {
    overflow: 'hidden',
  },
  title: {
    fontFamily: typography.family.display,
    fontSize: typography.size.display,
    letterSpacing: typography.size.display * typography.letterSpacing.tight,
    color: colors.text,
    paddingHorizontal: spacing.lg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  search: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  filtersButton: {
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  filtersButtonText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.text,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  boulderName: {
    flex: 1,
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.text,
  },
  gradeBadge: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  gradeText: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaData: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  metaDot: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
  creator: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
  footerSpinner: {
    paddingVertical: spacing.lg,
  },
  endText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  emptyText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  errorText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.md,
    color: colors.danger,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  retryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  retryText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
  },
  ratingText: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
});
