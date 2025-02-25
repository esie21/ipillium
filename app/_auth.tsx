import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function AuthLayout() {
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

  return null;
} 