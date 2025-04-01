import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from '@firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const firebaseConfig = {
  // Replace with your Firebase config object
  apiKey: "AIzaSyBC0Ylp3kCLnN15zGygFAabtT-SfpHx0F4",
  authDomain: "internship-bf9be.firebaseapp.com",
  projectId: "internship-bf9be",
  storageBucket: "internship-bf9be.appspot.com",
  messagingSenderId: "638079134035",
  appId: "1:638079134035:web:ed38bbd93fd84454a319a6",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with React Native persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

// Network status monitoring
let isConnected = true;

NetInfo.addEventListener(state => {
  isConnected = !!state.isConnected;
});

export { auth, db, storage, isConnected }; 