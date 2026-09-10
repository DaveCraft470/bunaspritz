import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/ThemeContext';
import { useLanguage, type Language } from '@/contexts/LanguageContext';

// See app/terms.tsx for why this long static legal copy lives locally
// instead of in lib/i18n/{ro,en}.ts.
//
// DRAFT — NOT REVIEWED BY A LAWYER. Replace every [PLACEHOLDER] and have
// counsel confirm this actually matches what the app does (categories of
// data, processors, retention) before shipping to real users — this draft
// is written to match the current codebase (Supabase for auth/data/storage,
// Didit for KYC, Expo push notifications) but code and data flows change
// faster than this document will.
const content: Record<Language, { title: string; updated: string; intro: string; sections: { heading: string; body: string }[] }> = {
  ro: {
    title: 'Politica de confidențialitate',
    updated: 'Ultima actualizare: [DATA]',
    intro:
      'Această Politică de confidențialitate explică ce date colectăm prin aplicația Spritz ("Aplicația"), de ce le colectăm și ce drepturi ai. Operator de date: [NUME COMPANIE / PFA], [ADRESĂ], [CUI/CIF], contact: [EMAIL DE CONTACT] ("noi", "Spritz").',
    sections: [
      {
        heading: '1. Ce date colectăm',
        body:
          '• Date de cont: nume, username, adresă de email, parolă (stocată criptat).\n' +
          '• Date de profil: fotografie de profil, bio, opțional Instagram.\n' +
          '• Date de verificare a identității (KYC): atunci când alegi să te verifici pentru a găzdui evenimente, documentul de identitate și un selfie live sunt trimise direct furnizorului nostru de verificare, Didit, care acționează ca persoană împuternicită (procesator) în numele nostru. Noi nu stocăm și nu avem acces la imaginile documentului sau ale selfie-ului — primim doar rezultatul (verificat / neverificat).\n' +
          '• Date despre evenimente: evenimentele pe care le creezi, la care participi, pe care le salvezi sau le apreciezi.\n' +
          '• Conținut generat de tine: mesaje, povești (stories), recenzii, fotografii încărcate.\n' +
          '• Date sociale: prieteni, cereri de prietenie, urmăriri.\n' +
          '• Locație: doar dacă acorzi permisiunea aplicației, pentru a-ți arăta evenimente din apropiere.\n' +
          '• Date tehnice: tip de dispozitiv, identificator push notification, jurnale de erori/utilizare de bază.',
      },
      {
        heading: '2. De ce colectăm aceste date (scopuri)',
        body:
          'Folosim datele pentru a: furniza și opera funcționalitățile Aplicației (creare cont, publicare/participare la evenimente, mesagerie); confirma că ai vârsta minimă necesară și, pentru găzduire, că identitatea a fost verificată; menține siguranța și integritatea platformei (moderare, prevenirea fraudei); trimite notificări legate de activitatea ta (dacă le-ai activat); îmbunătăți Aplicația pe baza utilizării agregate.',
      },
      {
        heading: '3. Temei legal al prelucrării',
        body:
          'Prelucrăm datele în baza: executării contractului dintre tine și noi (Termenii și condițiile), atunci când folosești funcționalitățile de bază ale Aplicației; consimțământului tău, pentru verificarea de identitate și pentru notificările push, pe care le poți retrage oricând din setări; intereselor noastre legitime, pentru prevenirea fraudei și menținerea siguranței platformei; unei obligații legale, atunci când este cazul.',
      },
      {
        heading: '4. Cu cine partajăm datele (subprocesatori)',
        body:
          'Nu vindem datele tale. Le partajăm doar cu furnizori care ne ajută să operăm Aplicația, sub obligații contractuale de confidențialitate: Supabase (bază de date, autentificare și stocare fișiere), Didit (verificare de identitate/KYC), Expo/Apple/Google (livrarea notificărilor push), și, dacă e cazul, furnizori de hosting/infrastructură. Aceștia pot procesa date în afara României; unde este cazul, ne bazăm pe clauze contractuale standard sau mecanisme echivalente de transfer.',
      },
      {
        heading: '5. Cât timp păstrăm datele',
        body:
          'Păstrăm datele contului tău cât timp contul este activ. Dacă îți ștergi contul, datele de profil și conținutul asociat sunt șterse sau anonimizate, cu excepția cazurilor în care legea ne obligă să păstrăm anumite date (de exemplu, evidențe contabile) pentru o perioadă mai lungă. Rezultatul verificării de identitate (statutul "verificat") este păstrat cât timp ai cont; documentele trimise către Didit sunt guvernate de politica proprie de retenție a Didit ca procesator.',
      },
      {
        heading: '6. Drepturile tale',
        body:
          'Conform GDPR, ai dreptul de a: solicita acces la datele tale; solicita rectificarea datelor incorecte; solicita ștergerea datelor ("dreptul de a fi uitat"); solicita restricționarea prelucrării; te opune anumitor prelucrări bazate pe interes legitim; solicita portabilitatea datelor; retrage oricând consimțământul, fără a afecta legalitatea prelucrării anterioare; depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP) sau la autoritatea echivalentă din țara ta. Poți exercita majoritatea acestor drepturi direct din Setările Aplicației (editare profil, ștergere cont) sau contactându-ne la [EMAIL DE CONTACT].',
      },
      {
        heading: '7. Securitate',
        body:
          'Luăm măsuri tehnice și organizatorice rezonabile pentru a proteja datele tale (criptare în tranzit, control al accesului, restricții la nivel de bază de date). Nicio metodă de transmitere sau stocare electronică nu este însă 100% sigură și nu putem garanta securitatea absolută a datelor.',
      },
      {
        heading: '8. Minori',
        body:
          'Aplicația nu este destinată persoanelor sub 18 ani și nu colectăm cu bună știință date de la acestea. Dacă aflăm că un cont aparține unei persoane sub 18 ani, îl vom dezactiva.',
      },
      {
        heading: '9. Modificări ale acestei politici',
        body: 'Putem actualiza această politică periodic. Te vom anunța despre modificări semnificative prin Aplicație.',
      },
      {
        heading: '10. Contact',
        body: 'Pentru orice întrebare despre această politică sau despre datele tale, scrie-ne la [EMAIL DE CONTACT].',
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: [DATE]',
    intro:
      'This Privacy Policy explains what data we collect through the Spritz app ("App"), why we collect it, and what rights you have. Data controller: [COMPANY NAME], [ADDRESS], [REGISTRATION NUMBER], contact: [CONTACT EMAIL] ("we", "Spritz").',
    sections: [
      {
        heading: '1. What data we collect',
        body:
          '• Account data: name, username, email address, password (stored encrypted).\n' +
          '• Profile data: profile photo, bio, optional Instagram handle.\n' +
          '• Identity verification (KYC) data: when you choose to verify in order to host events, your ID document and a live selfie are sent directly to our verification provider, Didit, which acts as our processor. We do not store and do not have access to the document or selfie images — we only receive the result (verified / not verified).\n' +
          '• Event data: events you create, join, save, or favorite.\n' +
          '• User-generated content: messages, stories, reviews, uploaded photos.\n' +
          '• Social data: friends, friend requests, follows.\n' +
          '• Location: only if you grant the App permission, to show you nearby events.\n' +
          '• Technical data: device type, push notification token, basic usage/error logs.',
      },
      {
        heading: '2. Why we collect it (purposes)',
        body:
          'We use your data to: provide and operate the App\'s features (account creation, publishing/joining events, messaging); confirm you meet the minimum age requirement and, for hosting, that your identity was verified; maintain platform safety and integrity (moderation, fraud prevention); send notifications about your activity (if you enabled them); improve the App based on aggregated usage.',
      },
      {
        heading: '3. Legal basis for processing',
        body:
          'We process your data based on: performance of the contract between you and us (the Terms & Conditions), for the App\'s core features; your consent, for identity verification and for push notifications, which you can withdraw at any time in settings; our legitimate interests, for fraud prevention and platform safety; a legal obligation, where applicable.',
      },
      {
        heading: '4. Who we share data with (processors)',
        body:
          'We do not sell your data. We share it only with providers who help us operate the App, under contractual confidentiality obligations: Supabase (database, authentication, and file storage), Didit (identity/KYC verification), Expo/Apple/Google (push notification delivery), and, where applicable, hosting/infrastructure providers. These providers may process data outside Romania; where relevant, we rely on standard contractual clauses or equivalent transfer mechanisms.',
      },
      {
        heading: '5. How long we keep data',
        body:
          'We keep your account data for as long as your account is active. If you delete your account, your profile data and associated content are deleted or anonymized, except where the law requires us to retain certain data (e.g. accounting records) for longer. Your verification status ("verified") is kept for as long as you have an account; documents submitted to Didit are governed by Didit\'s own retention policy as our processor.',
      },
      {
        heading: '6. Your rights',
        body:
          'Under GDPR, you have the right to: request access to your data; request correction of inaccurate data; request deletion ("right to be forgotten"); request restriction of processing; object to certain processing based on legitimate interest; request data portability; withdraw consent at any time, without affecting the lawfulness of earlier processing; and lodge a complaint with your national data protection authority (in Romania, ANSPDCP) or the equivalent authority in your country. You can exercise most of these rights directly from the App\'s Settings (edit profile, delete account) or by contacting us at [CONTACT EMAIL].',
      },
      {
        heading: '7. Security',
        body:
          'We take reasonable technical and organizational measures to protect your data (encryption in transit, access controls, database-level restrictions). No method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security of your data.',
      },
      {
        heading: '8. Minors',
        body:
          'The App is not intended for people under 18, and we do not knowingly collect data from them. If we learn that an account belongs to someone under 18, we will disable it.',
      },
      {
        heading: '9. Changes to this policy',
        body: 'We may update this policy from time to time. We will notify you of significant changes through the App.',
      },
      {
        heading: '10. Contact',
        body: 'For any question about this policy or your data, write to us at [CONTACT EMAIL].',
      },
    ],
  },
};

export default function Privacy() {
  const { colors: theme } = useAppTheme();
  const { language } = useLanguage();
  const copy = content[language];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{copy.title}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.updated, { color: theme.textSecondary }]}>{copy.updated}</Text>
        <Text style={[styles.intro, { color: theme.textSecondary }]}>{copy.intro}</Text>
        {copy.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>{section.heading}</Text>
            <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  backButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  placeholder: { width: 42 },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  updated: { fontSize: 11, fontWeight: '700', marginBottom: 10 },
  intro: { fontSize: 13, lineHeight: 20, marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionHeading: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  sectionBody: { fontSize: 13, lineHeight: 20 },
});
