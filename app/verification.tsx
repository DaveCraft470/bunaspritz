import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { useAppTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { colors } from '@/constants/theme';

// The buletin/ID step was dropped — real ID capture needs OCR/liveness
// checks that are out of scope for now, so signup only asks for a face
// photo before handing off to the app.
export default function Verification() {
  const { colors: theme } = useAppTheme();
  const { completeVerification } = useUser();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  const [faceImage, setFaceImage] = useState<string | null>(null);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permisiune necesară',
        'Permite accesul la fotografii pentru a continua.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const uri = result.assets[0]?.uri;
    if (uri) {
      setFaceImage(uri);
    }
  };

  const continueStep = async () => {
    if (!faceImage) {
      await pickImage();
      return;
    }

    await completeVerification();
    router.replace((returnTo as any) || '/');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Verificare</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Verificarea vârstei 18+</Text>
          </View>

          <View style={styles.placeholder} />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.mainIcon, { backgroundColor: 'rgba(34,197,94,0.10)' }]}>
            <Ionicons name="scan-outline" size={46} color={colors.green500} />
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>Verificare facială</Text>

          <Text style={[styles.description, { color: theme.textSecondary }]}>
            Fă o fotografie a feței pentru verificarea identității.
          </Text>

          {faceImage && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: faceImage }} style={styles.facePreview} resizeMode="cover" />

              <Pressable
                onPress={pickImage}
                style={[styles.changeImageButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
              >
                <Ionicons name="camera-outline" size={18} color={colors.green500} />
                <Text style={[styles.changeImageText, { color: theme.textPrimary }]}>Schimbă fotografia</Text>
              </Pressable>
            </View>
          )}

          <View style={[styles.infoBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <Ionicons name="shield-checkmark-outline" size={21} color={colors.green500} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              Datele de verificare vor fi procesate securizat de serviciul de verificare.
            </Text>
          </View>

          <Pressable
            onPress={continueStep}
            style={({ pressed }) => [
              styles.continueButton,
              { backgroundColor: colors.green500, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={styles.continueText}>
              {faceImage ? 'Intră în aplicație' : 'Adaugă fotografia'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.security}>
          <Ionicons name="lock-closed-outline" size={16} color={theme.textSecondary} />
          <Text style={[styles.securityText, { color: theme.textSecondary }]}>
            Verificarea este necesară pentru accesul la funcțiile 18+.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 25,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
  },

  headerSubtitle: {
    fontSize: 11,
    marginTop: 3,
  },

  placeholder: {
    width: 42,
  },

  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },

  mainIcon: {
    width: 94,
    height: 94,
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },

  description: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 380,
    marginTop: 8,
    marginBottom: 22,
  },

  previewContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 22,
  },

  facePreview: {
    width: 180,
    height: 180,
    borderRadius: 90,
  },

  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },

  changeImageText: {
    fontSize: 12,
    fontWeight: '700',
  },

  infoBox: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  },

  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },

  continueButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  continueText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },

  security: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 22,
    paddingHorizontal: 20,
  },

  securityText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 15,
    flex: 1,
  },
});
