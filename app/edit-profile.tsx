import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';

const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/i;

export default function EditProfile() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user, updateProfile } = useUser();

  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    const result = await updateProfile({ name: name.trim(), username: username.trim(), bio: bio.trim() });
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

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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

            {error && <Text style={styles.errorText}>{error}</Text>}

            <AnimatedPressable
              onPress={handleSave}
              style={[styles.saveButton, { backgroundColor: colors.green500, opacity: saving ? 0.8 : 1 }]}
            >
              <Text style={styles.saveText}>Salvează</Text>
              <Ionicons name="checkmark" size={20} color={colors.white} />
            </AnimatedPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
