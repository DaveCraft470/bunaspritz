import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { VERIFICATION_REQUIRED } from '@/constants/featureFlags';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { Avatar } from '@/components/common/Avatar';
import { InstagramLink } from '@/components/common/InstagramLink';
import { Ionicons } from '@expo/vector-icons';
import { getFriends } from '@/lib/friendRequests';
import { getUserEventStats } from '@/lib/events';
import { getReviews, getReviewSummary, type Review, type ReviewSummary } from '@/lib/reviews';
import { useHaptics } from '@/contexts/HapticsContext';
import { BADGE_DEFINITIONS, getUserBadges, type EarnedBadge } from '@/lib/badges';
import { QrModal } from '@/components/common/QrModal';
import { buildProfileDeepLink } from '@/lib/sharing';

// Profile design by raulnitu8 — ported from App.tsx's ProfileScreen onto its
// own Expo Router screen, matching how app/messages.tsx was ported.

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useAppTheme();
  const { t } = useLanguage();
  const { user, effectiveVerified } = useUser();
  const { light } = useHaptics();
  const [friendCount, setFriendCount] = useState(0);
  const [eventStats, setEventStats] = useState({ attended: 0, hosted: 0 });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary>({ average: 0, count: 0 });
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  // getFriends/getUserEventStats/getReviews/getReviewSummary already resolve
  // to safe defaults (empty list / zero counts) rather than throwing, so
  // there's no distinct load-error state to surface here — this just makes
  // "did it actually refetch" pullable instead of only ever loading once on
  // mount.
  const load = useCallback(async () => {
    if (!user) return;
    const [friends, stats, reviewsList, summary, badges] = await Promise.all([
      getFriends(user.id),
      getUserEventStats(user.id),
      getReviews(user.id),
      getReviewSummary(user.id),
      getUserBadges(user.id),
    ]);
    setFriendCount(friends.length);
    setEventStats(stats);
    setReviews(reviewsList);
    setReviewSummary(summary);
    setEarnedBadges(badges);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const name = user?.name || t.profile.defaultName;
  const username = user?.username || t.profile.defaultUsername;
  const bio = user?.bio || '';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <ScrollView
        style={[styles.profile, { backgroundColor: theme.page }]}
        contentContainerStyle={[styles.profileContent, { paddingBottom: insets.bottom + 116 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green500} />}
      >
        <View style={styles.profileHeader}>
          <Avatar
            uri={user?.avatarUrl}
            name={name}
            size={74}
            fontSize={32}
            color="#12C854"
            style={[styles.profileAvatar, { borderColor: theme.surface }]}
          />
          <View style={styles.profileTitleBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.profileName, { color: theme.textPrimary }]}>{name}</Text>
              {effectiveVerified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓</Text>
                </View>
              )}
            </View>
            <Text style={[styles.profileHandle, { color: theme.textSecondary }]}>@{username}</Text>
          </View>
          <Pressable
            onPress={() => {
              light();
              setQrModalVisible(true);
            }}
            hitSlop={8}
            accessibilityLabel="Codul tău QR"
            style={styles.qrButton}
          >
            <Ionicons name="qr-code-outline" size={20} color={theme.textPrimary} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/edit-profile')}
            style={[styles.editButton, { borderColor: theme.border }]}
          >
            <Text style={[styles.editText, { color: theme.accent }]}>{t.profile.edit}</Text>
          </Pressable>
        </View>

        {bio ? <Text style={[styles.bio, { color: theme.textSecondary }]}>{bio}</Text> : null}
        <InstagramLink handle={user?.instagramHandle} />

        <View style={[styles.statsRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable style={styles.stat} onPress={() => router.push('/friends')}>
            <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{friendCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.profile.friends}</Text>
          </Pressable>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{eventStats.attended}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.profile.events}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{eventStats.hosted}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.profile.hosted}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/memories')}
          style={[styles.myEventsButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.myEventsCopy}>
            <Text style={[styles.myEventsTitle, { color: theme.textPrimary }]}>Amintiri</Text>
            <Text style={[styles.myEventsDetail, { color: theme.textSecondary }]}>
              Evenimentele la care ai participat, cu poze și statistici.
            </Text>
          </View>
          <Text style={[styles.myEventsArrow, { color: theme.accent }]}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/gamification')}
          style={[styles.myEventsButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.myEventsCopy}>
            <Text style={[styles.myEventsTitle, { color: theme.textPrimary }]}>Progres & Clasament</Text>
            <Text style={[styles.myEventsDetail, { color: theme.textSecondary }]}>
              XP, nivel, streak, misiuni și clasamentul.
            </Text>
          </View>
          <Text style={[styles.myEventsArrow, { color: theme.accent }]}>›</Text>
        </Pressable>

        <View style={[styles.badgesSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.badgesHeader}>
            <Text style={[styles.myEventsTitle, { color: theme.textPrimary }]}>Trofee</Text>
            <Pressable onPress={() => router.push('/badges')} hitSlop={8}>
              <Text style={[styles.badgesSeeAll, { color: theme.accent }]}>Vezi toate ›</Text>
            </Pressable>
          </View>
          {earnedBadges.length === 0 ? (
            <Text style={[styles.myEventsDetail, { color: theme.textSecondary }]}>
              Încă nu ai obținut niciun trofeu.
            </Text>
          ) : (
            <View style={styles.badgesGrid}>
              {BADGE_DEFINITIONS.filter((badge) => earnedBadges.some((earned) => earned.badgeId === badge.id)).map(
                (badge) => (
                  <Pressable
                    key={badge.id}
                    onPress={() => router.push(`/badge/${badge.id}`)}
                    style={[styles.badgeItem, { backgroundColor: theme.surfaceMuted }]}
                  >
                    <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                    <Text numberOfLines={1} style={[styles.badgeTitle, { color: theme.textPrimary }]}>
                      {badge.title}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          )}
        </View>

        <Pressable
          onPress={() => router.push('/reviews')}
          style={[styles.myEventsButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.myEventsCopy}>
            <Text style={[styles.myEventsTitle, { color: theme.textPrimary }]}>Recenzii</Text>
            <Text style={[styles.myEventsDetail, { color: theme.textSecondary }]}>
              Recenzii de acordat, trimise și primite.
            </Text>
          </View>
          <Text style={[styles.myEventsArrow, { color: theme.accent }]}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (!effectiveVerified) {
              router.push({ pathname: '/verification', params: { returnTo: '/profile' } });
            }
          }}
          style={[styles.verifyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={[styles.verifyIcon, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.verifyIconText, { color: theme.accent }]}>✓</Text>
          </View>
          <View style={styles.verifyCopy}>
            <Text style={[styles.verifyTitle, { color: theme.textPrimary }]}>
              {effectiveVerified ? t.profile.identityVerified : t.profile.identityVerification}
            </Text>
            <Text style={[styles.verifyDetail, { color: theme.textSecondary }]}>
              {effectiveVerified
                ? t.profile.verifiedDetail
                : VERIFICATION_REQUIRED
                  ? t.profile.verifyRequiredDetail
                  : 'Verifică-ți identitatea și vârsta (18+).'}
            </Text>
          </View>
          {!effectiveVerified && <Text style={[styles.verifyArrow, { color: theme.accent }]}>›</Text>}
        </Pressable>

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
          </View>

          {reviews.length === 0 ? (
            <Text style={[styles.reviewsEmpty, { color: theme.textSecondary }]}>Încă nu ai primit niciun review.</Text>
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
      {user && (
        <QrModal visible={qrModalVisible} title={`@${username}`} link={buildProfileDeepLink(user.id)} onClose={() => setQrModalVisible(false)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  profile: { flex: 1 },
  profileContent: { padding: 22 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar: { width: 74, height: 74, borderRadius: 27, borderWidth: 3 },
  profileTitleBlock: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  profileName: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  verifiedBadge: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  profileHandle: { fontSize: 12, marginTop: 3 },
  editButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  qrButton: { padding: 8, marginRight: 4 },
  editText: { fontSize: 11, fontWeight: '800' },
  bio: { fontSize: 14, lineHeight: 20, marginTop: 20, marginBottom: 18 },
  statsRow: { flexDirection: 'row', marginVertical: 16, borderRadius: 16, borderWidth: 1 },
  stat: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statNumber: { fontSize: 19, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 3, fontWeight: '700' },
  myEventsButton: { width: '100%', marginTop: 0, marginBottom: 6, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 17, borderWidth: 1 },
  myEventsIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  myEventsEmoji: { fontSize: 19 },
  myEventsCopy: { flex: 1 },
  myEventsTitle: { fontSize: 14, fontWeight: '800' },
  myEventsDetail: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  myEventsArrow: { fontSize: 28, fontWeight: '300' },
  badgesSection: { width: '100%', marginTop: 0, marginBottom: 6, padding: 14, borderRadius: 17, borderWidth: 1 },
  badgesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  badgesSeeAll: { fontSize: 12, fontWeight: '800' },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeItem: { width: 74, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  badgeEmoji: { fontSize: 22 },
  badgeTitle: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  verifyCard: { marginTop: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 17, borderWidth: 1 },
  verifyIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  verifyIconText: { fontSize: 19, fontWeight: '900' },
  verifyCopy: { flex: 1 },
  verifyTitle: { fontSize: 13, fontWeight: '800' },
  verifyDetail: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  verifyArrow: { fontSize: 26, fontWeight: '300' },
  reviewsSection: { width: '100%', marginTop: 26 },
  reviewsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  reviewsSummary: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reviewsAverage: { fontSize: 15, fontWeight: '800' },
  reviewsCount: { fontSize: 12, fontWeight: '600' },
  reviewsEmpty: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
  reviewCard: { borderRadius: 15, borderWidth: 1, padding: 13, marginBottom: 10 },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewerName: { fontSize: 13, fontWeight: '800' },
  reviewStars: { flexDirection: 'row', gap: 1 },
  reviewComment: { fontSize: 12, lineHeight: 17, marginTop: 6 },
});
