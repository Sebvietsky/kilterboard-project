import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import RangeSlider from '@/lib/vendor/RangeSlider';
import { ANGLES, TAGS } from '@/lib/filters/const';
import { gradeSteps, type GradeStep } from '@/lib/grades/scale';
import { useGradeSystem } from '@/lib/grades/useGradeLabel';
import { colors, spacing, typography, radii, shadows } from '@/constants/theme';
import { useFiltersStore } from '@/lib/filters/useFiltersStore';

// Cran qui contient un rang du filtre enregistré. En V, un filtre posé en
// Font (7b) retombe sur le cran qui le couvre (V8).
function stepIndexOf(steps: GradeStep[], rank: number | undefined): number {
  if (rank === undefined) return -1;
  return steps.findIndex((s) => rank >= s.minRank && rank <= s.maxRank);
}

// Une demi-douzaine de repères sous le curseur, répartis sur l'échelle.
const SCALE_MARK_COUNT = 6;

export default function SearchScreen() {
  const router = useRouter();
  // Le curseur parcourt les crans de l'échelle de l'utilisateur (24 en Font,
  // 17 en V), et non les rangs : en V, deux rangs voisins (6a, 6a+) seraient
  // deux positions affichées « V3 ».
  const gradeSystem = useGradeSystem();
  const steps = useMemo(() => gradeSteps(gradeSystem), [gradeSystem]);
  const lastStep = steps.length - 1;
  const [creatorDraft, setCreatorDraft] = useState(
    () => useFiltersStore.getState().creator ?? '',
  );
  const [low, setLow] = useState(() =>
    Math.max(0, stepIndexOf(steps, useFiltersStore.getState().gradeMin)),
  );
  const [high, setHigh] = useState(() => {
    const index = stepIndexOf(steps, useFiltersStore.getState().gradeMax);
    return index === -1 ? lastStep : index;
  });
  const [angleDraft, setAngleDraft] = useState<number | undefined>(
    () => useFiltersStore.getState().angle,
  );
  const [tagsDraft, setTagsDraft] = useState<string[]>(
    () => useFiltersStore.getState().tags,
  );

  const handleGradeChange = useCallback((l: number, h: number) => {
    setLow(l);
    setHigh(h);
  }, []);

  function toggleTag(slug: string) {
    setTagsDraft((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug],
    );
  }

  function apply() {
    const isFullRange = low === 0 && high === lastStep;

    // Le serveur filtre par rangs : le cran bas donne son plus petit rang, le
    // cran haut son plus grand (V3 à V5 = 6a à 6c+).
    useFiltersStore.getState().setFilters({
      creator: creatorDraft || undefined, // "" → undefined
      gradeMin: isFullRange ? undefined : steps[low].minRank,
      gradeMax: isFullRange ? undefined : steps[high].maxRank,
      angle: angleDraft,
      tags: tagsDraft,
    });
    router.back();
  }

  // ── Render functions du slider (présentation) ────────────────────
  const renderThumb = useCallback(() => <View style={styles.thumb} />, []);
  const renderRail = useCallback(() => <View style={styles.rail} />, []);
  const renderRailSelected = useCallback(
    () => <View style={styles.railSelected} />,
    [],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backPressed,
          ]}
          hitSlop={spacing.sm}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>Search climbs</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SETTER</Text>
          <TextInput
            style={styles.input}
            value={creatorDraft}
            onChangeText={setCreatorDraft}
            placeholder="Setter username"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GRADE RANGE</Text>
          <Text style={styles.rangeValue}>
            {steps[low].label} — {steps[high].label}
          </Text>
          <RangeSlider
            style={styles.slider}
            min={0}
            max={lastStep}
            step={1}
            low={low}
            high={high}
            renderThumb={renderThumb}
            renderRail={renderRail}
            renderRailSelected={renderRailSelected}
            onValueChanged={handleGradeChange}
          />
          <View style={styles.scaleRow}>
            {Array.from({ length: SCALE_MARK_COUNT }, (_, i) => {
              const step =
                steps[Math.round((i * lastStep) / (SCALE_MARK_COUNT - 1))];
              return (
                <Text key={step.label} style={styles.scaleLabel}>
                  {step.label}
                </Text>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BOARD ANGLE</Text>
          <View style={styles.chipWrap}>
            {ANGLES.map((a) => {
              const selected = angleDraft === a;
              return (
                <Pressable
                  key={a}
                  onPress={() => setAngleDraft(selected ? undefined : a)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {a}°
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STYLE</Text>
          <View style={styles.chipWrap}>
            {TAGS.map((t) => {
              const selected = tagsDraft.includes(t.slug);
              return (
                <Pressable
                  key={t.slug}
                  onPress={() => toggleTag(t.slug)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={apply}
          style={({ pressed }) => [
            styles.applyButton,
            pressed && styles.applyPressed,
          ]}
        >
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  backPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  backIcon: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.text,
  },
  title: {
    fontFamily: typography.family.display,
    fontSize: typography.size.xxl,
    letterSpacing: typography.size.xxl * typography.letterSpacing.tight,
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.xs,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  input: {
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
  rangeValue: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.text,
  },
  slider: {
    height: 40,
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.text,
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadows.card,
  },
  rail: {
    flex: 1,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  railSelected: {
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleLabel: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    color: colors.textSubtle,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primaryMuted,
  },
  chipText: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  chipTextSelected: {
    color: colors.primary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  applyButton: {
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyPressed: {
    backgroundColor: colors.primaryPressed,
  },
  applyText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
  },
});
