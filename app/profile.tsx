import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { ScreenBackground } from '@/components/layout/ScreenBackground';
import { colors, spacing, typography } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';

export default function Profile() {
  const { colors: theme } = useAppTheme();

  return (
    <ScreenBackground>
      <StatusBar style={theme.statusBar} />
      <View style={styles.center}>
        <Ionicons name="person-circle-outline" size={72} color={colors.green500} />
        <Text style={[styles.title, { color: theme.textPrimary }]}>În curând</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Lucrăm la profilul tău.</Text>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xxxl,
  },
  title: {
    fontFamily: typography.fontFamily.extrabold,
    fontSize: 24,
    marginTop: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 14,
    textAlign: 'center',
  },
});
