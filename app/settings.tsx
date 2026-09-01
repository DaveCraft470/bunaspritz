import { StyleSheet, Switch, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';

const DANGER_COLOR = '#E5484D';

export default function Settings() {
  const { scheme, colors: theme, toggleScheme } = useAppTheme();
  const { enabled: hapticsEnabled, setEnabled: setHapticsEnabled, light } = useHaptics();
  const { user, signOut, setNotifyFriendsOnJoin } = useUser();

  async function handleSignOut() {
    light();
    await signOut();
    // dismissAll() first: settings can be reached several screens deep
    // (index -> profile -> settings), and now that index stays mounted
    // across tab switches, replace() alone would only swap the top of the
    // stack — leaving the pre-logout index/profile instances buried
    // underneath /auth, to resurface stale (wrong session's data) the next
    // time something unwinds the stack back to them.
    router.dismissAll();
    router.replace('/auth');
  }

  function handleToggleNotifyOnJoin(value: boolean) {
    light();
    setNotifyFriendsOnJoin(value);
  }

  function handleToggleTheme(value: boolean) {
    light();
    toggleScheme();
  }

  function handleToggleHaptics(value: boolean) {
    // Unconditional (bypasses the enabled check) so switching either way
    // always gives one confirming buzz — this is the control for the
    // feature itself, so it shouldn't go silent when turning it off.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setHapticsEnabled(value);
  }

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
        <Text style={[styles.title, { color: theme.textPrimary }]}>Setări</Text>
        <View style={styles.backButton} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Mod întunecat</Text>
            <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
              Comută între temă deschisă și întunecată.
            </Text>
          </View>
          <Switch
            value={scheme === 'dark'}
            onValueChange={handleToggleTheme}
            trackColor={{ false: theme.surfaceMuted, true: colors.green500 }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      <View style={[styles.card, styles.cardSpaced, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Feedback haptic</Text>
            <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
              Vibrații scurte la butoane importante și animații.
            </Text>
          </View>
          <Switch
            value={hapticsEnabled}
            onValueChange={handleToggleHaptics}
            trackColor={{ false: theme.surfaceMuted, true: colors.green500 }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      <View style={[styles.card, styles.cardSpaced, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Notifică prietenii când intru la un Spritz</Text>
            <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
              Dacă e oprit, niciun prieten nu află când te alături unui eveniment.
            </Text>
          </View>
          <Switch
            value={user?.notifyFriendsOnJoin ?? true}
            onValueChange={handleToggleNotifyOnJoin}
            trackColor={{ false: theme.surfaceMuted, true: colors.green500 }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      <AnimatedPressable
        onPress={() => {
          light();
          if (!user?.verified) {
            router.push({ pathname: '/verification', params: { returnTo: '/new-event' } });
            return;
          }
          router.push('/new-event');
        }}
        style={[styles.card, styles.cardSpaced, styles.linkRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Adaugă eveniment nou</Text>
          <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
            {user?.verified
              ? 'Publică un eveniment nou pe hartă.'
              : 'Necesită verificarea identității — apasă pentru a începe.'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </AnimatedPressable>

      <AnimatedPressable
        onPress={handleSignOut}
        style={[styles.card, styles.cardSpaced, styles.linkRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: DANGER_COLOR }]}>Ieși din cont</Text>
          <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
            Te deconectezi de la contul curent.
          </Text>
        </View>
        <Ionicons name="log-out-outline" size={18} color={DANGER_COLOR} />
      </AnimatedPressable>
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
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.lg,
  },
  cardSpaced: {
    marginTop: spacing.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  rowDetail: { fontSize: 12, marginTop: 3 },
});
