import { StyleSheet, Animated } from 'react-native';
import { useNetwork } from '@/contexts/NetworkContext';
import { useEffect, useRef } from 'react';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';

export function OfflineNotice() {
  const { isConnected } = useNetwork();
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isConnected ? -100 : 0,
      useNativeDriver: true,
    }).start();
  }, [isConnected]);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <ThemedView style={styles.content}>
        <ThemedText style={styles.text}>
          No Internet Connection
        </ThemedText>
      </ThemedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  content: {
    backgroundColor: '#FF6B6B',
    padding: 10,
    alignItems: 'center',
  },
  text: {
    color: 'white',
    fontWeight: 'bold',
  },
}); 