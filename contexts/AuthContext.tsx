import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
});

// Define admin credentials
const ADMIN_EMAIL = 'eshield772@gmail.com';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setUser(user);
            // Check if the user is admin based on email
            setIsAdmin(user.email === ADMIN_EMAIL);
            await AsyncStorage.setItem('user', JSON.stringify({
              uid: user.uid,
              email: user.email,
            }));
          } else {
            setUser(null);
            setIsAdmin(false);
            await AsyncStorage.removeItem('user');
          }
          setLoading(false);
        });

        // Check stored user data
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser && !user) {
          const userData = JSON.parse(storedUser);
          setIsAdmin(userData.email === ADMIN_EMAIL);
        }

        return unsubscribe;
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 