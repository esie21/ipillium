import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
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
            
            // Check user role in Firestore
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setIsAdmin(userData.role === 'admin' || userData.role === 'superAdmin');
            } else {
              setIsAdmin(false);
            }
            
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
          const userDoc = await getDoc(doc(db, 'users', userData.uid));
          if (userDoc.exists()) {
            const userDocData = userDoc.data();
            setIsAdmin(userDocData.role === 'admin' || userDocData.role === 'superAdmin');
          }
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