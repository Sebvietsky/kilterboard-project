import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/constants/theme';

export default function ConnectScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    color: colors.text,
  },
});
