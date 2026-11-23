import { useMemo, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { BoardLED } from '@/components/BoardLED';
import type { BoardSize } from '@/lib/boardSizes/types';
import type { Hold } from '@/lib/boulders/types';
import { holdAtPoint, type DraftHolds } from '@/lib/drafts/holds';

/**
 * Le dessin de la board, où un tap désigne la prise la plus proche.
 *
 * Un seul Pressable sur tout le dessin plutôt qu'un par prise : à 14 px
 * d'écart entre deux prises, viser un point de 12 px au doigt échoue une fois
 * sur deux. Le dessin est en `pointerEvents="none"` : sans cela, le tap
 * serait reçu par le point touché, et `locationX` serait relatif à ce point
 * et non à la board.
 */
export function HoldPickerBoard({
  size,
  holds,
  onTapHold,
}: {
  size: BoardSize | undefined;
  holds: DraftHolds;
  onTapHold: (holdId: number) => void;
}) {
  const [layout, setLayout] = useState<{ width: number; height: number }>();

  // Les prises du brouillon, au format du dessin (position lue dans la taille).
  const drawn = useMemo<Hold[]>(() => {
    if (!size) return [];
    return size.holds.flatMap((h) => {
      const role = holds.get(h.id);
      return role ? [{ holdCode: h.holdCode, x: h.x, y: h.y, role }] : [];
    });
  }, [size, holds]);

  return (
    <Pressable
      disabled={!size || !layout}
      onLayout={(e: LayoutChangeEvent) =>
        setLayout({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }
      onPress={(e) => {
        if (!size || !layout) return;
        const holdId = holdAtPoint(
          size,
          { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
          layout,
        );
        if (holdId !== undefined) onTapHold(holdId);
      }}
      accessibilityLabel="Board. Tap a hold to add it or change its role."
    >
      <View pointerEvents="none">
        <BoardLED size={size} holds={drawn} />
      </View>
    </Pressable>
  );
}
