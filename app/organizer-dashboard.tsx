import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SpritzEvent } from '@/constants/events';
import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { getEventAttendeeCount, updateEvent } from '@/lib/events';
import type { Translations } from '@/lib/i18n/ro';
import { showAlert } from '@/lib/alert';
import { duplicateDraftFromEvent, setEventPreviewDraft } from '@/lib/eventPreview';
import {
  EventAnalytics,
  EventTemplate,
  OrganizerReputation,
  deleteEventTemplate,
  draftFromTemplate,
  getEventAnalytics,
  getEventTemplates,
  getOrganizerReputation,
  saveEventTemplate,
} from '@/lib/organizerTools';
import { SafetyMenu, type SafetyAction } from '@/components/social/SafetyMenu';

function isUpcoming(event: SpritzEvent) {
  return event.startsAt !== null && new Date(event.startsAt).getTime() >= Date.now();
}

function formatEventDate(startsAt: string | null, t: Translations, locale: string) {
  if (!startsAt) return t.organizer.dateTbd;
  return new Date(startsAt).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatEventTime(startsAt: string | null, t: Translations, locale: string) {
  if (!startsAt) return t.organizerDashboard.timeTbd;
  return new Date(startsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function EventDashboardCard({
  event,
  attendeeCount,
  onView,
  onEdit,
  onParticipants,
  onMore,
}: {
  event: SpritzEvent;
  attendeeCount: number | undefined;
  onView: () => void;
  onEdit: () => void;
  onParticipants: () => void;
  onMore: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { t, locale } = useLanguage();
  const upcoming = isUpcoming(event);
  const hasDate = event.startsAt !== null;
  const capacity = event.maxParticipants;
  const occupancy = capacity && attendeeCount !== undefined ? Math.min(Math.round((attendeeCount / capacity) * 100), 100) : null;

  return (
    <View style={[styles.eventCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.eventHeader}>
        <View style={[styles.eventIcon, { backgroundColor: event.color }]}>
          <Text style={styles.eventEmoji}>{event.emoji}</Text>
        </View>
        <View style={styles.eventHeading}>
          <Text style={[styles.eventTitle, { color: theme.textPrimary }]} numberOfLines={1}>{event.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: upcoming ? colors.green50 : theme.surfaceMuted }]}>
            <Text style={[styles.statusText, { color: upcoming ? colors.green700 : theme.textSecondary }]}>
              {upcoming ? t.organizerDashboard.upcomingStatus : hasDate ? t.organizerDashboard.completedStatus : t.organizer.undatedSection}
            </Text>
          </View>
        </View>
        <AnimatedPressable onPress={() => { light(); onMore(); }} hitSlop={8} accessibilityLabel="Mai multe opțiuni">
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
        </AnimatedPressable>
      </View>

      <View style={styles.dateRow}>
        <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
        <Text style={[styles.dateText, { color: theme.textSecondary }]}>
          {formatEventDate(event.startsAt, t, locale)} · {formatEventTime(event.startsAt, t, locale)}
        </Text>
      </View>

      <View style={styles.attendeeRow}>
        <Ionicons name="people-outline" size={18} color={theme.accent} />
        <Text style={[styles.attendeeText, { color: theme.textPrimary }]}>
          {attendeeCount === undefined ? t.organizerDashboard.loadingParticipants : t.organizerDashboard.participantsCount(attendeeCount, capacity)}
        </Text>
      </View>

      {occupancy !== null && (
        <View style={styles.occupancyBlock}>
          <View style={styles.occupancyHeader}>
            <Text style={[styles.occupancyLabel, { color: theme.textSecondary }]}>{t.organizerDashboard.occupancy}</Text>
            <Text style={[styles.occupancyValue, { color: theme.textPrimary }]}>{occupancy}%</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.surfaceMuted }]}>
            <View style={[styles.progressFill, { width: `${occupancy}%`, backgroundColor: colors.green500 }]} />
          </View>
        </View>
      )}

      <View style={styles.actionRow}>
        <AnimatedPressable
          onPress={() => {
            light();
            onView();
          }}
          style={[styles.secondaryButton, { borderColor: theme.border }]}
        >
          <Ionicons name="eye-outline" size={16} color={theme.textPrimary} />
          <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>{t.organizerDashboard.view}</Text>
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => {
            light();
            onEdit();
          }}
          style={[styles.primaryButton, { backgroundColor: colors.green500 }]}
        >
          <Ionicons name="create-outline" size={16} color={colors.white} />
          <Text style={styles.primaryButtonText}>{t.profile.edit}</Text>
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => {
            light();
            onParticipants();
          }}
          style={[styles.secondaryButton, { borderColor: theme.border }]}
        >
          <Ionicons name="people-outline" size={16} color={theme.textPrimary} />
          <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>{t.organizer.participants}</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

export default function OrganizerDashboard() {
  const { colors: theme } = useAppTheme();
  const { t } = useLanguage();
  const { events, loading: eventsLoading, error: eventsError, refresh } = useEvents();
  const { user, effectiveVerified } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [attendeeCounts, setAttendeeCounts] = useState<Record<string, number>>({});
  const [reputation, setReputation] = useState<OrganizerReputation | null>(null);
  const [actionSheetEvent, setActionSheetEvent] = useState<SpritzEvent | null>(null);
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [templateNameTarget, setTemplateNameTarget] = useState<SpritzEvent | null>(null);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [analyticsEvent, setAnalyticsEvent] = useState<SpritzEvent | null>(null);
  const [analyticsData, setAnalyticsData] = useState<EventAnalytics | null>(null);
  const [schedulePublishEvent, setSchedulePublishEvent] = useState<SpritzEvent | null>(null);

  const hostedEvents = useMemo(
    () => (user ? events.filter((event) => event.hostId === user.id) : []),
    [events, user]
  );
  const upcomingEvents = useMemo(() => hostedEvents.filter(isUpcoming), [hostedEvents]);
  const completedEvents = useMemo(() => hostedEvents.filter((event) => event.startsAt !== null && !isUpcoming(event)), [hostedEvents]);
  const undatedEvents = useMemo(() => hostedEvents.filter((event) => event.startsAt === null), [hostedEvents]);

  const loadCounts = useCallback(async () => {
    if (!hostedEvents.length) {
      setAttendeeCounts({});
      setLoadingCounts(false);
      return;
    }

    setLoadingCounts(true);
    const entries = await Promise.all(
      hostedEvents.map(async (event) => [event.id, await getEventAttendeeCount(event.id)] as const)
    );
    setAttendeeCounts(Object.fromEntries(entries));
    setLoadingCounts(false);
  }, [hostedEvents]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    if (!user) return;
    getOrganizerReputation(user.id).then(setReputation);
  }, [user, hostedEvents.length]);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  function goToVerification() {
    router.push({ pathname: '/verification', params: { returnTo: '/organizer-dashboard', reason: 'host' } });
  }

  function handleDuplicate(event: SpritzEvent) {
    setActionSheetEvent(null);
    if (!effectiveVerified) {
      goToVerification();
      return;
    }
    setEventPreviewDraft(duplicateDraftFromEvent(event));
    router.push('/new-event');
  }

  function handleSaveAsTemplatePrompt(event: SpritzEvent) {
    setActionSheetEvent(null);
    setTemplateNameTarget(event);
    setTemplateNameDraft(event.title);
  }

  async function confirmSaveTemplate() {
    if (!user || !templateNameTarget || !templateNameDraft.trim()) return;
    const ok = await saveEventTemplate(user.id, templateNameDraft.trim(), templateNameTarget);
    setTemplateNameTarget(null);
    if (ok) showAlert('Șablon salvat', 'Îl poți folosi data viitoare când creezi un eveniment.');
    else showAlert('A apărut o eroare', 'Nu am putut salva șablonul. Încearcă din nou.');
  }

  async function handleOpenTemplatePicker() {
    if (!user) return;
    if (!effectiveVerified) {
      goToVerification();
      return;
    }
    setTemplatePickerVisible(true);
    setTemplates(await getEventTemplates(user.id));
  }

  function handleUseTemplate(template: EventTemplate) {
    setTemplatePickerVisible(false);
    if (!effectiveVerified) {
      goToVerification();
      return;
    }
    setEventPreviewDraft(draftFromTemplate(template));
    router.push('/new-event');
  }

  async function handleDeleteTemplate(templateId: string) {
    setTemplates((current) => current.filter((tpl) => tpl.id !== templateId));
    await deleteEventTemplate(templateId);
  }

  async function handleOpenAnalytics(event: SpritzEvent) {
    setActionSheetEvent(null);
    setAnalyticsEvent(event);
    setAnalyticsData(await getEventAnalytics(event.id));
  }

  function handleSchedulePublish(event: SpritzEvent) {
    setActionSheetEvent(null);
    setSchedulePublishEvent(event);
  }

  async function applySchedulePublish(hoursFromNow: number | null) {
    if (!schedulePublishEvent || !user) return;
    const publishAt = hoursFromNow === null ? null : new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
    setSchedulePublishEvent(null);
    const updated = await updateEvent(schedulePublishEvent.id, user.id, { ...schedulePublishEvent, publishAt });
    if (!updated) showAlert('A apărut o eroare', 'Nu am putut programa publicarea. Încearcă din nou.');
    else refresh();
  }

  const participantTotal = Object.values(attendeeCounts).reduce((total, count) => total + count, 0);
  const list = [...upcomingEvents, ...completedEvents, ...undatedEvents];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      {eventsLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.green500} />
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>{t.organizer.loadingEvents}</Text>
        </View>
      ) : eventsError ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>{t.organizer.couldNotLoadEvents}</Text>
          <AnimatedPressable onPress={() => void refresh()} style={[styles.createButton, { backgroundColor: colors.green500 }]}>
            <Text style={styles.primaryButtonText}>{t.organizer.retry}</Text>
          </AnimatedPressable>
        </View>
      ) : (
      <FlatList
        data={list}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.green500} />}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <AnimatedPressable
                onPress={() => router.back()}
                hitSlop={10}
                style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
                accessibilityLabel={t.common.back}
              >
                <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
              </AnimatedPressable>
              <View style={styles.titleBlock}>
                <Text style={[styles.eyebrow, { color: theme.accent }]}>{t.organizer.eyebrow}</Text>
                <Text style={[styles.title, { color: theme.textPrimary }]}>{t.organizer.dashboard}</Text>
              </View>
              <View style={styles.backButton} />
            </View>

            {reputation && (
              <View style={[styles.reputationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="ribbon-outline" size={20} color={colors.green500} />
                <View style={styles.reputationCopy}>
                  <Text style={[styles.reputationScore, { color: theme.textPrimary }]}>Scor organizator: {reputation.score}/100</Text>
                  <Text style={[styles.reputationDetail, { color: theme.textSecondary }]}>
                    {reputation.hostedCount} evenimente · {reputation.avgRating > 0 ? `${reputation.avgRating.toFixed(1)}★` : 'fără recenzii încă'} · {Math.round(reputation.checkinRate * 100)}% prezență confirmată
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.statsGrid}>
              <StatCard label={t.organizerDashboard.total} value={hostedEvents.length} theme={theme} />
              <StatCard label={t.organizer.upcoming} value={upcomingEvents.length} theme={theme} />
              <StatCard label={t.organizer.completed} value={completedEvents.length} theme={theme} />
              <StatCard label={t.organizer.participants} value={loadingCounts ? null : participantTotal} theme={theme} />
            </View>

            <View style={styles.quickActionsRow}>
              <AnimatedPressable
                onPress={() => (effectiveVerified ? router.push('/new-event') : goToVerification())}
                style={[
                  styles.quickAction,
                  effectiveVerified ? { backgroundColor: colors.green500 } : { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1 },
                ]}
              >
                <Ionicons name={effectiveVerified ? 'add' : 'lock-closed'} size={16} color={effectiveVerified ? colors.white : theme.textSecondary} />
                <Text style={effectiveVerified ? styles.quickActionTextLight : [styles.quickActionText, { color: theme.textSecondary }]}>
                  {effectiveVerified ? 'Eveniment nou' : t.hostGate.verifyShort}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleOpenTemplatePicker}
                style={[
                  styles.quickAction,
                  { borderWidth: 1 },
                  effectiveVerified ? { backgroundColor: theme.surface, borderColor: theme.border } : { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}
              >
                <Ionicons name={effectiveVerified ? 'copy-outline' : 'lock-closed'} size={16} color={effectiveVerified ? theme.textPrimary : theme.textSecondary} />
                <Text style={[styles.quickActionText, { color: effectiveVerified ? theme.textPrimary : theme.textSecondary }]}>
                  {effectiveVerified ? 'Din șablon' : t.hostGate.verifyShort}
                </Text>
              </AnimatedPressable>
            </View>

            {upcomingEvents.length > 0 && <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.organizer.upcoming}</Text>}
            {upcomingEvents.length === 0 && completedEvents.length > 0 && (
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.organizerDashboard.eventsSection}</Text>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <>
            {index === upcomingEvents.length && completedEvents.length > 0 && upcomingEvents.length > 0 && (
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.organizer.completed}</Text>
            )}
            {index === upcomingEvents.length + completedEvents.length && undatedEvents.length > 0 && (
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.organizer.undatedSection}</Text>
            )}
            <EventDashboardCard
              event={item}
              attendeeCount={attendeeCounts[item.id]}
              onView={() => router.push(`/event/${item.id}`)}
              onEdit={() => router.push({ pathname: '/edit-event/[id]', params: { id: item.id } })}
              onParticipants={() => router.push({ pathname: '/organizer-participants/[id]', params: { id: item.id } })}
              onMore={() => setActionSheetEvent(item)}
            />
          </>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {loadingCounts ? (
              <ActivityIndicator color={colors.green500} />
            ) : (
              <>
                <Ionicons name="calendar-outline" size={42} color={theme.textSecondary} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>{t.organizerDashboard.noEventsCreated}</Text>
                <AnimatedPressable
                  onPress={() => (effectiveVerified ? router.push('/new-event') : goToVerification())}
                  style={[
                    styles.createButton,
                    effectiveVerified ? { backgroundColor: colors.green500 } : { backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name={effectiveVerified ? 'add' : 'lock-closed'} size={20} color={effectiveVerified ? colors.white : theme.textSecondary} />
                  <Text style={[styles.primaryButtonText, !effectiveVerified && { color: theme.textSecondary }]}>
                    {effectiveVerified ? t.organizer.createEvent : t.hostGate.verifyFirst}
                  </Text>
                </AnimatedPressable>
              </>
            )}
          </View>
        }
      />
      )}

      <SafetyMenu
        visible={!!actionSheetEvent}
        title={actionSheetEvent?.title}
        onClose={() => setActionSheetEvent(null)}
        actions={
          actionSheetEvent
            ? ([
                { key: 'duplicate', label: 'Duplică evenimentul', icon: 'copy-outline', onPress: () => handleDuplicate(actionSheetEvent) },
                { key: 'template', label: 'Salvează ca șablon', icon: 'bookmark-outline', onPress: () => handleSaveAsTemplatePrompt(actionSheetEvent) },
                { key: 'analytics', label: 'Analitice', icon: 'stats-chart-outline', onPress: () => handleOpenAnalytics(actionSheetEvent) },
                isUpcoming(actionSheetEvent) && { key: 'schedule', label: 'Programează publicarea', icon: 'time-outline', onPress: () => handleSchedulePublish(actionSheetEvent) },
              ].filter(Boolean) as SafetyAction[])
            : []
        }
      />

      <Modal visible={templatePickerVisible} transparent animationType="fade" onRequestClose={() => setTemplatePickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTemplatePickerVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Șabloane salvate</Text>
            {templates.length === 0 ? (
              <Text style={[styles.modalEmpty, { color: theme.textSecondary }]}>
                Nu ai niciun șablon încă. Salvează unul din meniul „•••" al unui eveniment.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {templates.map((template) => (
                  <View key={template.id} style={[styles.templateRow, { borderColor: theme.border }]}>
                    <Pressable style={styles.templateRowBody} onPress={() => handleUseTemplate(template)}>
                      <Text style={styles.templateEmoji}>{template.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.templateName, { color: theme.textPrimary }]}>{template.name}</Text>
                        <Text style={[styles.templateDetail, { color: theme.textSecondary }]} numberOfLines={1}>{template.title}</Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => handleDeleteTemplate(template.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
            <Pressable onPress={() => setTemplatePickerVisible(false)} style={[styles.modalClose, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.modalCloseText, { color: theme.textPrimary }]}>Închide</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!templateNameTarget} transparent animationType="fade" onRequestClose={() => setTemplateNameTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTemplateNameTarget(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Nume șablon</Text>
            <TextInput
              value={templateNameDraft}
              onChangeText={setTemplateNameDraft}
              placeholder="Ex: Petrecere standard"
              placeholderTextColor={theme.textSecondary}
              style={[styles.modalInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
              autoFocus
            />
            <Pressable
              onPress={confirmSaveTemplate}
              disabled={!templateNameDraft.trim()}
              style={[styles.modalSave, { backgroundColor: colors.green500, opacity: templateNameDraft.trim() ? 1 : 0.5 }]}
            >
              <Text style={styles.modalSaveText}>Salvează</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!analyticsEvent} transparent animationType="fade" onRequestClose={() => setAnalyticsEvent(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAnalyticsEvent(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Analitice — {analyticsEvent?.title}</Text>
            {!analyticsData ? (
              <ActivityIndicator color={colors.green500} />
            ) : (
              <View style={{ gap: 8 }}>
                <AnalyticsRow label="Vizualizări" value={analyticsData.viewCount} theme={theme} />
                <AnalyticsRow label="Salvări" value={analyticsData.saveCount} theme={theme} />
                <AnalyticsRow label="Participări" value={analyticsData.joinCount} theme={theme} />
                <AnalyticsRow label="Check-in-uri confirmate" value={analyticsData.checkinCount} theme={theme} />
                <AnalyticsRow
                  label="Conversie salvare → participare"
                  value={analyticsData.saveCount > 0 ? `${Math.round((analyticsData.saveToJoinCount / analyticsData.saveCount) * 100)}%` : '–'}
                  theme={theme}
                />
              </View>
            )}
            <Pressable onPress={() => setAnalyticsEvent(null)} style={[styles.modalClose, { backgroundColor: theme.surfaceMuted, marginTop: 14 }]}>
              <Text style={[styles.modalCloseText, { color: theme.textPrimary }]}>Închide</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <SafetyMenu
        visible={!!schedulePublishEvent}
        title="Programează publicarea"
        onClose={() => setSchedulePublishEvent(null)}
        actions={[
          { key: 'now', label: 'Publică acum', icon: 'flash-outline', onPress: () => applySchedulePublish(null) },
          { key: '1h', label: 'Peste 1 oră', icon: 'time-outline', onPress: () => applySchedulePublish(1) },
          { key: 'tomorrow', label: 'Mâine', icon: 'calendar-outline', onPress: () => applySchedulePublish(24) },
          { key: 'week', label: 'Peste o săptămână', icon: 'calendar-outline', onPress: () => applySchedulePublish(24 * 7) },
        ]}
      />
    </SafeAreaView>
  );
}

function AnalyticsRow({ label, value, theme }: { label: string; value: number | string; theme: ReturnType<typeof useAppTheme>['colors'] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, color: theme.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textPrimary }}>{value}</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  theme,
}: {
  label: string;
  value: number | null;
  theme: ReturnType<typeof useAppTheme>['colors'];
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {value === null ? <ActivityIndicator color={colors.green500} /> : <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{value}</Text>}
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { fontSize: 26, fontWeight: '800', marginTop: 3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { width: '48%', minHeight: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1 },
  statNumber: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: spacing.sm, marginTop: spacing.sm },
  eventCard: { borderRadius: 18, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eventIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  eventEmoji: { fontSize: 24 },
  eventHeading: { flex: 1, gap: 5 },
  eventTitle: { fontSize: 16, fontWeight: '800' },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '800' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing.md },
  dateText: { flex: 1, fontSize: 12, textTransform: 'capitalize' },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing.sm },
  attendeeText: { fontSize: 13, fontWeight: '700' },
  occupancyBlock: { marginTop: spacing.sm },
  occupancyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  occupancyLabel: { fontSize: 11 },
  occupancyValue: { fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  secondaryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 11, paddingVertical: 10 },
  secondaryButtonText: { fontSize: 12, fontWeight: '800' },
  primaryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 11, paddingVertical: 10 },
  primaryButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 12 },
  reputationCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: spacing.lg },
  reputationCopy: { flex: 1 },
  reputationScore: { fontSize: 13, fontWeight: '800' },
  reputationDetail: { fontSize: 11, marginTop: 2 },
  quickActionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  quickAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 13, paddingVertical: 11 },
  quickActionText: { fontSize: 12, fontWeight: '800' },
  quickActionTextLight: { color: colors.white, fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 380, borderRadius: 20, borderWidth: 1, padding: spacing.xl, gap: spacing.sm },
  modalTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  modalEmpty: { fontSize: 12, fontStyle: 'italic', paddingVertical: 10 },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  templateRowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  templateEmoji: { fontSize: 20 },
  templateName: { fontSize: 13, fontWeight: '800' },
  templateDetail: { fontSize: 11, marginTop: 1 },
  modalClose: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  modalCloseText: { fontSize: 13, fontWeight: '800' },
  modalInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginVertical: 8 },
  modalSave: { minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
