import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { MapPlaceholder } from '@/components/home/MapPlaceholder';
import { useAppTheme } from '@/contexts/ThemeContext';

export default function Home() {
  const { colors: theme } = useAppTheme();

  return (
    <View style={styles.root}>
      <StatusBar style={theme.statusBar} />
      <MapPlaceholder />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
