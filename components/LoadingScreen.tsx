import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#A1CEDC" />
      <ThemedText style={styles.text}>Loading...</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 10,
  },
}); 