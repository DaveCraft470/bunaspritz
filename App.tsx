import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Message = { id: string; text: string; time: string; mine?: boolean };

const chats = [
  { id: 'brasov', title: 'Brașov azi', detail: '12 persoane active', emoji: '⛰️', color: '#E8A15B' },
  { id: 'gasca', title: 'Gașca de sâmbătă', detail: 'Vlad: Ne vedem la 8?', emoji: '🍹', color: '#DB6B5B' },
  { id: 'poiana', title: 'Poiana Brașov', detail: 'Ioana: Vin și eu!', emoji: '❄️', color: '#7AA6D6' },
];

const starterMessages: Message[] = [
  { id: '1', text: 'Ce faceți diseară? ✨', time: '18:41' },
  { id: '2', text: 'Mergem la un spriț în centru?', time: '18:42' },
  { id: '3', text: 'Eu sunt pentru! Unde ne vedem?', time: '18:43', mine: true },
  { id: '4', text: 'La Republicii, pe la 20:00?', time: '18:44' },
];

export default function App() {
  const [activeChat, setActiveChat] = useState('brasov');
  const [messages, setMessages] = useState(starterMessages);
  const [draft, setDraft] = useState('');
  const selectedChat = chats.find((chat) => chat.id === activeChat) ?? chats[0];

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: String(Date.now()), text, time: 'Acum', mine: true }]);
    setDraft('');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>BUNĂ, ANDREI</Text>
            <Text style={styles.title}>Mesaje</Text>
          </View>
          <Pressable style={styles.roundButton}><Text style={styles.roundButtonText}>+</Text></Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chatList}>
          {chats.map((chat) => (
            <Pressable key={chat.id} onPress={() => setActiveChat(chat.id)} style={[styles.chatCard, chat.id === activeChat && styles.chatCardActive]}>
              <View style={[styles.avatar, { backgroundColor: chat.color }]}><Text style={styles.emoji}>{chat.emoji}</Text></View>
              <View style={styles.chatCopy}>
                <Text numberOfLines={1} style={styles.chatTitle}>{chat.title}</Text>
                <Text numberOfLines={1} style={styles.chatDetail}>{chat.detail}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.chatHeader}>
          <View style={[styles.avatar, { backgroundColor: selectedChat.color }]}><Text style={styles.emoji}>{selectedChat.emoji}</Text></View>
          <View><Text style={styles.headerTitle}>{selectedChat.title}</Text><Text style={styles.online}>● activi acum în Brașov</Text></View>
          <Text style={styles.more}>•••</Text>
        </View>

        <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
          <Text style={styles.today}>ASTĂZI</Text>
          {messages.map((message) => (
            <View key={message.id} style={[styles.messageRow, message.mine && styles.messageRowMine]}>
              {!message.mine && <View style={styles.dot} />}
              <View style={[styles.bubble, message.mine ? styles.mine : styles.other]}>
                <Text style={[styles.messageText, message.mine && styles.messageTextMine]}>{message.text}</Text>
                <Text style={[styles.time, message.mine && styles.timeMine]}>{message.time}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <View style={styles.add}><Text style={styles.addText}>+</Text></View>
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={sendMessage} placeholder="Scrie un mesaj..." placeholderTextColor="#9D9A98" style={styles.input} returnKeyType="send" />
          <Pressable onPress={sendMessage} style={[styles.send, !draft.trim() && styles.sendOff]}><Text style={styles.sendText}>↑</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCF9F6' },
  page: { flex: 1, backgroundColor: '#FCF9F6' },
  topBar: { paddingHorizontal: 22, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: '#9C5E3C', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#272321', fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  roundButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#272321', alignItems: 'center', justifyContent: 'center' },
  roundButtonText: { color: '#FFF9F2', fontSize: 28, fontWeight: '300', marginTop: -2 },
  chatList: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 20, gap: 10 },
  chatCard: { width: 190, padding: 10, borderRadius: 18, backgroundColor: '#F4EEE8', flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: 'transparent' },
  chatCardActive: { backgroundColor: '#FFFDFB', borderColor: '#E5C6AF' },
  avatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20 },
  chatCopy: { flex: 1 },
  chatTitle: { color: '#302B28', fontSize: 13, fontWeight: '800' },
  chatDetail: { color: '#817975', fontSize: 11, marginTop: 3 },
  chatHeader: { marginHorizontal: 22, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EDE4DD', flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#302B28', fontSize: 16, fontWeight: '800' },
  online: { color: '#6F9A75', fontSize: 11, marginTop: 3, fontWeight: '600' },
  more: { marginLeft: 'auto', color: '#645D59', fontSize: 18, letterSpacing: 1 },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 16, gap: 12 },
  today: { color: '#A49A93', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, alignSelf: 'center', marginBottom: 4 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  messageRowMine: { justifyContent: 'flex-end' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E8A15B', marginBottom: 12 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8 },
  other: { backgroundColor: '#F0E9E3', borderRadius: 18, borderBottomLeftRadius: 5 },
  mine: { backgroundColor: '#B8533F', borderRadius: 18, borderBottomRightRadius: 5 },
  messageText: { color: '#342E2B', fontSize: 15, lineHeight: 20, fontWeight: '500' },
  messageTextMine: { color: '#FFF9F4' },
  time: { color: '#958A84', fontSize: 9, textAlign: 'right', marginTop: 4 },
  timeMine: { color: '#F5C7BC' },
  composer: { marginHorizontal: 16, marginBottom: 14, paddingVertical: 7, paddingHorizontal: 7, borderRadius: 22, backgroundColor: '#FFFDFB', borderWidth: 1, borderColor: '#E9DED7', flexDirection: 'row', alignItems: 'center', gap: 7 },
  add: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F2E8E1', alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#92583A', fontSize: 25, fontWeight: '300', marginTop: -2 },
  input: { flex: 1, color: '#302B28', fontSize: 15, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#B8533F', alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: '#D8CBC4' },
  sendText: { color: '#FFF9F4', fontSize: 22, fontWeight: '700', marginTop: -4 },
});
