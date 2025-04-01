import { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { isConnected as globalIsConnected } from '@/config/firebase';

interface NetworkContextType {
  isConnected: boolean;
  isLoading: boolean;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: globalIsConnected,
  isLoading: true,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(globalIsConnected);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(!!state.isConnected);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected, isLoading }}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext); 