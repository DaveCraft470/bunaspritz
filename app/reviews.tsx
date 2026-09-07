import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { GlassSurface } from '@/components/common/GlassSurface';
import { ReviewModal } from '@/components/social/ReviewModal';
import {
  dismissReviewable,
  getReviewablePending,
  getReviews,
  getReviewsGiven,
  submitReview,
  type GivenReview,
  type PendingReview,
  type Review,
} from '@/lib/reviews';

type Tab = 'pending' | 'given' | 'received';

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Ionicons key={value} name={value <= rating ? 'star' : 'star-outline'} size={size} color="#F5B301" />
      ))}
    </View>
  );
}

export default function Reviews() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user } = useUser();
  const [tab, setTab] = useState<Tab>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<PendingReview[]>([]);
  const [given, setGiven] = useState<GivenReview[]>([]);
  const [received, setReceived] = useState<Review[]>([]);
  const [reviewTarget, setReviewTarget] = useState<PendingReview | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [pendingList, givenList, receivedList] = await Promise.all([
      getReviewablePending(),
      getReviewsGiven(user.id),
      getReviews(user.id),
    ]);
    setPending(pendingList);
    setGiven(givenList);
    setReceived(receivedList);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleDismiss(item: PendingReview) {
    if (!user) return;
    light();
    setPending((current) => current.filter((p) => !(p.eventId === item.eventId && p.subjectId === item.subjectId)));
    const ok = await dismissReviewable(user.id, item.eventId, item.subjectId);
    if (!ok) load();
  }

  async function handleSubmit(eventId: string, rating: number, comment: string) {
    if (!user || !reviewTarget) return false;
    const ok = await submitReview(eventId, user.id, reviewTarget.subjectId, rating, comment);
    if (ok) load();
    return ok;
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
          style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <GlassSurface />
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Recenzii</Text>
        <View style={styles.backButton} />
      </View>

      <View style={[styles.tabs, { backgroundColor: theme.surfaceMuted }]}>
        {(
          [
            ['pending', 'De acordat', pending.length],
            ['given', 'Trimise', given.length],
            ['received', 'Primite', received.length],
          ] as const
        ).map(([value, label, badge]) => (
          <AnimatedPressable
            key={value}
            onPress={() => {
              light();
              setTab(value);
            }}
            style={[styles.tab, tab === value && { backgroundColor: colors.green500 }]}
          >
            <Text style={[styles.tabLabel, { color: tab === value ? colors.white : theme.textSecondary }]}>
              {label}
              {badge > 0 ? ` (${badge})` : ''}
            </Text>
          </AnimatedPressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green500} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.green500} style={styles.loading} />
        ) : tab === 'pending' ? (
          pending.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nu ai recenzii de acordat momentan.</Text>
          ) : (
            pending.map((item) => (
              <View
                key={`${item.eventId}-${item.subjectId}`}
                style={[styles.pendingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Avatar uri={item.subjectAvatarUrl} name={item.subjectName} size={44} fontSize={18} style={styles.avatar} />
                <View style={styles.pendingCopy}>
                  <Text style={[styles.pendingName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {item.subjectName}
                  </Text>
                  <Text style={[styles.pendingEvent, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.eventTitle}
                  </Text>
                </View>
                <AnimatedPressable
                  onPress={() => setReviewTarget(item)}
                  style={[styles.rateButton, { backgroundColor: colors.green500 }]}
                >
                  <Text style={styles.rateButtonText}>Recenzează</Text>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => handleDismiss(item)} hitSlop={8} style={styles.dismissButton}>
                  <Ionicons name="close" size={16} color={theme.textSecondary} />
                </AnimatedPressable>
              </View>
            ))
          )
        ) : tab === 'given' ? (
          given.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nu ai trimis nicio recenzie încă.</Text>
          ) : (
            given.map((review) => (
              <View key={review.id} style={[styles.reviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.reviewCardHeader}>
                  <Text style={[styles.reviewName, { color: theme.textPrimary }]}>@{review.subjectUsername}</Text>
                  <Stars rating={review.rating} />
                </View>
                {review.comment ? <Text style={[styles.reviewComment, { color: theme.textSecondary }]}>{review.comment}</Text> : null}
              </View>
            ))
          )
        ) : received.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Încă nu ai primit niciun review.</Text>
        ) : (
          received.map((review) => (
            <View key={review.id} style={[styles.reviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.reviewCardHeader}>
                <Text style={[styles.reviewName, { color: theme.textPrimary }]}>{review.reviewerName}</Text>
                <Stars rating={review.rating} />
              </View>
              {review.comment ? <Text style={[styles.reviewComment, { color: theme.textSecondary }]}>{review.comment}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>

      <ReviewModal
        visible={!!reviewTarget}
        subjectName={reviewTarget?.subjectName ?? ''}
        events={reviewTarget ? [{ eventId: reviewTarget.eventId, title: reviewTarget.eventTitle }] : []}
        onSubmit={handleSubmit}
        onClose={() => setReviewTarget(null)}
      />
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
    paddingBottom: spacing.md,
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
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabLabel: { fontSize: 12, fontWeight: '800' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  loading: { marginTop: 30 },
  emptyText: { fontSize: 13, fontStyle: 'italic', paddingVertical: 20, textAlign: 'center' },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  pendingCopy: { flex: 1 },
  pendingName: { fontSize: 14, fontWeight: '700' },
  pendingEvent: { fontSize: 11, marginTop: 2 },
  rateButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11 },
  rateButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  dismissButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  reviewCard: { borderRadius: 15, borderWidth: 1, padding: 13, marginBottom: 10 },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewName: { fontSize: 13, fontWeight: '800' },
  reviewComment: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  stars: { flexDirection: 'row', gap: 1 },
});
