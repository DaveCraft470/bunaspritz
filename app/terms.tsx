import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/ThemeContext';
import { useLanguage, type Language } from '@/contexts/LanguageContext';

// Legal copy lives locally (not in lib/i18n/{ro,en}.ts, which is "source of
// truth for all app copy") because it's long, static, drafted-by-an-AI
// boilerplate rather than product copy — bundling it into the shared
// translation dictionaries would double their size for text nobody
// iterates on the same way. See app/privacy.tsx for the same choice.
//
// DRAFT — NOT REVIEWED BY A LAWYER. Replace every [PLACEHOLDER] before this
// app is submitted to an app store or used by real users, and have counsel
// review it for the jurisdictions you actually operate in. A "we're not
// responsible for anything" clause is not fully enforceable under Romanian/
// EU consumer-protection law (e.g. it can't disclaim death, personal
// injury, or willful misconduct) — this draft disclaims as broadly as the
// law allows rather than claiming blanket immunity, which is what would
// actually hold up and also what app store review expects to see.
const content: Record<Language, { title: string; updated: string; intro: string; sections: { heading: string; body: string }[] }> = {
  ro: {
    title: 'Termeni și condiții',
    updated: 'Ultima actualizare: [DATA]',
    intro:
      'Acești Termeni și condiții ("Termenii") guvernează utilizarea aplicației Spritz ("Aplicația", "Serviciul"), operată de [NUME COMPANIE / PFA], [ADRESĂ], [CUI/CIF] ("noi", "Spritz"). Prin crearea unui cont sau utilizarea Aplicației, confirmi că ai citit, ai înțeles și ești de acord cu acești Termeni. Dacă nu ești de acord, nu utiliza Aplicația.',
    sections: [
      {
        heading: '1. Ce este Spritz',
        body:
          'Spritz este o platformă care permite utilizatorilor să descopere, să publice și să se alăture unor întâlniri și evenimente organizate de alți utilizatori ("evenimente"). Spritz este exclusiv un intermediar tehnic — nu organizăm, nu deținem, nu operăm, nu supraveghem și nu suntem parte la niciun eveniment publicat prin Aplicație. Fiecare eveniment este creat și găzduit de un utilizator independent ("Organizator"), pe propria răspundere.',
      },
      {
        heading: '2. Eligibilitate și cont',
        body:
          'Aplicația este destinată exclusiv persoanelor cu vârsta de minimum 18 ani. Prin crearea unui cont declari pe propria răspundere că ai cel puțin 18 ani. Ești responsabil pentru confidențialitatea datelor contului tău și pentru orice activitate desfășurată prin el. Ne rezervăm dreptul de a suspenda sau șterge orice cont, oricând, cu sau fără notificare prealabilă, dacă suspectăm încălcarea acestor Termeni sau a legii.',
      },
      {
        heading: '3. Verificarea identității (KYC)',
        body:
          'Găzduirea unui eveniment necesită verificarea identității și a vârstei printr-un furnizor terț de verificare (Didit). Această verificare confirmă doar că documentul prezentat pare valid și că persoana din selfie-ul live corespunde documentului, conform proceselor furnizorului — nu constituie o garanție absolută a identității reale, a intențiilor sau a bunei-credințe a niciunui utilizator, verificat sau nu. Spritz nu efectuează verificări suplimentare de antecedente și nu garantează siguranța niciunui Organizator, participant sau eveniment.',
      },
      {
        heading: '4. Conținutul utilizatorilor',
        body:
          'Ești singurul responsabil pentru orice conținut publici (titluri de evenimente, descrieri, fotografii, mesaje, povești, recenzii etc.). Prin publicarea de conținut, ne acorzi o licență neexclusivă, gratuită, la nivel mondial, de a-l afișa în Aplicație în scopul funcționării Serviciului. Este interzisă publicarea de conținut ilegal, care încalcă drepturi ale unor terți, care incită la violență, discriminare, ură, sau care implică minori, substanțe interzise, arme sau activități ilegale.',
      },
      {
        heading: '5. Întâlniri în lumea reală — riscuri asumate',
        body:
          'Evenimentele publicate prin Spritz implică întâlniri fizice, în lumea reală, între persoane care nu se cunosc neapărat. PARTICIPI PE PROPRIA RĂSPUNDERE. Nu verificăm locațiile, siguranța acestora, autorizațiile organizatorului pentru spațiul folosit, calitatea produselor/serviciilor oferite la eveniment sau comportamentul niciunui participant. Îți recomandăm să iei propriile măsuri de precauție: informează pe cineva unde mergi, întâlnește-te în spații publice, nu accepta băuturi/produse din surse necunoscute. Spritz nu are nicio obligație de supraveghere sau de a interveni la fața locului.',
      },
      {
        heading: '6. Fără garanții',
        body:
          'Aplicația este furnizată "ca atare" ("as is") și "după disponibilitate" ("as available"), fără nicio garanție de niciun fel, expresă sau implicită, inclusiv, dar fără a se limita la, garanții de vandabilitate, adecvare pentru un anumit scop, neîncălcare, acuratețe, disponibilitate neîntreruptă sau lipsă de erori. Nu garantăm că un eveniment publicat va avea loc, se va desfășura conform descrierii, sau că un Organizator ori participant se va comporta conform așteptărilor.',
      },
      {
        heading: '7. Limitarea răspunderii',
        body:
          'În limita maximă permisă de legea aplicabilă, Spritz, administratorii, angajații și colaboratorii săi nu răspund pentru niciun prejudiciu direct, indirect, incidental, special, punitiv sau pe cale de consecință — inclusiv, dar fără a se limita la, vătămări corporale, deces, pierderi materiale, pierderi financiare, furt, agresiune, hărțuire, intoxicație, accidente sau orice altă daună — rezultat din sau în legătură cu: (a) participarea la un eveniment; (b) interacțiunea cu alți utilizatori, online sau fizic; (c) conținutul publicat de utilizatori; (d) indisponibilitatea sau funcționarea defectuoasă a Aplicației. Nimic din acești Termeni nu limitează răspunderea acolo unde legea nu permite limitarea acesteia (de exemplu, vătămare corporală sau deces cauzate din culpă gravă sau intenție directă a Spritz).',
      },
      {
        heading: '8. Despăgubire (indemnizare)',
        body:
          'Ești de acord să despăgubești și să aperi Spritz, administratorii și colaboratorii săi împotriva oricăror pretenții, daune, pierderi sau cheltuieli (inclusiv onorarii de avocat rezonabile) rezultate din: încălcarea acestor Termeni de către tine, conținutul pe care îl publici, un eveniment pe care îl găzduiești sau la care participi, sau interacțiunea ta cu alți utilizatori.',
      },
      {
        heading: '9. Plăți între utilizatori',
        body:
          'Orice taxă de participare, contribuție pentru băuturi sau altă sumă menționată la un eveniment se plătește direct între participant și Organizator, în afara Aplicației, dacă nu se specifică altfel. Spritz nu este parte la aceste tranzacții, nu procesează plăți pentru evenimente, nu oferă rambursări și nu mediază dispute financiare între utilizatori.',
      },
      {
        heading: '10. Moderare și încetare',
        body:
          'Ne rezervăm dreptul, dar nu avem obligația, de a modera, elimina orice conținut sau de a suspenda/șterge orice cont, în orice moment, la libera noastră apreciere. Poți șterge oricând contul tău din setările Aplicației.',
      },
      {
        heading: '11. Modificarea Termenilor',
        body:
          'Putem actualiza acești Termeni periodic. Continuarea utilizării Aplicației după publicarea modificărilor constituie acceptarea noilor Termeni.',
      },
      {
        heading: '12. Legea aplicabilă',
        body:
          'Acești Termeni sunt guvernați de legea română, fără a aduce atingere drepturilor imperative de care beneficiezi ca și consumator în țara ta de reședință, dacă faci parte din Uniunea Europeană.',
      },
      {
        heading: '13. Contact',
        body: 'Pentru întrebări legate de acești Termeni, ne poți contacta la [EMAIL DE CONTACT].',
      },
    ],
  },
  en: {
    title: 'Terms & Conditions',
    updated: 'Last updated: [DATE]',
    intro:
      'These Terms & Conditions ("Terms") govern your use of the Spritz application ("App", "Service"), operated by [COMPANY NAME], [ADDRESS], [REGISTRATION NUMBER] ("we", "Spritz"). By creating an account or using the App, you confirm that you have read, understood, and agree to these Terms. If you do not agree, do not use the App.',
    sections: [
      {
        heading: '1. What Spritz is',
        body:
          'Spritz is a platform that lets users discover, publish, and join meetups and events organized by other users ("events"). Spritz is strictly a technical intermediary — we do not organize, own, operate, supervise, or become a party to any event published through the App. Each event is created and hosted by an independent user ("Host") at their own risk and responsibility.',
      },
      {
        heading: '2. Eligibility and account',
        body:
          'The App is intended solely for people aged 18 or older. By creating an account you represent, at your own risk, that you are at least 18 years old. You are responsible for keeping your account credentials confidential and for all activity carried out through your account. We reserve the right to suspend or delete any account, at any time, with or without prior notice, if we suspect a violation of these Terms or of applicable law.',
      },
      {
        heading: '3. Identity verification (KYC)',
        body:
          'Hosting an event requires identity and age verification through a third-party verification provider (Didit). This verification only confirms that the submitted document appears valid and that the person in the live selfie matches the document, per the provider\'s own process — it is not an absolute guarantee of any user\'s real identity, intentions, or good faith, verified or not. Spritz does not perform additional background checks and does not guarantee the safety of any Host, attendee, or event.',
      },
      {
        heading: '4. User content',
        body:
          'You are solely responsible for any content you publish (event titles, descriptions, photos, messages, stories, reviews, etc.). By publishing content, you grant us a non-exclusive, royalty-free, worldwide license to display it within the App for the purpose of operating the Service. You may not publish content that is illegal, infringes third-party rights, incites violence, discrimination, or hatred, or involves minors, prohibited substances, weapons, or unlawful activity.',
      },
      {
        heading: '5. Real-world meetups — assumption of risk',
        body:
          'Events published through Spritz involve real, physical, in-person meetups between people who may not know each other. YOU ATTEND AT YOUR OWN RISK. We do not verify venues, their safety, the host\'s authorization to use the space, the quality of any products or services offered at an event, or the behavior of any attendee. We recommend you take your own precautions: let someone know where you\'re going, meet in public places, and do not accept drinks or items from unknown sources. Spritz has no obligation to supervise or intervene at any event.',
      },
      {
        heading: '6. No warranties',
        body:
          'The App is provided "as is" and "as available", without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy, uninterrupted availability, or error-free operation. We do not guarantee that a published event will actually take place, will match its description, or that any Host or attendee will behave as expected.',
      },
      {
        heading: '7. Limitation of liability',
        body:
          'To the maximum extent permitted by applicable law, Spritz, its administrators, employees, and contributors shall not be liable for any direct, indirect, incidental, special, punitive, or consequential damages — including but not limited to personal injury, death, property loss, financial loss, theft, assault, harassment, intoxication, accidents, or any other harm — arising out of or related to: (a) attending an event; (b) interacting with other users, online or in person; (c) user-published content; or (d) unavailability or malfunction of the App. Nothing in these Terms limits liability where the law does not permit such limitation (for example, personal injury or death caused by our gross negligence or willful misconduct).',
      },
      {
        heading: '8. Indemnification',
        body:
          'You agree to indemnify and hold harmless Spritz, its administrators, and contributors from any claims, damages, losses, or expenses (including reasonable attorney fees) arising from: your breach of these Terms, content you publish, an event you host or attend, or your interactions with other users.',
      },
      {
        heading: '9. Payments between users',
        body:
          'Any entry fee, drinks contribution, or other amount mentioned for an event is paid directly between the attendee and the Host, outside the App, unless stated otherwise. Spritz is not a party to these transactions, does not process event payments, does not issue refunds, and does not mediate financial disputes between users.',
      },
      {
        heading: '10. Moderation and termination',
        body:
          'We reserve the right, but have no obligation, to moderate or remove any content, or to suspend/delete any account, at any time, at our sole discretion. You may delete your account at any time from the App\'s settings.',
      },
      {
        heading: '11. Changes to these Terms',
        body: 'We may update these Terms from time to time. Continued use of the App after changes are published constitutes acceptance of the new Terms.',
      },
      {
        heading: '12. Governing law',
        body:
          'These Terms are governed by Romanian law, without prejudice to any mandatory consumer-protection rights you may have under the law of your country of residence if you are within the European Union.',
      },
      {
        heading: '13. Contact',
        body: 'For questions about these Terms, contact us at [CONTACT EMAIL].',
      },
    ],
  },
};

export default function Terms() {
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
