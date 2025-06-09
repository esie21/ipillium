import React, { createContext, useContext } from 'react';

interface HelpSection {
  title: string;
  content: string;
  icon?: string;
}

interface HelpContextType {
  helpSections: HelpSection[];
  faq: {
    question: string;
    answer: string;
  }[];
  contactInfo: {
    email: string;
    phone: string;
    hours: string;
  };
}

const helpContent: HelpContextType = {
  helpSections: [
    {
      title: "Getting Started",
      content: "Welcome to Ipilium! To get started, create an account and explore landmarks around you. Visit landmarks to earn points and unlock achievements.",
      icon: "rocket"
    },
    {
      title: "Visiting Landmarks",
      content: "When you're near a landmark, open the app and tap 'Check In'. Make sure your location services are enabled for accurate tracking.",
      icon: "location"
    },
    {
      title: "Earning Points",
      content: "Earn points by visiting landmarks, completing challenges, and participating in quizzes. Points contribute to your monthly ranking on the leaderboard.",
      icon: "star"
    },
    {
      title: "Achievements & Badges",
      content: "Complete various activities to earn badges and achievements. Track your progress in the Profile section and share your accomplishments with friends.",
      icon: "trophy"
    }
  ],
  faq: [
    {
      question: "How do I reset my password?",
      answer: "Go to the login screen and tap 'Forgot Password'. Enter your email address and follow the instructions sent to your email."
    },
    {
      question: "Why isn't my location being detected?",
      answer: "Make sure location services are enabled in your device settings and that you've granted location permissions to the app."
    },
    {
      question: "How are points calculated?",
      answer: "Points are awarded for visiting landmarks, completing challenges, and participating in quizzes. Each activity has different point values."
    },
   
  ],
  contactInfo: {
    email: "support@ipilium.com",
    phone: "+1 (555) 123-4567",
    hours: "Monday - Friday, 9:00 AM - 6:00 PM EST"
  }
};

const HelpContext = createContext<HelpContextType | undefined>(undefined);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  return (
    <HelpContext.Provider value={helpContent}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (context === undefined) {
    throw new Error('useHelp must be used within a HelpProvider');
  }
  return context;
} 