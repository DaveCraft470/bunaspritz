import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';

import { colors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useNavVisibility } from '@/contexts/NavVisibilityContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { Profile, getMutualFriends } from '@/lib/social';
import {
  DbMessage,
  MediaType,
  getLastMessage,
  getSignedMediaUrl,
  getThread,
  getUnreadCount,
  markThreadRead,
  sendDirectMessage,
  sendMediaMessage,
  subscribeToIncoming,
  subscribeToReadReceipts,
} from '@/lib/messaging';

// Chat list / message bubble design by nituraul8 — ported from App.tsx onto
// its own Expo Router screen so it lives alongside the rest of the app.
// The 3 group chats below stay mock/decorative; real 1:1 friend DMs are a
// separate, backend-backed capability added alongside them.

type DisplayMessage = {
  id: string;
  text: string;
  time: string;
  sender: string;
  mine: boolean;
  read: boolean;
  mediaType?: MediaType | null;
  mediaPath?: string | null;
  durationMs?: number | null;
};
type ActiveChat = { kind: 'group'; id: string } | { kind: 'friend'; id: string };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

// What the chat-list row shows for a thread's last message — media has no
// text (see lib/messaging.sendMediaMessage), so it needs its own preview.
function messagePreview(message: DbMessage): string {
  if (message.media_type === 'image') return '📷 Poză';
  if (message.media_type === 'audio') return '🎤 Mesaj vocal';
  return message.text;
}

function formatDuration(ms: number | null | undefined) {
  const totalSeconds = Math.max(0, Math.round((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function extensionAndTypeForImage(asset: ImagePicker.ImagePickerAsset): { extension: string; contentType: string } {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  if (mimeType === 'image/png') return { extension: '.png', contentType: mimeType };
  if (mimeType === 'image/webp') return { extension: '.webp', contentType: mimeType };
  return { extension: '.jpg', contentType: 'image/jpeg' };
}

// One bubble's photo, resolved from a signed URL on demand — the DB only
// stores the private bucket path (see messages.media_path).
function ImageBubble({ path }: { path: string }) {
  const { colors: theme } = useAppTheme();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSignedMediaUrl(path).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) {
    return (
      <View style={[styles.imageBubble, styles.imageBubbleLoading, { backgroundColor: theme.surfaceMuted }]}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }

  return <Image source={{ uri: url }} style={styles.imageBubble} resizeMode="cover" />;
}

// One bubble's voice note. Playback is driven by the single shared player
// owned by the screen (see Messages()) — this just renders the button/state
// for whichever message id is currently loaded into it.
function VoiceBubble({
  isPlaying,
  isMine,
  durationMs,
  onToggle,
}: {
  isPlaying: boolean;
  isMine: boolean;
  durationMs: number | null | undefined;
  onToggle: () => void;
}) {
  const { colors: theme } = useAppTheme();
  return (
    <Pressable onPress={onToggle} style={styles.voiceBubbleRow} hitSlop={6}>
      <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={30} color={isMine ? colors.white : colors.green500} />
      <View style={[styles.voiceWave, { backgroundColor: isMine ? 'rgba(255,255,255,0.5)' : colors.green500 }]} />
      <Text style={[styles.voiceDuration, { color: isMine ? colors.white : theme.textPrimary }]}>
        {formatDuration(durationMs)}
      </Text>
    </Pressable>
  );
}

// The list row's timestamp: a time for anything from today, a date otherwise
// — matches the reference design's mix of "18:41" vs "19/08/2026".
function formatListTimestamp(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const chats = [
  { id: 'brasov', title: 'Brașov azi', detail: '12 persoane active', emoji: '⛰️', color: '#25D960', time: 'Azi' },
  { id: 'gasca', title: 'Gașca de sâmbătă', detail: 'Vlad: Ne vedem la 8?', emoji: '🍹', color: '#08B94C', time: 'Azi' },
  { id: 'poiana', title: 'Poiana Brașov', detail: 'Ioana: Vin și eu!', emoji: '❄️', color: '#74EB99', time: 'Azi' },
];

// Shared chat-list row — same shape for the mock group chats and the real
// friend DMs, matching the reference design: avatar, name + timestamp on
// top, preview (with a read-receipt tick when it's your own last message)
// and an unread badge on the bottom line.
function ChatListRow({
  avatarNode,
  avatarColor,
  name,
  timestamp,
  preview,
  mine,
  read,
  unreadCount,
  onPress,
}: {
  avatarNode: ReactNode;
  avatarColor: string;
  name: string;
  timestamp: string | null;
  preview: string;
  mine: boolean;
  read: boolean;
  unreadCount: number;
  onPress: () => void;
}) {
  const { colors: theme } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={styles.chatRow}>
      <View style={[styles.chatAvatar, { backgroundColor: avatarColor }]}>{avatarNode}</View>
      <View style={styles.chatBody}>
        <View style={styles.chatTopLine}>
          <Text numberOfLines={1} style={[styles.chatName, { color: theme.textPrimary }]}>
            {name}
          </Text>
          {timestamp && <Text style={[styles.chatTime, { color: theme.accent }]}>{timestamp}</Text>}
        </View>
        <View style={styles.chatBottomLine}>
          <View style={styles.chatPreviewRow}>
            {mine && (
              <Ionicons
                name={read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={read ? colors.green500 : theme.textSecondary}
                style={styles.chatTick}
              />
            )}
            <Text numberOfLines={1} style={[styles.chatPreview, { color: theme.textSecondary }]}>
              {preview}
            </Text>
          </View>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const starterMessages: DisplayMessage[] = [
  { id: '1', sender: 'Mara', text: 'Ce faceți diseară? ✨', time: '18:41', mine: false, read: false },
  { id: '2', sender: 'Vlad', text: 'Mergem la un spriț în centru?', time: '18:42', mine: false, read: false },
  { id: '3', sender: 'Tu', text: 'Eu sunt pentru! Unde ne vedem?', time: '18:43', mine: true, read: true },
  { id: '4', sender: 'Ioana', text: 'La Republicii, pe la 20:00?', time: '18:44', mine: false, read: false },
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
  const [friendLast, setFriendLast] = useState<Record<string, DbMessage | null>>({});
  const [friendUnread, setFriendUnread] = useState<Record<string, number>>({});
  const [friendMessages, setFriendMessages] = useState<DbMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sendingMedia, setSendingMedia] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const messagesScrollRef = useRef<ScrollView>(null);
  const restingComposerOffset = insets.bottom + 16;
  const composerOffset = useRef(new Animated.Value(restingComposerOffset)).current;

  const activeFriend = activeChat?.kind === 'friend' ? friends.find((f) => f.id === activeChat.id) : undefined;
  const selectedGroup = activeChat?.kind === 'group' ? chats.find((c) => c.id === activeChat.id) : undefined;

  // One shared player for every voice bubble in the thread — swapping its
  // source on tap instead of mounting a player per bubble.
  const voicePlayer = useAudioPlayer();
  const voicePlayerStatus = useAudioPlayerStatus(voicePlayer);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  useEffect(() => {
    if (voicePlayerStatus.didJustFinish) setPlayingMessageId(null);
  }, [voicePlayerStatus.didJustFinish]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }).catch(() => {});
  }, []);

  async function toggleVoicePlayback(messageId: string, mediaPath: string) {
    light();
    if (playingMessageId === messageId) {
      voicePlayer.pause();
      setPlayingMessageId(null);
      return;
    }
    const url = await getSignedMediaUrl(mediaPath);
    if (!url) return;
    voicePlayer.replace({ uri: url });
    voicePlayer.play();
    setPlayingMessageId(messageId);
  }

  async function startRecording() {
    if (!activeFriend || sendingMedia) return;
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) return;
    light();
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  }

  async function stopRecordingAndSend() {
    if (!user || !activeFriend) return;
    light();
    const durationMs = Math.round(audioRecorder.currentTime * 1000);
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    if (!uri || durationMs < 500) return;

    setSendingMedia(true);
    const sent = await sendMediaMessage(user.id, activeFriend.id, uri, 'audio', '.m4a', 'audio/m4a', durationMs);
    setSendingMedia(false);
    if (sent) {
      setFriendMessages((current) => [...current, sent]);
      setFriendLast((current) => ({ ...current, [activeFriend.id]: sent }));
    }
  }

  async function pickAndSendImage() {
    if (!user || !activeFriend || sendingMedia) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const { extension, contentType } = extensionAndTypeForImage(asset);

    light();
    setSendingMedia(true);
    const sent = await sendMediaMessage(user.id, activeFriend.id, asset.uri, 'image', extension, contentType);
    setSendingMedia(false);
    if (sent) {
      setFriendMessages((current) => [...current, sent]);
      setFriendLast((current) => ({ ...current, [activeFriend.id]: sent }));
    }
  }

  // Load your mutual friends + their last message and unread count, for the
  // "PRIETENI" section of the list screen.
  useEffect(() => {
    if (!user) return;
    getMutualFriends(user.id).then(async (list) => {
      setFriends(list);
      const [lastMessages, unreadCounts] = await Promise.all([
        Promise.all(list.map((f) => getLastMessage(user.id, f.id))),
        Promise.all(list.map((f) => getUnreadCount(user.id, f.id))),
      ]);
      const lastMap: Record<string, DbMessage | null> = {};
      const unreadMap: Record<string, number> = {};
      list.forEach((f, i) => {
        lastMap[f.id] = lastMessages[i];
        unreadMap[f.id] = unreadCounts[i];
      });
      setFriendLast(lastMap);
      setFriendUnread(unreadMap);
    });
  }, [user]);

  // Load the full thread whenever a friend conversation is opened, and clear
  // their unread badge — mirrors the "opening a chat marks it read" behavior
  // the rest of the list is showing via the read-receipt ticks.
  useEffect(() => {
    if (!user || activeChat?.kind !== 'friend') return;
    const friendId = activeChat.id;
    getThread(user.id, friendId).then(setFriendMessages);
    markThreadRead(user.id, friendId).then(() => {
      setFriendUnread((prev) => ({ ...prev, [friendId]: 0 }));
    });
  }, [user, activeChat]);

  // Live-append messages that land while a friend thread is open. Subscribed
  // once per user, not per activeChat — the channel topic is keyed only on
  // the user's id, so re-subscribing on every open/close of a thread just
  // churned the same Realtime topic and could drop delivery. activeChat is
  // read from a ref so the callback still sees whichever thread is current.
  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;

  useEffect(() => {
    if (!user) return;
    return subscribeToIncoming(user.id, (message) => {
      const current = activeChatRef.current;
      const isOpenThread = current?.kind === 'friend' && message.sender_id === current.id;
      if (isOpenThread) {
        setFriendMessages((prev) => [...prev, message]);
        markThreadRead(user.id, message.sender_id);
      } else {
        setFriendUnread((prev) => ({ ...prev, [message.sender_id]: (prev[message.sender_id] ?? 0) + 1 }));
      }
      setFriendLast((prev) => ({ ...prev, [message.sender_id]: message }));
    });
  }, [user]);

  // Flips a sent message's tick from single- to double-check the moment the
  // recipient reads it, instead of only after the thread list next reloads.
  useEffect(() => {
    if (!user) return;
    return subscribeToReadReceipts(user.id, (message) => {
      setFriendMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
      setFriendLast((prev) =>
        prev[message.recipient_id]?.id === message.id ? { ...prev, [message.recipient_id]: message } : prev
      );
    });
  }, [user]);

  const displayedMessages: DisplayMessage[] = useMemo(() => {
    if (activeChat?.kind === 'group') return groupMessages;
    if (activeChat?.kind === 'friend' && user) {
      return friendMessages.map((m) => ({
        id: m.id,
        text: m.text,
        time: formatTime(m.created_at),
        sender: m.sender_id === user.id ? 'Tu' : activeFriend?.name ?? '',
        mine: m.sender_id === user.id,
        read: !!m.read_at,
        mediaType: m.media_type,
        mediaPath: m.media_path,
        durationMs: m.duration_ms,
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
      setGroupMessages((current) => [...current, { id: String(Date.now()), sender: 'Tu', text, time: 'Acum', mine: true, read: false }]);
      return;
    }

    if (!user) return;
    const sent = await sendDirectMessage(user.id, activeChat.id, text);
    if (sent) {
      setFriendMessages((current) => [...current, sent]);
      setFriendLast((current) => ({ ...current, [activeChat.id]: sent }));
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
              <View style={styles.listSection}>
                {chats.map((chat) => (
                  <ChatListRow
                    key={chat.id}
                    avatarNode={<Text style={styles.avatarEmoji}>{chat.emoji}</Text>}
                    avatarColor={chat.color}
                    name={chat.title}
                    timestamp={chat.time}
                    preview={chat.detail}
                    mine={false}
                    read={false}
                    unreadCount={0}
                    onPress={() => {
                      light();
                      setHidden(true);
                      setActiveChat({ kind: 'group', id: chat.id });
                    }}
                  />
                ))}
              </View>

              {friends.length > 0 && (
                <View style={styles.friendsSection}>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PRIETENI</Text>
                  {friends.map((friend) => {
                    const last = friendLast[friend.id];
                    const mine = !!last && !!user && last.sender_id === user.id;
                    return (
                      <ChatListRow
                        key={friend.id}
                        avatarNode={
                          <Text style={[styles.friendAvatarLetter, { color: theme.textPrimary }]}>
                            {friend.name.trim().charAt(0).toUpperCase() || '?'}
                          </Text>
                        }
                        avatarColor={theme.surfaceMuted}
                        name={friend.name}
                        timestamp={last ? formatListTimestamp(last.created_at) : null}
                        preview={last ? messagePreview(last) : 'Trimite un mesaj'}
                        mine={mine}
                        read={mine && !!last?.read_at}
                        unreadCount={friendUnread[friend.id] ?? 0}
                        onPress={() => {
                          light();
                          setHidden(true);
                          setActiveChat({ kind: 'friend', id: friend.id });
                        }}
                      />
                    );
                  })}
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
                    {message.mediaType === 'image' && message.mediaPath ? (
                      <ImageBubble path={message.mediaPath} />
                    ) : message.mediaType === 'audio' && message.mediaPath ? (
                      <VoiceBubble
                        isPlaying={playingMessageId === message.id}
                        isMine={message.mine}
                        durationMs={message.durationMs}
                        onToggle={() => toggleVoicePlayback(message.id, message.mediaPath!)}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.messageText,
                          message.mine ? styles.messageTextMine : { color: theme.textPrimary },
                        ]}
                      >
                        {message.text}
                      </Text>
                    )}
                    <View style={styles.bubbleFooter}>
                      <Text style={[styles.time, message.mine ? styles.timeMine : { color: theme.textSecondary }]}>
                        {message.time}
                      </Text>
                      {message.mine && (
                        <Ionicons
                          name={message.read ? 'checkmark-done' : 'checkmark'}
                          size={13}
                          color={message.read ? colors.white : 'rgba(255,255,255,0.7)'}
                        />
                      )}
                    </View>
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
              <Pressable
                onPress={pickAndSendImage}
                disabled={sendingMedia || recorderState.isRecording}
                style={[styles.add, { backgroundColor: theme.surfaceMuted, opacity: sendingMedia ? 0.5 : 1 }]}
                accessibilityLabel="Trimite o poză"
              >
                <Text style={[styles.addText, { color: theme.accent }]}>+</Text>
              </Pressable>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={sendMessage}
                placeholder={recorderState.isRecording ? `Se înregistrează... ${formatDuration(recorderState.durationMillis)}` : 'Scrie un mesaj...'}
                placeholderTextColor={recorderState.isRecording ? colors.green500 : theme.textSecondary}
                editable={!recorderState.isRecording}
                style={[styles.input, { color: theme.textPrimary }]}
                returnKeyType="send"
              />
              <Pressable
                onPress={recorderState.isRecording ? stopRecordingAndSend : startRecording}
                disabled={sendingMedia}
                style={[styles.voice, recorderState.isRecording && styles.voiceActive, { opacity: sendingMedia ? 0.5 : 1 }]}
                accessibilityLabel={recorderState.isRecording ? 'Oprește și trimite mesajul vocal' : 'Înregistrează mesaj vocal'}
              >
                <Ionicons name={recorderState.isRecording ? 'stop' : 'mic'} size={20} color={colors.white} />
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
  listSection: { paddingHorizontal: 18, paddingTop: 10 },
  friendsSection: { paddingHorizontal: 18, paddingTop: 22 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 6 },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  chatAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 22 },
  friendAvatarLetter: { fontSize: 18, fontWeight: '800' },
  chatBody: { flex: 1 },
  chatTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { fontSize: 15, fontWeight: '700', flexShrink: 1, marginRight: 8 },
  chatTime: { fontSize: 11, fontWeight: '700' },
  chatBottomLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  chatPreviewRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  chatTick: { marginRight: 3 },
  chatPreview: { fontSize: 13, flexShrink: 1 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
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
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  time: { fontSize: 9, textAlign: 'right' },
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
  voiceActive: { backgroundColor: '#E5484D' },
  imageBubble: { width: 200, height: 200, borderRadius: 14 },
  imageBubbleLoading: { alignItems: 'center', justifyContent: 'center' },
  voiceBubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, minWidth: 160 },
  voiceWave: { flex: 1, height: 3, borderRadius: 2 },
  voiceDuration: { fontSize: 12, fontWeight: '700' },
});
