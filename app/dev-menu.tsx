import { StyleSheet, Switch, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useDevFlags } from '@/contexts/DevFlagsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';

// Not a real backend-driven role system — just local switches to preview how
// the app behaves under different account states while there's no server.
export default function DevMenu() {
  const { colors: theme } = useAppTheme();
  const { hostVerified, setHostVerified } = useDevFlags();
  const { light } = useHaptics();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />

      <View style={styles.topBar}>
        <AnimatedPressable
          onPress={() => {
            light();
            router.back();
          }}
          hitSlop={10}
          accessibilityLabel="Înapoi"
          style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <GlassSurface />
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Meniu dezvoltator</Text>
        <View style={styles.backButton} />
      </View>

      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Comută tipuri de profil ca să previzualizezi comportamentul aplicației — nu există încă un
        server care să țină cont real de asta.
      </Text>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Host verificat</Text>
            <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
              Permite adăugarea de evenimente noi pe hartă.
            </Text>
          </View>
          <Switch
            value={hostVerified}
            onValueChange={(value) => {
              light();
              setHostVerified(value);
            }}
            trackColor={{ false: theme.surfaceMuted, true: colors.green500 }}
            thumbColor={colors.white}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800' },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  rowDetail: { fontSize: 12, marginTop: 3 },
});
