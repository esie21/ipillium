import React, { createContext, useContext } from 'react';

interface PrivacyPolicy {
  title: string;
  lastUpdated: string;
  sections: {
    title: string;
    content: string;
  }[];
}

const privacyPolicy: PrivacyPolicy = {
  title: "Privacy Policy",
  lastUpdated: "March 2024",
  sections: [
    {
      title: "Information We Collect",
      content: "We collect information that you provide directly to us, including your name, email address, and profile information. We also collect information about your location when you visit landmarks and your activity within the app."
    },
    {
      title: "How We Use Your Information",
      content: "We use the information we collect to provide, maintain, and improve our services, to develop new features, and to protect our users. This includes using your location data to track visited landmarks and calculate points."
    },
    {
      title: "Data Storage and Security",
      content: "Your data is stored securely using Firebase services. We implement appropriate security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction."
    },
    {
      title: "User Rights",
      content: "You have the right to access, correct, or delete your personal information. You can also request a copy of your data or withdraw your consent for data processing at any time."
    },
    {
      title: "Third-Party Services",
      content: "We use third-party services like Firebase for authentication, data storage, and analytics. These services have their own privacy policies and may collect information as specified in their respective privacy policies."
    },
    {
      title: "Children's Privacy",
      content: "Our services are not directed to children under 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us."
    },
    {
      title: "Changes to This Policy",
      content: "We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the 'last updated' date."
    },
    {
      title: "Contact Us",
      content: "If you have any questions about this privacy policy, please contact us at support@ipilium.com"
    }
  ]
};

interface PrivacyContextType {
  privacyPolicy: PrivacyPolicy;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivacyContext.Provider value={{ privacyPolicy }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
} 