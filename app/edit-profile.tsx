import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { GlassSurface } from '@/components/common/GlassSurface';
import { extensionAndTypeForImage } from '@/lib/media';

const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/i;

export default function EditProfile() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user, updateProfile, uploadAvatar } = useUser();

  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [instagramHandle, setInstagramHandle] = useState(user?.instagramHandle ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function handlePickAvatar() {
    if (uploadingAvatar) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const { extension, contentType } = extensionAndTypeForImage(asset);

    light();
    setUploadingAvatar(true);
    const uploadResult = await uploadAvatar(asset.uri, extension, contentType);
    setUploadingAvatar(false);

    if (!uploadResult.ok) {
      setError(uploadResult.error);
    }
  }

  async function handleSave() {
    if (saving) return;
    setError(null);

    if (!name.trim()) {
      setError('Introdu numele tău.');
      return;
    }
    if (!USERNAME_REGEX.test(username.trim())) {
      setError('Username: 3-20 caractere, doar litere, cifre, "." sau "_".');
      return;
    }

    setSaving(true);
    const result = await updateProfile({
      name: name.trim(),
      username: username.trim(),
      bio: bio.trim(),
      instagramHandle,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    light();
    router.back();
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
        <Text style={[styles.title, { color: theme.textPrimary }]}>Editează profilul</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 0}
        keyboardOpeningTime={0}
      >
          <View style={styles.avatarSection}>
            <AnimatedPressable onPress={handlePickAvatar} style={styles.avatarPressable}>
              <Avatar
                uri={user?.avatarUrl}
                name={name || 'U'}
                size={92}
                fontSize={38}
                color={colors.green500}
                style={[styles.avatarImage, { borderColor: theme.surface }]}
              />
              <View style={[styles.avatarBadge, { borderColor: theme.surface }]}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="camera" size={16} color={colors.white} />
                )}
              </View>
            </AnimatedPressable>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>Nume</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                <Ionicons name="person-outline" size={19} color={theme.textSecondary} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Numele tău"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.textPrimary }]}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>Username</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                <Ionicons name="at-outline" size={19} color={theme.textSecondary} />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="username"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.textPrimary }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>Descriere</Text>
              <View
                style={[
                  styles.inputWrapper,
                  styles.bioWrapper,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}
              >
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Câteva cuvinte despre tine"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, styles.bioInput, { color: theme.textPrimary }]}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>Instagram</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                <Ionicons name="logo-instagram" size={19} color={theme.textSecondary} />
                <TextInput
                  value={instagramHandle}
                  onChangeText={setInstagramHandle}
                  placeholder="username (opțional)"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.textPrimary }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <AnimatedPressable
              onPress={handleSave}
              style={[styles.saveButton, { backgroundColor: colors.green500, opacity: saving ? 0.8 : 1 }]}
            >
              <Text style={styles.saveText}>Salvează</Text>
              <Ionicons name="checkmark" size={20} color={colors.white} />
            </AnimatedPressable>
          </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
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

  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },

  avatarSection: { alignItems: 'center', marginBottom: spacing.lg },
  avatarPressable: { position: 'relative' },
  avatarImage: { borderWidth: 3 },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },

  inputGroup: {
    marginBottom: 15,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },

  inputWrapper: {
    minHeight: 52,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  bioWrapper: {
    minHeight: 90,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },

  input: {
    flex: 1,
    fontSize: 14,
    minHeight: 50,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },

  bioInput: {
    minHeight: 66,
    textAlignVertical: 'top',
  },

  errorText: {
    color: '#E5484D',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },

  saveButton: {
    minHeight: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 5,
  },

  saveText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});
