import { useState, type ReactElement } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  indexOfBrowseItem,
  useBrowseStore,
  type BrowseItem,
} from '@/lib/boulders/browse';

// Pages du détail d'un bloc : une par bloc de la liste d'où l'on vient,
// gauche = suivant, droite = précédent.
//
// Défilement horizontal natif et non PanResponder : depuis iOS 26, le retour
// en arrière se fait d'un glissement n'importe où sur l'écran, et ce geste
// natif passe avant tout geste JS. Une ScrollView horizontale est arbitrée
// par iOS lui-même, avec le défilement vertical de la page et la bande des
// grades ressentis. Au premier bloc, glisser à droite revient à la liste.
export function BoulderPager({
  opened,
  renderPage,
}: {
  opened: BrowseItem;
  renderPage: (item: BrowseItem) => ReactElement;
}) {
  const { width } = useWindowDimensions();
  // Hauteur mesurée : sans elle, une page horizontale n'a que la hauteur de
  // son contenu, et la ScrollView du détail ne défilerait plus.
  const [height, setHeight] = useState(0);

  // Liste figée à l'ouverture. Hors d'une liste (bloc absent de la liste
  // retenue), une seule page.
  const [pages] = useState(() => {
    const items = useBrowseStore.getState().items;
    const index = indexOfBrowseItem(items, opened);
    return index === -1 ? { items: [opened], index: 0 } : { items, index };
  });

  return (
    <View
      style={styles.container}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      {height > 0 ? (
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={pages.items}
          keyExtractor={(item) => `${item.boulderId}@${item.angleDegrees}`}
          initialScrollIndex={pages.index}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          // Le bloc ouvert et ses deux voisins, chargés d'avance.
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          renderItem={({ item }) => (
            <View style={{ width, height }}>{renderPage(item)}</View>
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
