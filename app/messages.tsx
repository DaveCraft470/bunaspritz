import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/ThemeContext';
import { useNavVisibility } from '@/contexts/NavVisibilityContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { Profile, getMutualFriends } from '@/lib/social';
import { DbMessage, getLastMessage, getThread, sendDirectMessage, subscribeToIncoming } from '@/lib/messaging';

// Chat list / message bubble design by nituraul8 — ported from App.tsx onto
// its own Expo Router screen so it lives alongside the rest of the app.
// The 3 group chats below stay mock/decorative; real 1:1 friend DMs are a
// separate, backend-backed capability added alongside them.

type DisplayMessage = { id: string; text: string; time: string; sender: string; mine: boolean };
type ActiveChat = { kind: 'group'; id: string } | { kind: 'friend'; id: string };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

// Fakes a text-stroke (RN has no such style) by stacking black copies of the
// label offset by 1px in every direction underneath the real, on-top copy.
const OUTLINE_OFFSETS: Array<[number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

function OutlinedGroupName({ children }: { children: string }) {
  return (
    <>
      {OUTLINE_OFFSETS.map(([dx, dy], i) => (
        <Text
          key={i}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[styles.groupNameOverlay, styles.groupNameOutline, { transform: [{ translateX: dx }, { translateY: dy }] }]}
        >
          {children}
        </Text>
      ))}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.groupNameOverlay}>
        {children}
      </Text>
    </>
  );
}

const chats = [
  { id: 'brasov', title: 'Brașov azi', detail: '12 persoane active', emoji: '⛰️', color: '#25D960' },
  { id: 'gasca', title: 'Gașca de sâmbătă', detail: 'Vlad: Ne vedem la 8?', emoji: '🍹', color: '#08B94C' },
  { id: 'poiana', title: 'Poiana Brașov', detail: 'Ioana: Vin și eu!', emoji: '❄️', color: '#74EB99' },
];

const starterMessages: DisplayMessage[] = [
  { id: '1', sender: 'Mara', text: 'Ce faceți diseară? ✨', time: '18:41', mine: false },
  { id: '2', sender: 'Vlad', text: 'Mergem la un spriț în centru?', time: '18:42', mine: false },
  { id: '3', sender: 'Tu', text: 'Eu sunt pentru! Unde ne vedem?', time: '18:43', mine: true },
  { id: '4', sender: 'Ioana', text: 'La Republicii, pe la 20:00?', time: '18:44', mine: false },
];

export default function Messages() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useAppTheme();
  const { setHidden } = useNavVisibility();
  const { light } = useHaptics();
  const { user } = useUser();
  const { friendId } = useLocalSearchParams<{ friendId?: string }>();

  // null = showing the list; a chat only opens once the user taps it, or
  // this screen was opened directly on a friend's thread (?friendId=...).
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(friendId ? { kind: 'friend', id: friendId } : null);

  useEffect(() => {
    if (friendId) {
      setActiveChat({ kind: 'friend', id: friendId });
      setHidden(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId]);
  const [groupMessages, setGroupMessages] = useState<DisplayMessage[]>(starterMessages);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendPreviews, setFriendPreviews] = useState<Record<string, string>>({});
  const [friendMessages, setFriendMessages] = useState<DbMessage[]>([]);
  const [draft, setDraft] = useState('');
  const messagesScrollRef = useRef<ScrollView>(null);
  const restingComposerOffset = insets.bottom + 16;
  const composerOffset = useRef(new Animated.Value(restingComposerOffset)).current;

  const activeFriend = activeChat?.kind === 'friend' ? friends.find((f) => f.id === activeChat.id) : undefined;
  const selectedGroup = activeChat?.kind === 'group' ? chats.find((c) => c.id === activeChat.id) : undefined;

  // Load your mutual friends + a one-line preview of your last message with
  // each, for the "PRIETENI" section of the list screen.
  useEffect(() => {
    if (!user) return;
    getMutualFriends(user.id).then(async (list) => {
      setFriends(list);
      const previews = await Promise.all(list.map((f) => getLastMessage(user.id, f.id)));
      const map: Record<string, string> = {};
      list.forEach((f, i) => {
        const last = previews[i];
        map[f.id] = last ? (last.sender_id === user.id ? `Tu: ${last.text}` : last.text) : 'Trimite un mesaj';
      });
      setFriendPreviews(map);
    });
  }, [user]);

  // Load the full thread whenever a friend conversation is opened.
  useEffect(() => {
    if (!user || activeChat?.kind !== 'friend') return;
    getThread(user.id, activeChat.id).then(setFriendMessages);
  }, [user, activeChat]);

  // Live-append messages that land while a friend thread is open.
  useEffect(() => {
    if (!user) return;
    return subscribeToIncoming(user.id, (message) => {
      if (activeChat?.kind === 'friend' && message.sender_id === activeChat.id) {
        setFriendMessages((current) => [...current, message]);
      }
      setFriendPreviews((current) => ({ ...current, [message.sender_id]: message.text }));
    });
  }, [user, activeChat]);

  const displayedMessages: DisplayMessage[] = useMemo(() => {
    if (activeChat?.kind === 'group') return groupMessages;
    if (activeChat?.kind === 'friend' && user) {
      return friendMessages.map((m) => ({
        id: m.id,
        text: m.text,
        time: formatTime(m.created_at),
        sender: m.sender_id === user.id ? 'Tu' : activeFriend?.name ?? '',
        mine: m.sender_id === user.id,
      }));
    }
    return [];
  }, [activeChat, groupMessages, friendMessages, user, activeFriend]);

  // Track the keyboard ourselves instead of KeyboardAvoidingView — it kept
  // over-shooting (resize windowSoftInputMode plus its own height-shrinking
  // stacked on top of each other). Just float the composer to sit a little
  // above wherever the keyboard's top edge actually is.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const KEYBOARD_GAP = 10;

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(composerOffset, {
        toValue: e.endCoordinates.height + KEYBOARD_GAP,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(composerOffset, {
        toValue: restingComposerOffset,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [composerOffset, restingComposerOffset]);

  // Hide the floating home/messages/profile nav while a chat is open, so it
  // doesn't float over the composer — bring it back on returning to the grid
  // or leaving this screen entirely.
  useEffect(() => {
    setHidden(activeChat !== null);
    return () => setHidden(false);
  }, [activeChat, setHidden]);

  // Jump to the latest message whenever the thread grows (sending a message)
  // or a chat is first opened, instead of leaving the user scrolled wherever
  // they were.
  useEffect(() => {
    if (!activeChat) return;
    const timer = setTimeout(() => messagesScrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [activeChat, displayedMessages]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !activeChat) return;
    light();
    setDraft('');

    if (activeChat.kind === 'group') {
      setGroupMessages((current) => [...current, { id: String(Date.now()), sender: 'Tu', text, time: 'Acum', mine: true }]);
      return;
    }

    if (!user) return;
    const sent = await sendDirectMessage(user.id, activeChat.id, text);
    if (sent) {
      setFriendMessages((current) => [...current, sent]);
      setFriendPreviews((current) => ({ ...current, [activeChat.id]: `Tu: ${text}` }));
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <View style={[styles.page, { backgroundColor: theme.page }]}>
        {!activeChat ? (
          <>
            <View style={styles.topBar}>
              <View>
                <Text style={[styles.eyebrow, { color: theme.accent }]}>BUNĂ {(user?.name || '').toUpperCase()}, SPRITZ?</Text>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Mesaje</Text>
              </View>
              <Pressable style={styles.roundButton}>
                <Text style={styles.roundButtonText}>+</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + 116 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.groupGrid}>
                {chats.map((chat) => (
                  <Pressable
                    key={chat.id}
                    onPress={() => {
                      light();
                      setHidden(true);
                      setActiveChat({ kind: 'group', id: chat.id });
                    }}
                    style={[styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <View style={[styles.groupPhoto, { backgroundColor: chat.color }]}>
                      <Text style={styles.groupEmoji}>{chat.emoji}</Text>
                      <OutlinedGroupName>{chat.title.toUpperCase()}</OutlinedGroupName>
                    </View>
                    <Text numberOfLines={1} style={[styles.groupDetail, { color: theme.textSecondary }]}>
                      {chat.detail}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {friends.length > 0 && (
                <View style={styles.friendsSection}>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PRIETENI</Text>
                  {friends.map((friend) => (
                    <Pressable
                      key={friend.id}
                      onPress={() => {
                        light();
                        setHidden(true);
                        setActiveChat({ kind: 'friend', id: friend.id });
                      }}
                      style={[styles.friendRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                      <View style={[styles.friendAvatar, { backgroundColor: theme.surfaceMuted }]}>
                        <Text style={[styles.friendAvatarLetter, { color: theme.textPrimary }]}>
                          {friend.name.trim().charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={styles.friendText}>
                        <Text style={[styles.friendName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {friend.name}
                        </Text>
                        <Text style={[styles.friendPreview, { color: theme.textSecondary }]} numberOfLines={1}>
                          {friendPreviews[friend.id] ?? 'Trimite un mesaj'}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </>
        ) : (
          <>
            <View style={[styles.chatHeader, { borderColor: theme.border }]}>
              <Pressable
                onPress={() => {
                  light();
                  setActiveChat(null);
                }}
                hitSlop={10}
                accessibilityLabel="Înapoi la mesaje"
              >
                <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
              </Pressable>
              <View style={[styles.avatar, { backgroundColor: selectedGroup?.color ?? theme.surfaceMuted }]}>
                <Text style={selectedGroup ? styles.emoji : [styles.friendAvatarLetter, { color: theme.textPrimary }]}>
                  {selectedGroup ? selectedGroup.emoji : activeFriend?.name.trim().charAt(0).toUpperCase() ?? '?'}
                </Text>
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                  {selectedGroup ? selectedGroup.title : activeFriend?.name}
                </Text>
                {selectedGroup && <Text style={[styles.online, { color: theme.accent }]}>● activi acum în Brașov</Text>}
              </View>
              <Text style={[styles.more, { color: theme.textSecondary }]}>•••</Text>
            </View>

            <ScrollView
              ref={messagesScrollRef}
              style={styles.messages}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => messagesScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {selectedGroup && <Text style={[styles.today, { color: theme.textSecondary }]}>ASTĂZI</Text>}
              {displayedMessages.map((message) => (
                <View key={message.id} style={[styles.messageRow, message.mine && styles.messageRowMine]}>
                  {!message.mine && <View style={styles.dot} />}
                  <View
                    style={[
                      styles.bubble,
                      message.mine ? styles.mine : [styles.other, { backgroundColor: theme.surfaceMuted }],
                    ]}
                  >
                    {selectedGroup && (
                      <Text style={[styles.sender, message.mine ? styles.senderMine : { color: theme.accent }]}>
                        {message.sender}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.messageText,
                        message.mine ? styles.messageTextMine : { color: theme.textPrimary },
                      ]}
                    >
                      {message.text}
                    </Text>
                    <Text style={[styles.time, message.mine ? styles.timeMine : { color: theme.textSecondary }]}>
                      {message.time}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* marginBottom tracks the keyboard directly (see the effect above)
                instead of KeyboardAvoidingView, which overshot on Android. */}
            <Animated.View
              style={[
                styles.composer,
                { marginBottom: composerOffset, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={[styles.add, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.addText, { color: theme.accent }]}>+</Text>
              </View>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={sendMessage}
                placeholder="Scrie un mesaj..."
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.textPrimary }]}
                returnKeyType="send"
              />
              <Pressable style={styles.voice} accessibilityLabel="Înregistrează mesaj vocal">
                <Text style={styles.voiceText}>🎤</Text>
              </Pressable>
              <Pressable onPress={sendMessage} style={[styles.send, !draft.trim() && styles.sendOff]}>
                <Text style={styles.sendText}>↑</Text>
              </Pressable>
            </Animated.View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  page: { flex: 1 },
  topBar: { paddingHorizontal: 22, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  roundButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  roundButtonText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', marginTop: -2 },
  groupGrid: {
    paddingHorizontal: 18,
    paddingTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },
  groupCard: { width: '47%', borderRadius: 18, overflow: 'hidden', borderWidth: 1, padding: 10 },
  groupPhoto: { aspectRatio: 1.3, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  groupEmoji: { fontSize: 34 },
  groupNameOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
  groupNameOutline: { color: '#000000' },
  groupDetail: { fontSize: 11, marginTop: 9 },
  friendsSection: { paddingHorizontal: 18, paddingTop: 26 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 10 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  friendAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  friendAvatarLetter: { fontSize: 18, fontWeight: '800' },
  friendText: { flex: 1 },
  friendName: { fontSize: 14, fontWeight: '700' },
  friendPreview: { fontSize: 11, marginTop: 2 },
  avatar: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 18 },
  chatHeader: { marginHorizontal: 22, marginTop: 14, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  online: { fontSize: 11, marginTop: 3, fontWeight: '600' },
  more: { marginLeft: 'auto', fontSize: 18, letterSpacing: 1 },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 16, gap: 12 },
  today: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, alignSelf: 'center', marginBottom: 4 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  messageRowMine: { justifyContent: 'flex-end' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#25D960', marginBottom: 12 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8 },
  other: { borderRadius: 18, borderBottomLeftRadius: 5 },
  mine: { backgroundColor: '#12C854', borderRadius: 18, borderBottomRightRadius: 5 },
  sender: { fontSize: 11, fontWeight: '800', marginBottom: 3 },
  senderMine: { color: '#D6FFE2', textAlign: 'right' },
  messageText: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  messageTextMine: { color: '#FFFFFF' },
  time: { fontSize: 9, textAlign: 'right', marginTop: 4 },
  timeMine: { color: '#D6FFE2' },
  composer: { marginHorizontal: 16, paddingVertical: 7, paddingHorizontal: 7, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  add: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 25, fontWeight: '300', marginTop: -2 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: '#BDEBCB' },
  sendText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: -4 },
  voice: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  voiceText: { fontSize: 23 },
});
