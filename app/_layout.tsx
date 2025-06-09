import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { OfflineNotice } from '@/components/OfflineNotice';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { PrivacyProvider } from '@/contexts/PrivacyContext';
import { HelpProvider } from '@/contexts/HelpContext';

function RootLayoutNav() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/(auth)/login');
      } else if (isAdmin) {
        router.replace('/admin');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [user, loading, isAdmin]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <OfflineNotice />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="help" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <NetworkProvider>
      <AuthProvider>
        <PrivacyProvider>
          <HelpProvider>
            <RootLayoutNav />
          </HelpProvider>
        </PrivacyProvider>
      </AuthProvider>
    </NetworkProvider>
  );
}
