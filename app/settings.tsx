import { StyleSheet, Switch, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { VERIFICATION_REQUIRED } from '@/constants/featureFlags';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';
import { isAdminAccessEnabled } from '@/lib/admin';
import { useNotifications } from '@/contexts/NotificationContext';

const DANGER_COLOR = '#E5484D';

export default function Settings() {
  const { scheme, colors: theme, toggleScheme } = useAppTheme();
  const { enabled: hapticsEnabled, setEnabled: setHapticsEnabled, light } = useHaptics();
  const { language, setLanguage, t } = useLanguage();
  const { user, effectiveVerified, signOut, setNotifyFriendsOnJoin } = useUser();
  const { unreadCount } = useNotifications();

  function handleSelectLanguage(next: Language) {
    if (next === language) return;
    light();
    setLanguage(next);
  }

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
          accessibilityLabel={t.common.back}
          style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <GlassSurface />
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t.settings.title}</Text>
        <View style={styles.backButton} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t.settings.language}</Text>
            <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>{t.settings.languageDetail}</Text>
          </View>
          <View style={[styles.langSwitch, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
            <AnimatedPressable
              onPress={() => handleSelectLanguage('ro')}
              style={[
                styles.langOption,
                language === 'ro' && { backgroundColor: colors.green500 },
              ]}
            >
              <Text
                style={[
                  styles.langOptionText,
                  { color: language === 'ro' ? colors.white : theme.textSecondary },
                ]}
              >
                {t.settings.languageRomanian}
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => handleSelectLanguage('en')}
              style={[
                styles.langOption,
                language === 'en' && { backgroundColor: colors.green500 },
              ]}
            >
              <Text
                style={[
                  styles.langOptionText,
                  { color: language === 'en' ? colors.white : theme.textSecondary },
                ]}
              >
                {t.settings.languageEnglish}
              </Text>
            </AnimatedPressable>
          </View>
        </View>
      </View>

      <View style={[styles.card, styles.cardSpaced, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t.settings.darkMode}</Text>
            <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
              {t.settings.darkModeDetail}
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
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t.settings.haptics}</Text>
            <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
              {t.settings.hapticsDetail}
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

      <AnimatedPressable
        onPress={() => {
          light();
          router.push('/notifications');
        }}
        style={[styles.card, styles.cardSpaced, styles.linkRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t.settings.notifications}</Text>
          <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>{t.settings.notificationsDetail}</Text>
        </View>
        {unreadCount > 0 ? (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        )}
      </AnimatedPressable>

      <View style={[styles.card, styles.cardSpaced, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t.settings.notifyFriendsOnJoin}</Text>
            <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
              {t.settings.notifyFriendsOnJoinDetail}
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
          if (!effectiveVerified) {
            router.push({ pathname: '/verification', params: { returnTo: '/settings' } });
          }
        }}
        style={[styles.card, styles.cardSpaced, styles.linkRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Verificare identitate</Text>
          <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
            {effectiveVerified ? 'Contul tău a trecut de verificarea 18+.' : 'Verifică-ți identitatea și vârsta (18+).'}
          </Text>
        </View>
        {effectiveVerified ? (
          <Ionicons name="checkmark-circle" size={18} color={colors.green500} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        )}
      </AnimatedPressable>

      <AnimatedPressable
        onPress={() => {
          light();
          if (VERIFICATION_REQUIRED && !effectiveVerified) {
            router.push({ pathname: '/verification', params: { returnTo: '/new-event' } });
            return;
          }
          router.push('/new-event');
        }}
        style={[styles.card, styles.cardSpaced, styles.linkRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t.settings.addEvent}</Text>
          <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
            {!VERIFICATION_REQUIRED || effectiveVerified
              ? t.settings.addEventDetail
              : t.settings.addEventVerifyDetail}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </AnimatedPressable>

      {isAdminAccessEnabled(user) && (
        <AnimatedPressable
          onPress={() => {
            light();
            router.push('/admin');
          }}
          style={[styles.card, styles.cardSpaced, styles.linkRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t.settings.adminPanel}</Text>
            <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
              {t.settings.adminPanelDetail}
            </Text>
          </View>
          <Ionicons name="shield-checkmark-outline" size={18} color={theme.accent} />
        </AnimatedPressable>
      )}

      <AnimatedPressable
        onPress={() => {
          light();
          router.push('/organizer');
        }}
        style={[styles.card, styles.cardSpaced, styles.linkRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{t.settings.organizerMode}</Text>
          <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
            {t.settings.organizerModeDetail}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </AnimatedPressable>

      <AnimatedPressable
        onPress={handleSignOut}
        style={[styles.card, styles.cardSpaced, styles.linkRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: DANGER_COLOR }]}>{t.settings.signOut}</Text>
          <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
            {t.settings.signOutDetail}
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
  notificationBadge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: colors.green500, alignItems: 'center', justifyContent: 'center' },
  notificationBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  langSwitch: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  langOption: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  langOptionText: { fontSize: 13, fontWeight: '700' },
});
