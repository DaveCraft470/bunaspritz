import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showAlert } from '@/lib/alert';
import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { InstagramLink } from '@/components/common/InstagramLink';
import { GlassSurface } from '@/components/common/GlassSurface';
import { FriendPrefsModal } from '@/components/social/FriendPrefsModal';
import { ReviewModal } from '@/components/social/ReviewModal';
import { ReportModal } from '@/components/social/ReportModal';
import { addReport, hasActiveReport, USER_REPORT_REASONS } from '@/lib/reports';
import {
  FriendPrefs,
  Profile,
  getFriendPrefs,
  getProfile,
  setFriendPrefs,
} from '@/lib/social';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  getFriendRequestStatus,
  getIncomingFriendRequests,
  rejectFriendRequest,
  sendFriendRequest,
  getLocalProfile,
  type RelationshipStatus,
} from '@/lib/friendRequests';
import {
  Review,
  ReviewSummary,
  ReviewableEvent,
  getReviewSummary,
  getReviewableEvents,
  getReviews,
  submitReview,
} from '@/lib/reviews';

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user } = useUser();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [relationship, setRelationship] = useState<RelationshipStatus>('none');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<FriendPrefs>({ mute_messages: false, mute_activity: false, hide_activity_from: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary>({ average: 0, count: 0 });
  const [reviewableEvents, setReviewableEvents] = useState<ReviewableEvent[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [relationshipUpdating, setRelationshipUpdating] = useState(false);

  function loadProfile() {
    if (!user || !id) return;
    setProfileLoading(true);
    setProfileError(false);
    getProfile(id)
      .then((result) => {
        const resolvedProfile = result ?? getLocalProfile(id);
        setProfile(resolvedProfile);
        setProfileLoading(false);
        if (!resolvedProfile) setProfileError(true);
      })
      .catch(() => {
        setProfileLoading(false);
        setProfileError(true);
      });
    getFriendRequestStatus(user.id, id).then(setRelationship);
    const incoming = getIncomingFriendRequests(user.id).find((request) => request.senderId === id);
    setRequestId(incoming?.id ?? null);
    getFriendPrefs(user.id, id).then(setPrefs);
    getReviews(id).then(setReviews);
    getReviewSummary(id).then(setReviewSummary);
    if (user.id !== id) getReviewableEvents(id).then(setReviewableEvents);
  }

  useEffect(loadProfile, [user, id]);

  async function onRefresh() {
    if (!user || !id) return;
    setRefreshing(true);
    try {
      const result = await getProfile(id);
      setProfile(result);
      setProfileError(!result);
      const [relationshipStatus, friendPrefs, reviewsList, summary] = await Promise.all([
        getFriendRequestStatus(user.id, id),
        getFriendPrefs(user.id, id),
        getReviews(id),
        getReviewSummary(id),
      ]);
      setRelationship(relationshipStatus);
      setRequestId(getIncomingFriendRequests(user.id).find((request) => request.senderId === id)?.id ?? null);
      setPrefs(friendPrefs);
      setReviews(reviewsList);
      setReviewSummary(summary);
      if (user.id !== id) setReviewableEvents(await getReviewableEvents(id));
    } catch {
      setProfileError(true);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSubmitReview(eventId: string, rating: number, comment: string) {
    if (!user || !id) return false;
    const ok = await submitReview(eventId, user.id, id, rating, comment);
    if (ok) {
      getReviews(id).then(setReviews);
      getReviewSummary(id).then(setReviewSummary);
      setReviewableEvents((current) => current.filter((event) => event.eventId !== eventId));
    }
    return ok;
  }

  async function handleRelationshipAction(action: 'send' | 'cancel' | 'accept' | 'reject') {
    if (!user || !id || relationshipUpdating) return;
    light();
    setRelationshipUpdating(true);
    const currentRequestId = requestId;
    const result =
      action === 'send'
        ? await sendFriendRequest(user.id, id)
        : !currentRequestId
          ? { ok: false as const, error: 'Cererea nu mai este disponibilă.' }
          : action === 'cancel'
            ? cancelFriendRequest(user.id, currentRequestId)
            : action === 'accept'
              ? acceptFriendRequest(user.id, currentRequestId)
              : rejectFriendRequest(user.id, currentRequestId);

    if (result.ok) {
      setRelationship(action === 'send' ? 'outgoing_pending' : action === 'accept' ? 'friends' : 'none');
      if (action !== 'send') setRequestId(null);
    } else {
      showAlert('A apărut o eroare', result.error);
    }
    setRelationshipUpdating(false);
  }

  async function updatePref(patch: Partial<FriendPrefs>) {
    if (!user || !id) return;
    light();
    const previous = prefs;
    setPrefs((current) => ({ ...current, ...patch }));
    const ok = await setFriendPrefs(user.id, id, patch);
    if (!ok) {
      setPrefs(previous);
      showAlert('A apărut o eroare', 'Nu am putut salva preferința. Încearcă din nou.');
    }
  }

  if (!profile) {
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
          <View style={styles.backButton} />
        </View>
        {!profileLoading && (
          <View style={styles.notFoundWrap}>
            <Text style={[styles.notFoundText, { color: theme.textSecondary }]}>
              {profileError ? 'Nu am putut încărca profilul.' : 'Profil negăsit.'}
            </Text>
            {profileError && (
              <Pressable onPress={loadProfile} style={[styles.retryButton, { borderColor: theme.border }]}>
                <Text style={[styles.retryText, { color: theme.accent }]}>Reîncearcă</Text>
              </Pressable>
            )}
          </View>
        )}
      </SafeAreaView>
    );
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
        <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
          @{profile.username}
        </Text>
        <AnimatedPressable
          onPress={() => {
            light();
            setMenuOpen(true);
          }}
          hitSlop={10}
          accessibilityLabel="Mai multe opțiuni"
          style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <GlassSurface />
          <Ionicons name="ellipsis-horizontal" size={20} color={glassButton.icon} />
        </AnimatedPressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green500} />}
      >
        <View style={styles.header}>
          <Avatar
            uri={profile.avatar_url}
            name={profile.name}
            size={84}
            fontSize={34}
            color="#12C854"
            style={[styles.avatar, { borderColor: theme.surface }]}
          />
          <Text style={[styles.name, { color: theme.textPrimary }]}>{profile.name}</Text>
          <Text style={[styles.handle, { color: theme.textSecondary }]}>@{profile.username}</Text>
          {profile.bio ? <Text style={[styles.bio, { color: theme.textSecondary }]}>{profile.bio}</Text> : null}
          <InstagramLink handle={profile.instagram_handle} style={styles.instagramLink} />
        </View>

        {user?.id !== id && <View style={styles.actionsRow}>
          {relationship === 'incoming_pending' ? (
            <>
              <AnimatedPressable
                onPress={() => handleRelationshipAction('accept')}
                disabled={relationshipUpdating}
                style={[styles.actionButton, { backgroundColor: colors.green500, opacity: relationshipUpdating ? 0.6 : 1 }]}
              >
                <Text style={[styles.actionText, { color: colors.white }]}>{relationshipUpdating ? 'Se actualizează...' : 'Acceptă'}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => handleRelationshipAction('reject')}
                disabled={relationshipUpdating}
                style={[styles.actionButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1 }]}
              >
                <Text style={[styles.actionText, { color: theme.textPrimary }]}>Respinge</Text>
              </AnimatedPressable>
            </>
          ) : (
            <AnimatedPressable
              onPress={() => handleRelationshipAction(relationship === 'outgoing_pending' ? 'cancel' : 'send')}
              disabled={relationshipUpdating || relationship === 'friends'}
              style={[
                styles.actionButton,
                relationship === 'friends' || relationship === 'outgoing_pending'
                  ? { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1 }
                  : { backgroundColor: colors.green500 },
                { opacity: relationshipUpdating ? 0.6 : 1 },
              ]}
            >
              <Text
                style={[styles.actionText, { color: relationship === 'none' ? colors.white : theme.textPrimary }]}
              >
                {relationshipUpdating
                  ? 'Se actualizează...'
                  : relationship === 'friends'
                    ? 'Prieteni ✓'
                    : relationship === 'outgoing_pending'
                      ? 'Anulează cererea'
                      : 'Adaugă la prieteni'}
              </Text>
            </AnimatedPressable>
          )}

          <AnimatedPressable
            onPress={() => relationship === 'friends' && router.push({ pathname: '/messages', params: { friendId: id } })}
            disabled={relationship !== 'friends'}
            style={[
              styles.actionButton,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1, opacity: relationship === 'friends' ? 1 : 0.5 },
            ]}
          >
            <Text style={[styles.actionText, { color: theme.textPrimary }]}>Mesaj</Text>
          </AnimatedPressable>
        </View>}

        {user?.id !== id && relationship !== 'friends' && (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Puteți să vă trimiteți mesaje după ce deveniți prieteni.
          </Text>
        )}

        {user && user.id !== id && (
          <AnimatedPressable onPress={() => setReportModalOpen(true)} style={[styles.reportButton, { borderColor: theme.border }]}>
            <Text style={[styles.reportButtonText, { color: theme.textSecondary }]}>Raportează utilizatorul</Text>
          </AnimatedPressable>
        )}

        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <View style={styles.reviewsSummary}>
              <Ionicons name="star" size={16} color="#F5B301" />
              <Text style={[styles.reviewsAverage, { color: theme.textPrimary }]}>
                {reviewSummary.count > 0 ? reviewSummary.average.toFixed(1) : '–'}
              </Text>
              <Text style={[styles.reviewsCount, { color: theme.textSecondary }]}>
                ({reviewSummary.count} {reviewSummary.count === 1 ? 'review' : 'review-uri'})
              </Text>
            </View>
            {reviewableEvents.length > 0 && (
              <Pressable
                onPress={() => {
                  light();
                  setReviewModalOpen(true);
                }}
                style={[styles.reviewButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
              >
                <Text style={[styles.reviewButtonText, { color: theme.accent }]}>Lasă un review</Text>
              </Pressable>
            )}
          </View>

          {reviews.length === 0 ? (
            <Text style={[styles.reviewsEmpty, { color: theme.textSecondary }]}>Niciun review încă.</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={[styles.reviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.reviewCardHeader}>
                  <Text style={[styles.reviewerName, { color: theme.textPrimary }]}>{review.reviewerName}</Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Ionicons
                        key={value}
                        name={value <= review.rating ? 'star' : 'star-outline'}
                        size={12}
                        color="#F5B301"
                      />
                    ))}
                  </View>
                </View>
                {review.comment ? (
                  <Text style={[styles.reviewComment, { color: theme.textSecondary }]}>{review.comment}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <FriendPrefsModal
        visible={menuOpen}
        friendName={profile.name}
        prefs={prefs}
        onChange={updatePref}
        onClose={() => setMenuOpen(false)}
      />

      <ReviewModal
        visible={reviewModalOpen}
        subjectName={profile.name}
        events={reviewableEvents}
        onSubmit={handleSubmitReview}
        onClose={() => setReviewModalOpen(false)}
      />
      <ReportModal
        visible={reportModalOpen}
        targetType="user"
        targetLabel={`@${profile.username}`}
        reasons={USER_REPORT_REASONS}
        onSubmit={(reason, description) => {
          if (!user || !id) return;
          if (hasActiveReport(user.id, 'user', id)) {
            showAlert('Raport duplicat', 'Ai raportat deja acest utilizator.');
            return;
          }
          addReport({
            reporterId: user.id,
            reporterLabel: `@${user.username}`,
            targetType: 'user',
            targetId: id,
            targetLabel: `@${profile.username}`,
            reason,
            description,
          });
          showAlert('Raport trimis', 'Raportul a fost adăugat local pentru verificare.');
        }}
        onClose={() => setReportModalOpen(false)}
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
    gap: spacing.md,
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
  title: { fontSize: 15, fontWeight: '800', flex: 1, textAlign: 'center' },
  notFoundWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: spacing.xl },
  notFoundText: { fontSize: 14, textAlign: 'center' },
  retryButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  retryText: { fontSize: 13, fontWeight: '700' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40, alignItems: 'center' },
  header: { alignItems: 'center', marginTop: 10, marginBottom: 22 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 30,
    borderWidth: 3,
    marginBottom: 14,
  },
  name: { fontSize: 21, fontWeight: '800' },
  handle: { fontSize: 13, marginTop: 3 },
  bio: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 12, maxWidth: 320 },
  instagramLink: { alignSelf: 'center', marginTop: 10 },
  actionsRow: { flexDirection: 'row', gap: 10, width: '100%', maxWidth: 360 },
  actionButton: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '800' },
  hint: { fontSize: 11, fontStyle: 'italic', marginTop: 14, textAlign: 'center', maxWidth: 300 },
  reportButton: { alignSelf: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginTop: 18 },
  reportButtonText: { fontSize: 11, fontWeight: '700' },
  reviewsSection: { width: '100%', maxWidth: 360, marginTop: 26 },
  reviewsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  reviewsSummary: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reviewsAverage: { fontSize: 15, fontWeight: '800' },
  reviewsCount: { fontSize: 12, fontWeight: '600' },
  reviewButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, borderWidth: 1 },
  reviewButtonText: { fontSize: 11, fontWeight: '800' },
  reviewsEmpty: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
  reviewCard: { borderRadius: 15, borderWidth: 1, padding: 13, marginBottom: 10 },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewerName: { fontSize: 13, fontWeight: '800' },
  reviewStars: { flexDirection: 'row', gap: 1 },
  reviewComment: { fontSize: 12, lineHeight: 17, marginTop: 6 },
});
