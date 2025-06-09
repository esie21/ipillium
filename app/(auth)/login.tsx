import { StyleSheet, Platform, Pressable, Alert } from 'react-native';
import { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  Auth
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { auth, db } from '@/config/firebase';

const firebaseAuth = auth as Auth;

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');

  const handleSubmit = async () => {
    console.log("Attempting to log in with:", { email, password });
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
  
    if (!isLogin && !username) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }
  
    if (!isLogin && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
  
    setLoading(true);
    try {
      if (isLogin) {
        // User Login
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        await initializeUserProgress(userCredential.user.uid);
        Alert.alert('Success', 'Logged in successfully');
      } else {
        // User Signup
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        const userId = userCredential.user.uid;
  
        console.log("User created, UID:", userId); // Debugging step
  
        // Save user details to Firestore
        const userDoc = {
          email: email,
          username: username,
          role: 'user',
          createdAt: new Date().toISOString(),
          completedChallenges: 0,
          currentStreak: 0,
          earnedBadges: [],
          monthlyPoints: 0,
          points: 0,
          quizScores: [],
          visitedLandmarks: [],
        };
  
        await setDoc(doc(db, 'users', userId), userDoc);
        console.log("Document written successfully!"); // Debugging step
        Alert.alert('Success', 'Account created successfully');
      }
    } catch (error: any) {
      console.error("Error creating user:", error); // Debugging step
      console.error("Firestore write error:", error.code, error.message); // Better error logging
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      Alert.alert('Success', 'Password reset email sent');
      setShowForgotPassword(false);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeUserProgress = async (userId: string) => {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      const initialProgress = {
        username: username,
        points: 0,
        visitedLandmarks: [],
        completedChallenges: [],
        earnedBadges: [],
        quizScores: {},
        monthlyPoints: 0,
        currentStreak: 0
      };
      await setDoc(userDocRef, initialProgress);
    }
  };

  if (showForgotPassword) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>Reset Password</ThemedText>
        
        <ThemedView style={styles.inputContainer}>
          <ThemedTextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            editable={!loading}
          />
          
          <Pressable 
            onPress={handleForgotPassword} 
            style={[styles.button, loading && styles.buttonDisabled]}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </ThemedText>
          </Pressable>
          
          <Pressable onPress={() => setShowForgotPassword(false)} disabled={loading}>
            <ThemedText style={styles.linkText}>Back to Login</ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        {isLogin ? 'Login' : 'Sign Up'}
      </ThemedText>

      <ThemedView style={styles.inputContainer}>
        <ThemedTextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          editable={!loading}
        />
        


        {!isLogin && (
          <ThemedTextInput
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            editable={!loading}
          />
        )}
         <ThemedTextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          editable={!loading}
        />
        {!isLogin && (
          <ThemedTextInput
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            style={styles.input}
            editable={!loading}
          />
        )}

        <Pressable 
          onPress={handleSubmit} 
          style={[styles.button, loading && styles.buttonDisabled]}
          disabled={loading}
        >
          <ThemedText style={styles.buttonText}>
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Sign Up')}
          </ThemedText>
        </Pressable>

        {isLogin && (
          <Pressable onPress={() => setShowForgotPassword(true)} disabled={loading}>
            <ThemedText style={styles.linkText}>Forgot Password?</ThemedText>
          </Pressable>
        )}

        <Pressable onPress={() => setIsLogin(!isLogin)} disabled={loading}>
          <ThemedText style={styles.linkText}>
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    gap: 15,
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  button: {
    backgroundColor: '#A1CEDC',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkText: {
    textAlign: 'center',
    color: '#A1CEDC',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
}); 