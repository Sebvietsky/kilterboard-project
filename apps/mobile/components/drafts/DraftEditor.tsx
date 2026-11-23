import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, usePreventRemove, useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { AnglePickerSheet } from '@/components/boulder/AnglePickerSheet';
import { GradePicker } from '@/components/boulder/GradePicker';
import { HoldPickerBoard } from '@/components/drafts/HoldPickerBoard';
import { useDefaultBoardSize } from '@/lib/boardSizes/queries';
import { boulderHref } from '@/lib/boulders/href';
import type { HoldRole } from '@/lib/boulders/types';
import {
  canPublish,
  cycleHold,
  endRolesOverLimit,
  MAX_END_HOLDS,
  MAX_HOLDS_PER_BOULDER,
  toDraftHolds,
  toHoldsInput,
  type DraftHolds,
} from '@/lib/drafts/holds';
import {
  useDraft,
  usePublishDraft,
  useSaveDraft,
  type DraftFields,
} from '@/lib/drafts/queries';
import { DEFAULT_ANGLE } from '@/lib/filters/const';
import { showToast } from '@/lib/toast/useToastStore';
import {
  colors,
  holds as holdColors,
  radii,
  spacing,
  typography,
} from '@/constants/theme';

const ICON_SIZE = spacing.lg;
const LEGEND_DOT_SIZE = spacing.md;

// Mêmes bornes que `CreateBoulderDto`.
const NAME_MAX_LENGTH = 150;
const DESCRIPTION_MAX_LENGTH = 1000;

const LEGEND: { role: HoldRole; label: string; color: string }[] = [
  { role: 'START', label: 'Start', color: holdColors.start },
  { role: 'HAND', label: 'Hand', color: holdColors.hands },
  { role: 'FINISH', label: 'Finish', color: holdColors.finish },
  { role: 'FOOT', label: 'Foot', color: holdColors.feet },
];

type Initial = {
  draftId: number | undefined;
  name: string;
  description: string;
  angleDegrees: number;
  gradeRank: number | undefined;
  holds: DraftHolds;
};

const EMPTY: Initial = {
  draftId: undefined,
  name: '',
  description: '',
  angleDegrees: DEFAULT_ANGLE,
  gradeRank: undefined,
  holds: new Map(),
};

/**
 * Création (sans `draftId`) ou édition d'un brouillon. En édition, le
 * brouillon est chargé avant de monter le formulaire : ses valeurs en sont
 * l'état initial.
 */
export function DraftEditor({ draftId }: { draftId?: number }) {
  const draft = useDraft(draftId);

  if (draftId === undefined) return <DraftForm initial={EMPTY} />;

  if (draft.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!draft.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>Couldn&apos;t load this draft</Text>
        <Pressable
          onPress={() => void draft.refetch()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const d = draft.data;
  return (
    <DraftForm
      initial={{
        draftId: d.id,
        name: d.name,
        description: d.description ?? '',
        angleDegrees: d.angleDegrees,
        gradeRank: d.gradeRank,
        holds: toDraftHolds(d.holds),
      }}
    />
  );
}

// Ce qui part au serveur, `undefined` tant qu'un champ obligatoire manque.
function toFields(
  name: string,
  description: string,
  gradeRank: number | undefined,
  holds: DraftHolds,
): DraftFields | undefined {
  const trimmed = name.trim();
  if (!trimmed || gradeRank === undefined || holds.size === 0) return undefined;
  return {
    name: trimmed,
    // Chaîne vide -> null : « pas de description » n'a qu'une représentation.
    description: description.trim() || null,
    gradeRank,
    holds: toHoldsInput(holds),
  };
}

// Empreinte comparable de l'état du formulaire : différente de celle du
// dernier enregistrement = modifications non enregistrées.
function fingerprint(
  name: string,
  description: string,
  gradeRank: number | undefined,
  holds: DraftHolds,
): string {
  return JSON.stringify([
    name.trim(),
    description.trim(),
    gradeRank,
    toHoldsInput(holds),
  ]);
}

/**
 * Le formulaire travaille sur un état local et n'écrit qu'au Save (décision
 * du 2026-11-23) : un tap sur la board ne dépend pas du réseau, et
 * `PATCH /boulders/:id` reçoit l'état complet, pas un différentiel. Le
 * premier Save crée le brouillon, les suivants le modifient.
 */
function DraftForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const size = useDefaultBoardSize();
  const save = useSaveDraft();
  const publish = usePublishDraft();

  const [draftId, setDraftId] = useState(initial.draftId);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [angleDegrees, setAngleDegrees] = useState(initial.angleDegrees);
  const [gradeRank, setGradeRank] = useState(initial.gradeRank);
  const [holds, setHolds] = useState(initial.holds);
  const [limitHit, setLimitHit] = useState(false);
  const [anglePickerOpen, setAnglePickerOpen] = useState(false);
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    fingerprint(
      initial.name,
      initial.description,
      initial.gradeRank,
      initial.holds,
    ),
  );
  // Levé par « Discard » : la sortie n'est plus bloquée.
  const [discarding, setDiscarding] = useState(false);

  const fields = toFields(name, description, gradeRank, holds);
  const dirty =
    fingerprint(name, description, gradeRank, holds) !== savedFingerprint;
  const busy = save.isPending || publish.isPending;
  const overLimit = endRolesOverLimit(holds);
  const valid = fields !== undefined && overLimit.length === 0;
  const canSave = valid && dirty && !busy;
  const publishable = valid && canPublish(holds) && !busy;

  // Rejouer l'action bloquée sans lever la protection la fait bloquer de
  // nouveau, d'où une boucle d'alertes. Méthode d'expo-router : passer
  // `preventRemove` à `false`, puis `repeat()`.
  const disablePrevention = usePreventRemove(
    dirty && !discarding,
    ({ repeat }) => {
      Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setDiscarding(true);
            repeat();
          },
        },
      ]);
    },
  );

  function tapHold(holdId: number) {
    const result = cycleHold(holds, holdId);
    if (result.kind === 'limit') {
      setLimitHit(true);
      return;
    }
    setLimitHit(false);
    setHolds(result.holds);
  }

  // Enregistre l'état affiché et renvoie l'id du brouillon.
  async function saveDraft(toSave: DraftFields): Promise<number> {
    const written = await save.mutateAsync(
      draftId === undefined
        ? { draftId: undefined, angleDegrees, fields: toSave }
        : { draftId, fields: toSave },
    );
    setDraftId(written.id);
    setSavedFingerprint(fingerprint(name, description, gradeRank, holds));
    return written.id;
  }

  function onSave() {
    if (!canSave || !fields) return;
    saveDraft(fields)
      .then(() => showToast('Draft saved'))
      // L'erreur reste dans `save.error`, affichée sous les boutons.
      .catch(() => undefined);
  }

  function onPublish() {
    if (!publishable || !fields) return;
    Alert.alert(
      'Publish this boulder?',
      'Everyone will see it, and its holds and grade can no longer change.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: () => {
            // Enregistre d'abord ce qui ne l'est pas : on publie ce qui est
            // affiché.
            const id =
              dirty || draftId === undefined
                ? saveDraft(fields)
                : Promise.resolve(draftId);
            id.then((boulderId) => publish.mutateAsync(boulderId))
              .then((published) => {
                // Publié : plus rien à perdre, la sortie n'a pas à être
                // bloquée, quel que soit l'état du dernier rendu.
                disablePrevention();
                showToast('Boulder published');
                router.replace(boulderHref(published.id, angleDegrees));
              })
              .catch(() => undefined);
          },
        },
      ],
    );
  }

  const error = publish.error ?? save.error;
  const missing = [
    !name.trim() && 'a name',
    gradeRank === undefined && 'a grade',
    holds.size === 0 && 'a hold',
  ].filter(Boolean);

  return (
    <>
      <Stack.Screen
        options={{
          title: draftId === undefined ? 'New boulder' : 'Edit draft',
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Boulder name"
            placeholderTextColor={colors.textSubtle}
            returnKeyType="done"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.boardHeader}>
            <Text style={styles.label}>Holds</Text>
            <Text style={[styles.counter, limitHit && styles.counterLimit]}>
              {holds.size} / {MAX_HOLDS_PER_BOULDER}
            </Text>
          </View>
          <HoldPickerBoard size={size.data} holds={holds} onTapHold={tapHold} />
          <View style={styles.legend}>
            {LEGEND.map((item) => (
              <View key={item.role} style={styles.legendItem}>
                <View style={[styles.legendDot, { borderColor: item.color }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.hint, limitHit && styles.hintLimit]}>
            {limitHit
              ? `A boulder has at most ${MAX_HOLDS_PER_BOULDER} holds.`
              : 'Tap a hold to add it, tap again to change its role, then again to remove it.'}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Angle</Text>
          {/* Fixée à la création : le même bloc à une autre inclinaison est
              un autre bloc (décision du 2026-10-15). */}
          {draftId === undefined ? (
            <Pressable
              onPress={() => setAnglePickerOpen(true)}
              style={styles.angleButton}
              accessibilityRole="button"
            >
              <Text style={styles.angleText}>{angleDegrees}°</Text>
              <ChevronDown size={ICON_SIZE} color={colors.textMuted} />
            </Pressable>
          ) : (
            <View style={styles.angleFixed}>
              <Text style={styles.angleText}>{angleDegrees}°</Text>
              <Text style={styles.hint}>Set when the draft was created.</Text>
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Grade</Text>
          <GradePicker selected={gradeRank} onSelect={setGradeRank} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder="Optional"
            placeholderTextColor={colors.textSubtle}
            multiline
            style={[styles.input, styles.inputMultiline]}
          />
        </View>

        {missing.length > 0 ? (
          <Text style={styles.hint}>To save, add {missing.join(', ')}.</Text>
        ) : overLimit.length > 0 ? (
          <Text style={[styles.hint, styles.hintLimit]}>
            To save, keep at most {MAX_END_HOLDS} start and {MAX_END_HOLDS}{' '}
            finish holds.
          </Text>
        ) : !canPublish(holds) ? (
          <Text style={styles.hint}>
            To publish, add at least one start and one finish hold.
          </Text>
        ) : null}

        {error ? <Text style={styles.errorText}>{error.message}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.secondaryButton,
              !canSave && styles.buttonDisabled,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                !canSave && styles.buttonTextDisabled,
              ]}
            >
              {save.isPending ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
            </Text>
          </Pressable>
          <Pressable
            onPress={onPublish}
            disabled={!publishable}
            style={({ pressed }) => [
              styles.primaryButton,
              !publishable && styles.buttonDisabled,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                !publishable && styles.buttonTextDisabled,
              ]}
            >
              {publish.isPending ? 'Publishing…' : 'Publish'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <AnglePickerSheet
        visible={anglePickerOpen}
        selected={angleDegrees}
        onSelect={(angle) => {
          setAngleDegrees(angle);
          setAnglePickerOpen(false);
        }}
        onClose={() => setAnglePickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  stateTitle: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.text,
  },
  inputMultiline: {
    minHeight: spacing.xxxl * 2,
    textAlignVertical: 'top',
  },
  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  counterLimit: {
    color: colors.danger,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // Même anneau que les prises du dessin.
  legendDot: {
    width: LEGEND_DOT_SIZE,
    height: LEGEND_DOT_SIZE,
    borderRadius: radii.full,
    borderWidth: 2,
  },
  legendText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  hint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
  hintLimit: {
    color: colors.danger,
  },
  angleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  angleFixed: {
    gap: spacing.xs,
  },
  angleText: {
    fontFamily: typography.family.data,
    fontSize: typography.size.md,
    color: colors.text,
  },
  errorText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: spacing.md,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  primaryButtonText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.full,
    paddingVertical: spacing.md,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  secondaryButtonText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.primary,
  },
  buttonDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.surfaceMuted,
  },
  buttonTextDisabled: {
    color: colors.textSubtle,
  },
});
