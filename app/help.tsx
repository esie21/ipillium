import { StyleSheet, ScrollView, View, Pressable, Linking } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useHelp } from '@/contexts/HelpContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export default function HelpScreen() {
  const { helpSections, faq, contactInfo } = useHelp();
  const router = useRouter();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleContact = (type: 'email' | 'phone') => {
    if (type === 'email') {
      Linking.openURL(`mailto:${contactInfo.email}`);
    } else {
      Linking.openURL(`tel:${contactInfo.phone}`);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#666" />
        </Pressable>
        <ThemedText style={styles.title}>Help & Support</ThemedText>
      </View>

      <ScrollView style={styles.content}>
        {/* Help Sections */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Getting Started</ThemedText>
          {helpSections.map((section, index) => (
            <View key={index} style={styles.helpCard}>
              <View style={styles.helpHeader}>
                <Ionicons name={section.icon as any} size={24} color="#A1CEDC" />
                <ThemedText style={styles.helpTitle}>{section.title}</ThemedText>
              </View>
              <ThemedText style={styles.helpContent}>{section.content}</ThemedText>
            </View>
          ))}
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Frequently Asked Questions</ThemedText>
          {faq.map((item, index) => (
            <Pressable
              key={index}
              style={styles.faqItem}
              onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
            >
              <View style={styles.faqHeader}>
                <ThemedText style={styles.faqQuestion}>{item.question}</ThemedText>
                <Ionicons
                  name={expandedFaq === index ? "chevron-up" : "chevron-down"}
                  size={24}
                  color="#666"
                />
              </View>
              {expandedFaq === index && (
                <ThemedText style={styles.faqAnswer}>{item.answer}</ThemedText>
              )}
            </Pressable>
          ))}
        </View>

        {/* Contact Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Contact Us</ThemedText>
          <View style={styles.contactCard}>
            <Pressable
              style={styles.contactItem}
              onPress={() => handleContact('email')}
            >
              <Ionicons name="mail" size={24} color="#A1CEDC" />
              <View style={styles.contactInfo}>
                <ThemedText style={styles.contactLabel}>Email</ThemedText>
                <ThemedText style={styles.contactValue}>{contactInfo.email}</ThemedText>
              </View>
            </Pressable>

            <Pressable
              style={styles.contactItem}
              onPress={() => handleContact('phone')}
            >
              <Ionicons name="call" size={24} color="#A1CEDC" />
              <View style={styles.contactInfo}>
                <ThemedText style={styles.contactLabel}>Phone</ThemedText>
                <ThemedText style={styles.contactValue}>{contactInfo.phone}</ThemedText>
              </View>
            </Pressable>

            <View style={styles.contactItem}>
              <Ionicons name="time" size={24} color="#A1CEDC" />
              <View style={styles.contactInfo}>
                <ThemedText style={styles.contactLabel}>Hours</ThemedText>
                <ThemedText style={styles.contactValue}>{contactInfo.hours}</ThemedText>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  helpCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
    color: '#333',
  },
  helpContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  contactInfo: {
    marginLeft: 15,
    flex: 1,
  },
  contactLabel: {
    fontSize: 14,
    color: '#666',
  },
  contactValue: {
    fontSize: 16,
    color: '#333',
    marginTop: 2,
  },
}); 