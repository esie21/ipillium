import { useState, useEffect } from 'react';
import { StyleSheet, Pressable, FlatList, Image, Alert, View, useWindowDimensions, ScrollView, Modal, Switch } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { auth, db } from '@/config/firebase';
import { signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc, addDoc, getDoc, setDoc } from 'firebase/firestore';
import { Landmark } from '@/types/landmarks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { storage } from '@/utils/storage';

type Tab = 'landmarks' | 'users' | 'pending' | 'settings';

interface AdminStats {
  totalUsers: number;
  totalLandmarks: number;
  totalVisits: number;
  activeUsers: number;
}

interface User {
  id: string;
  email: string;
  username: string;
  visitedLandmarks: string[];
  points: number;
  createdAt: string;
  role?: 'admin' | 'superAdmin' | 'user';
}

export default function AdminDashboard() {
  const { isAdmin, user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('landmarks');
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalLandmarks: 0,
    totalVisits: 0,
    activeUsers: 0,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddLandmark, setShowAddLandmark] = useState(false);
  const [newLandmark, setNewLandmark] = useState<Partial<Landmark>>({
    name: '',
    description: '',
    location: { latitude: 0, longitude: 0 },
    status: 'pending',
  });
  const [selectedImage, setSelectedImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingLandmark, setEditingLandmark] = useState<Landmark | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;
  const isTablet = width >= 768;
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    email: '',
    username: '',
    password: '',
  });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [tempLocation, setTempLocation] = useState({ latitude: 0, longitude: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editingLandmarkId, setEditingLandmarkId] = useState<string | null>(null);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)');
    } else {
      ensureSuperAdminDocument().then(() => {
        fetchAdminData();
        checkSuperAdmin();
      });
    }
  }, [isAdmin]);

  const fetchAdminData = async () => {
    try {
      console.log('Fetching admin data...');
      
      // Fetch users
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData = usersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User));
      setUsers(usersData);
      console.log('Fetched users:', usersData.length);

      // Fetch landmarks with status filter
      const landmarksRef = collection(db, 'landmarks');
      const landmarksSnap = await getDocs(landmarksRef);
      const landmarksData = landmarksSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Landmark));
      
      console.log('Fetched landmarks:', {
        total: landmarksData.length,
        pending: landmarksData.filter(l => l.status === 'pending').length,
        approved: landmarksData.filter(l => l.status === 'approved').length,
        rejected: landmarksData.filter(l => l.status === 'rejected').length
      });
      
      setLandmarks(landmarksData);

      // Calculate stats
      setStats({
        totalUsers: usersData.length,
        totalLandmarks: landmarksData.length,
        totalVisits: landmarksData.reduce((acc, curr) => acc + (curr.visitCount || 0), 0),
        activeUsers: usersData.filter(u => u.visitedLandmarks?.length > 0).length,
      });
    } catch (error) {
      console.error('Error fetching admin data:', error);
      Alert.alert('Error', 'Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  };

  const checkSuperAdmin = async () => {
    try {
      console.log('Checking super admin status...');
      
      if (!user?.uid) {
        console.log('No user UID found');
        setIsSuperAdmin(false);
        return;
      }

      // Log current user info
      console.log('Current user:', {
        uid: user.uid,
        email: user.email
      });

      // Check if email matches superadmin email
      if (user.email === 'eshield772@gmail.com') {
        console.log('Email matches superadmin email');
        setIsSuperAdmin(true);
        
        // Ensure the user document exists with correct role
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          // Create the superadmin document if it doesn't exist
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            role: 'superAdmin',
            username: 'Super Admin',
            createdAt: new Date().toISOString(),
            visitedLandmarks: [],
            points: 0,
            monthlyPoints: 0
          });
          console.log('Created superadmin document');
        } else {
          // Update the role if necessary
          const userData = userDoc.data();
          if (userData.role !== 'superAdmin') {
            await updateDoc(doc(db, 'users', user.uid), {
              role: 'superAdmin'
            });
            console.log('Updated user role to superAdmin');
          }
        }
        return;
      }

      // If email doesn't match, check the user document
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      console.log('User document data:', userData);

      if (userDoc.exists() && userData?.role === 'superAdmin') {
        console.log('User document confirms superadmin status');
        setIsSuperAdmin(true);
      } else {
        console.log('User is not a superadmin');
        setIsSuperAdmin(false);
      }
    } catch (error) {
      console.error('Error checking super admin status:', error);
      setIsSuperAdmin(false);
    }
  };

  const ensureSuperAdminDocument = async () => {
    try {
      console.log('Ensuring super admin document exists...');
      
      if (!user?.uid || user.email !== 'eshield772@gmail.com') {
        console.log('Not the super admin email');
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        console.log('Creating super admin document...');
        // Create the document if it doesn't exist
        await setDoc(userDocRef, {
          email: 'eshield772@gmail.com',
          username: 'Super Admin',
          role: 'superAdmin',
          createdAt: new Date().toISOString(),
          visitedLandmarks: [],
          points: 0,
          monthlyPoints: 0,
          isAdmin: true,
          isSuperAdmin: true
        });
        console.log('Super admin document created');
      } else {
        // Update the document to ensure it has the correct role
        const userData = userDoc.data();
        if (userData.role !== 'superAdmin') {
          console.log('Updating super admin role...');
          await updateDoc(userDocRef, {
            role: 'superAdmin',
            isAdmin: true,
            isSuperAdmin: true
          });
          console.log('Super admin role updated');
        }
      }
    } catch (error) {
      console.error('Error ensuring super admin document:', error);
    }
  };

  const handleCreateAdmin = async () => {
    if (!newAdmin.email || !newAdmin.username || !newAdmin.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
  
    setLoading(true);
    try {
      console.log('Current user state:', {
        uid: user?.uid,
        email: user?.email,
        isSuperAdmin: isSuperAdmin,
      });
  
      if (!user?.uid || !user?.email) {
        throw new Error('You must be logged in to create admin users');
      }
  
      if (user.email !== 'eshield772@gmail.com') {
        throw new Error('Only super admin can create admin users');
      }
  
      // Save current super admin credentials
      const superAdminEmail = user.email;
      const superAdminPassword = "your_super_admin_password"; // Store securely
  
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newAdmin.email,
        newAdmin.password
      );
  
      console.log('Created auth user:', userCredential.user.uid);
  
      // Create the admin user document
      const adminData = {
        email: newAdmin.email,
        username: newAdmin.username,
        role: 'admin',
        createdAt: new Date().toISOString(),
        visitedLandmarks: [],
        points: 0,
        monthlyPoints: 0,
        createdBy: user.uid,
        isAdmin: true,
      };
  
      console.log('Creating admin with data:', adminData);
  
      await setDoc(doc(db, 'users', userCredential.user.uid), adminData);
  
      console.log('Successfully created admin user');
  
      // Sign back in as the original super admin
      await signInWithEmailAndPassword(auth, superAdminEmail, superAdminPassword);
  
      console.log('Reauthenticated as super admin');
  
      setShowCreateAdmin(false);
      setNewAdmin({ email: '', username: '', password: '' });
      Alert.alert('Success', 'Admin user created successfully');
      fetchAdminData();
    } catch (error: any) {
      console.error('Detailed error:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
      Alert.alert('Error', error.message || 'Failed to create admin user');
    } finally {
      setLoading(false);
    }
  };
  

  const handleAddLandmark = async () => {
    try {
      if (!newLandmark.name || !newLandmark.description) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      let imageUrl = '';
      if (selectedImage) {
        const uploadedImage = await storage.saveImage(selectedImage, {
          type: 'landmark',
        });
        imageUrl = uploadedImage.uri;
      }

      await addDoc(collection(db, 'landmarks'), {
        ...newLandmark,
        image: imageUrl,
        visitCount: 0,
        createdAt: new Date().toISOString(),
      });

      setShowAddLandmark(false);
      setNewLandmark({
        name: '',
        description: '',
        location: { latitude: 0, longitude: 0 },
        status: 'pending',
      });
      setSelectedImage('');
      fetchAdminData();
      Alert.alert('Success', 'Landmark added successfully');
    } catch (error) {
      console.error('Error adding landmark:', error);
      Alert.alert('Error', 'Failed to add landmark');
    }
  };

  const handleDeleteLandmark = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'landmarks', id));
      fetchAdminData();
      Alert.alert('Success', 'Landmark deleted successfully');
    } catch (error) {
      console.error('Error deleting landmark:', error);
      Alert.alert('Error', 'Failed to delete landmark');
    }
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 1,
      });

      if (!result.canceled && result.assets[0].uri) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleLocationPick = (e: any) => {
    setTempLocation({
      latitude: e.nativeEvent.coordinate.latitude,
      longitude: e.nativeEvent.coordinate.longitude,
    });
  };

  const handleConfirmLocation = () => {
    setNewLandmark(prev => ({
      ...prev,
      location: tempLocation
    }));
    setShowMapPicker(false);
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      fetchAdminData();
      Alert.alert('Success', 'User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      Alert.alert('Error', 'Failed to delete user');
    }
  };

  const handleUpdateLandmark = async () => {
    if (!editingLandmark) return;
    
    try {
      await updateDoc(doc(db, 'landmarks', editingLandmark.id), {
        ...editingLandmark
      });
      setEditingLandmark(null);
      fetchAdminData();
      Alert.alert('Success', 'Landmark updated successfully');
    } catch (error) {
      console.error('Error updating landmark:', error);
      Alert.alert('Error', 'Failed to update landmark');
    }
  };

  const handleApprove = async (landmarkId: string) => {
    try {
      await updateDoc(doc(db, 'landmarks', landmarkId), {
        status: 'approved'
      });
      fetchAdminData();
      Alert.alert('Success', 'Landmark approved');
    } catch (error) {
      console.error('Error approving landmark:', error);
      Alert.alert('Error', 'Failed to approve landmark');
    }
  };

  const handleReject = async (landmarkId: string) => {
    try {
      await updateDoc(doc(db, 'landmarks', landmarkId), {
        status: 'rejected'
      });
      fetchAdminData();
      Alert.alert('Success', 'Landmark rejected');
    } catch (error) {
      console.error('Error rejecting landmark:', error);
      Alert.alert('Error', 'Failed to reject landmark');
    }
  };

  const handleEditLandmark = (landmark: Landmark) => {
    setNewLandmark({
      name: landmark.name,
      description: landmark.description,
      location: landmark.location,
      status: landmark.status,
    });
    setSelectedImage(landmark.image);
    setEditingLandmarkId(landmark.id);
    setIsEditing(true);
    setShowAddLandmark(true);
  };

  const handleAddOrEditLandmark = async () => {
    try {
      if (!newLandmark.name || !newLandmark.description) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      let imageUrl = selectedImage;
      if (selectedImage && !selectedImage.startsWith('http')) {
        const uploadedImage = await storage.saveImage(selectedImage, {
          type: 'landmark',
        });
        imageUrl = uploadedImage.uri;
      }

      if (isEditing && editingLandmarkId) {
        await updateDoc(doc(db, 'landmarks', editingLandmarkId), {
          ...newLandmark,
          image: imageUrl,
        });
        Alert.alert('Success', 'Landmark updated successfully');
      } else {
        await addDoc(collection(db, 'landmarks'), {
          ...newLandmark,
          image: imageUrl,
          visitCount: 0,
          createdAt: new Date().toISOString(),
        });
        Alert.alert('Success', 'Landmark added successfully');
      }

      setShowAddLandmark(false);
      setNewLandmark({
        name: '',
        description: '',
        location: { latitude: 0, longitude: 0 },
        status: 'pending',
      });
      setSelectedImage('');
      setEditingLandmarkId(null);
      setIsEditing(false);
      fetchAdminData();
    } catch (error) {
      console.error('Error saving landmark:', error);
      Alert.alert('Error', 'Failed to save landmark');
    }
  };

  const getResponsiveStyles = () => {
    return StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
      },
      contentContainer: {
        flex: 1,
        backgroundColor: '#F8F9FA',
      },
      scrollView: {
        flex: 1,
        backgroundColor: '#F8F9FA',
      },
      tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginVertical: 15,
        borderRadius: 16,
        backgroundColor: '#FFF',
        padding: 8,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      tab: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 4,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
      },
      tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748B',
        letterSpacing: 0.3,
      },
      activeTab: {
        backgroundColor: '#3B82F6',
      },
      activeTabText: {
        color: '#FFF',
        fontWeight: '700',
      },
      landmarkCard: {
        marginHorizontal: 20,
        marginVertical: 12,
        backgroundColor: '#fff',
        borderRadius: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        overflow: 'hidden',
      },
      cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
      },
      statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
      },
      statusText: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.5,
      },
      approvedStatus: {
        color: '#059669',
      },
      rejectedStatus: {
        color: '#DC2626',
      },
      pendingStatus: {
        color: '#D97706',
      },
      dateText: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
      },
      landmarkImage: {
        width: '100%',
        aspectRatio: 4/3,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
      },
      cardContent: {
        padding: 20,
      },
      landmarkName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 8,
        letterSpacing: 0.3,
      },
      landmarkDescription: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 22,
        marginBottom: 16,
      },
      locationInfo: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
      },
      locationText: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '500',
      },
      buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 20,
      },
      actionButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      editButton: {
        backgroundColor: '#3B82F6',
      },
      deleteButton: {
        backgroundColor: '#EF4444',
      },
      actionButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 15,
        letterSpacing: 0.3,
      },
      signOutButton: {
        backgroundColor: '#E74C3C',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 30,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      signOutText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
      },
      addLandmarkContainer: {
        paddingHorizontal: 20,
        paddingVertical: 10,
      },
      addLandmarkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3498DB',
        padding: 20,
        borderRadius: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      addLandmarkIconContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        padding: 8,
      },
      addLandmarkTextContainer: {
        flex: 1,
        marginLeft: 15,
      },
      addLandmarkTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
      },
      addLandmarkSubtitle: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
      },
      addLandmarkArrow: {
        marginLeft: 10,
      },
      editContainer: {
        padding: 20,
      },
      editHeader: {
        marginBottom: 25,
        alignItems: 'center',
      },
      editTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#2C3E50',
        marginBottom: 8,
      },
      editSubtitle: {
        fontSize: 14,
        color: '#7F8C8D',
        textAlign: 'center',
      },
      editForm: {
        gap: 20,
      },
      formGroup: {
        marginBottom: 20,
      },
      inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#34495E',
        marginBottom: 8,
      },
      editInput: {
        backgroundColor: '#F8F9FA',
        padding: 15,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#E9ECEF',
        color: '#2C3E50',
      },
      editTextArea: {
        minHeight: 100,
        paddingTop: 15,
      },
      editImageContainer: {
        marginVertical: 15,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E9ECEF',
      },
      editImage: {
        width: '100%',
        height: 200,
      },
      editButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10,
      },
      saveButton: {
        backgroundColor: '#2ECC71',
        flex: 2,
      },
      cancelButton: {
        backgroundColor: '#E74C3C',
        flex: 1,
      },
      modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
      },
      modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        width: '90%',
        maxWidth: 500,
        maxHeight: '90%',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      },
      modalTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      },
      modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#2C3E50',
      },
      closeButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#F8F9FA',
      },
      modalScroll: {
        maxHeight: '70%',
      },
      imageUploadContainer: {
        marginBottom: 20,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F8F9FA',
        borderWidth: 2,
        borderColor: '#E9ECEF',
        borderStyle: 'dashed',
      },
      uploadedImage: {
        width: '100%',
        height: 200,
      },
      imageUploadPlaceholder: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      },
      imageUploadText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#3498DB',
        marginTop: 10,
      },
      imageUploadSubtext: {
        fontSize: 14,
        color: '#7F8C8D',
        marginTop: 5,
      },
      textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
      },
      locationPickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E9ECEF',
        gap: 10,
      },
      locationPickerText: {
        fontSize: 16,
        color: '#2C3E50',
      },
      statusSelector: {
        flexDirection: 'row',
        gap: 10,
      },
      statusOption: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#E9ECEF',
        alignItems: 'center',
      },
      statusOptionActive: {
        backgroundColor: '#3498DB',
        borderColor: '#3498DB',
      },
      statusOptionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7F8C8D',
      },
      statusOptionTextActive: {
        color: '#FFF',
      },
      modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 20,
      },
      modalButton: {
        flex: 1,
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
      },
      cancelButton: {
        backgroundColor: '#FF6B6B',
      },
      createButton: {
        backgroundColor: '#3B82F6',
      },
      addButton: {
        backgroundColor: '#2ECC71',
      },
      confirmButton: {
        backgroundColor: '#3498DB',
      },
      buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
      },
      mapModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
      },
      mapModalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        width: '90%',
        maxWidth: 500,
        maxHeight: '90%',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      mapModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      },
      mapModalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#2C3E50',
      },
      mapPicker: {
        width: '100%',
        height: 300,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 20,
      },
      mapModalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
      },
      roleInfo: {
        backgroundColor: '#E8F5E9',
        padding: 12,
        borderRadius: 8,
        marginTop: 10,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#81C784',
      },
      roleInfoText: {
        color: '#2E7D32',
        fontSize: 14,
        textAlign: 'center',
      },
      listContainer: {
        padding: 16,
        flexGrow: 1,
      },
      pendingCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      pendingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#FDE68A',
      },
      pendingIconContainer: {
        backgroundColor: '#FCD34D',
        borderRadius: 20,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
      },
      pendingIcon: {
        fontSize: 16,
      },
      pendingBannerText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#92400E',
      },
      submissionDate: {
        fontSize: 13,
        color: '#92400E',
        opacity: 0.8,
      },
      pendingContent: {
        padding: 16,
      },
      pendingImage: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginBottom: 16,
      },
      pendingDetails: {
        gap: 12,
      },
      pendingTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 4,
      },
      pendingDescription: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 22,
      },
      pendingMetadata: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        marginTop: 8,
        gap: 8,
      },
      pendingLocation: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      submitterDetail: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      metadataLabel: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
      },
      metadataValue: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '600',
      },
      reviewActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
      },
      reviewButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 6,
      },
      reviewButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
      },
      approveButton: {
        backgroundColor: '#059669',
      },
      rejectButton: {
        backgroundColor: '#DC2626',
      },
      settingsContainer: {
        flex: 1,
        padding: 20,
        backgroundColor: '#F8F9FA',
      },
      settingsSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      settingsTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 16,
      },
      settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
      },
      settingLabel: {
        fontSize: 16,
        color: '#475569',
        fontWeight: '500',
      },
      settingValue: {
        fontSize: 16,
        color: '#1E293B',
        fontWeight: '600',
      },
      dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FEE2E2',
        gap: 8,
      },
      dangerButtonText: {
        color: '#DC2626',
        fontSize: 16,
        fontWeight: '600',
      },
      userCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        flex: 1,
      },
      userEmail: {
        fontSize: 14,
        color: '#64748B',
        flex: 1,
      },
      userRole: {
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '500',
        flex: 1,
      },
      createAdminButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3B82F6',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        gap: 8,
      },
      createAdminButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
      },
      input: {
        backgroundColor: '#F8F9FA',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        fontSize: 16,
        color: '#1E293B',
      },
      textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
      },
    });
  };

  const responsiveStyles = getResponsiveStyles();

  const renderLandmark = ({ item }: { item: Landmark }) => (
    <ThemedView style={responsiveStyles.landmarkCard}>
      {editingLandmark?.id === item.id ? (
        <ScrollView style={styles.editContainer}>
          <View style={styles.editHeader}>
            <ThemedText style={styles.editTitle}>Edit Landmark</ThemedText>
            <ThemedText style={styles.editSubtitle}>Make changes to the landmark details below</ThemedText>
          </View>

          <View style={styles.editForm}>
            <View style={styles.formGroup}>
              <ThemedText style={styles.inputLabel}>Name</ThemedText>
              <ThemedTextInput
                value={editingLandmark.name}
                onChangeText={(text) => setEditingLandmark(prev => ({ ...prev!, name: text }))}
                style={styles.editInput}
                placeholder="Enter landmark name"
              />
            </View>
            
            <View style={styles.formGroup}>
              <ThemedText style={styles.inputLabel}>Description</ThemedText>
              <ThemedTextInput
                value={editingLandmark.description}
                onChangeText={(text) => setEditingLandmark(prev => ({ ...prev!, description: text }))}
                style={[styles.editInput, styles.editTextArea]}
                multiline
                placeholder="Enter landmark description"
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.inputLabel}>Location</ThemedText>
              <View style={styles.locationEditContainer}>
                <MapView
                  style={styles.locationMap}
                  initialRegion={{
                    latitude: editingLandmark.location.latitude,
                    longitude: editingLandmark.location.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                  onPress={(e) => {
                    setEditingLandmark(prev => ({
                      ...prev!,
                      location: {
                        latitude: e.nativeEvent.coordinate.latitude,
                        longitude: e.nativeEvent.coordinate.longitude,
                      }
                    }));
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: editingLandmark.location.latitude,
                      longitude: editingLandmark.location.longitude,
                    }}
                  />
                </MapView>
                
                <View style={styles.coordinatesInputs}>
                  <View style={styles.coordinateGroup}>
                    <ThemedText style={styles.coordinateLabel}>Latitude</ThemedText>
                    <ThemedTextInput
                      value={editingLandmark.location.latitude.toString()}
                      onChangeText={(text) => {
                        const lat = parseFloat(text);
                        if (!isNaN(lat) && lat >= -90 && lat <= 90) {
                          setEditingLandmark(prev => ({
                            ...prev!,
                            location: {
                              ...prev!.location,
                              latitude: lat,
                            }
                          }));
                        }
                      }}
                      style={styles.coordinateInput}
                      keyboardType="numeric"
                      placeholder="Latitude"
                    />
                  </View>

                  <View style={styles.coordinateGroup}>
                    <ThemedText style={styles.coordinateLabel}>Longitude</ThemedText>
                    <ThemedTextInput
                      value={editingLandmark.location.longitude.toString()}
                      onChangeText={(text) => {
                        const lng = parseFloat(text);
                        if (!isNaN(lng) && lng >= -180 && lng <= 180) {
                          setEditingLandmark(prev => ({
                            ...prev!,
                            location: {
                              ...prev!.location,
                              longitude: lng,
                            }
                          }));
                        }
                      }}
                      style={styles.coordinateInput}
                      keyboardType="numeric"
                      placeholder="Longitude"
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.editImageContainer}>
              <Image 
                source={{ uri: item.image }} 
                style={styles.editImage}
                resizeMode="cover"
              />
            </View>

            <View style={styles.editButtons}>
              <Pressable 
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleUpdateLandmark}>
                <ThemedText style={styles.actionButtonText}>💾 Save Changes</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => setEditingLandmark(null)}>
                <ThemedText style={styles.actionButtonText}>✕ Cancel</ThemedText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView>
          <View style={styles.cardHeader}>
            <View style={styles.statusBadge}>
              <ThemedText 
                numberOfLines={1} 
                style={[
                  styles.statusText,
                  item.status === 'approved' && styles.approvedStatus,
                  item.status === 'rejected' && styles.rejectedStatus,
                  item.status === 'pending' && styles.pendingStatus,
                ]}>
                {item.status.toUpperCase()}
              </ThemedText>
            </View>
            <ThemedText style={styles.dateText}>
              {new Date(item.createdAt).toLocaleDateString()}
            </ThemedText>
          </View>

          <Image 
            source={{ uri: item.image }} 
            style={responsiveStyles.landmarkImage}
            resizeMode="cover"
          />
          
          <View style={styles.cardContent}>
            <ThemedText 
              numberOfLines={2} 
              style={responsiveStyles.landmarkName}>
              {item.name}
            </ThemedText>
            <ThemedText 
              numberOfLines={4}
              style={responsiveStyles.landmarkDescription}>
              {item.description}
            </ThemedText>

            <View style={styles.locationInfo}>
              <ThemedText 
                numberOfLines={2}
                style={styles.locationText}>
                Location: {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
              </ThemedText>
            </View>

            <View style={styles.buttonRow}>
              <Pressable 
                style={[styles.actionButton, styles.editButton]}
                onPress={() => handleEditLandmark(item)}>
                <ThemedText style={styles.actionButtonText}>Edit</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDeleteLandmark(item.id)}>
                <ThemedText style={styles.actionButtonText}>Delete</ThemedText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}
    </ThemedView>
  );

  const renderPendingLandmark = ({ item }: { item: Landmark }) => (
    <ThemedView style={[responsiveStyles.landmarkCard, styles.pendingCard]}>
      {/* Status Banner */}
      <View style={styles.pendingBanner}>
        <View style={styles.pendingIconContainer}>
          <ThemedText style={styles.pendingIcon}>⏳</ThemedText>
        </View>
        <ThemedText style={styles.pendingBannerText}>Awaiting Review</ThemedText>
        <ThemedText style={styles.submissionDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </ThemedText>
      </View>

      {/* Main Content */}
      <View style={styles.pendingContent}>
        <Image 
          source={{ uri: item.image }} 
          style={styles.pendingImage}
          resizeMode="cover"
        />
        
        <View style={styles.pendingDetails}>
          <ThemedText style={styles.pendingTitle}>{item.name}</ThemedText>
          <ThemedText style={styles.pendingDescription} numberOfLines={3}>
            {item.description}
          </ThemedText>

          <View style={styles.pendingMetadata}>
            <View style={styles.pendingLocation}>
              <ThemedText style={styles.metadataLabel}>📍 Location</ThemedText>
              <ThemedText style={styles.metadataValue}>
                {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
              </ThemedText>
            </View>

            <View style={styles.submitterDetail}>
              <ThemedText style={styles.metadataLabel}>👤 Submitted by</ThemedText>
              <ThemedText style={styles.metadataValue}>{item.userId}</ThemedText>
            </View>
          </View>

          <View style={styles.reviewActions}>
            <Pressable 
              style={[styles.reviewButton, styles.editButton]}
              onPress={() => handleEditLandmark(item)}
            >
              <Ionicons name="pencil" size={20} color="#FFF" />
              <ThemedText style={styles.reviewButtonText}>Edit</ThemedText>
            </Pressable>
            <Pressable 
              style={[styles.reviewButton, styles.approveButton]}
              onPress={() => handleApprove(item.id)}
            >
              <Ionicons name="checkmark" size={20} color="#FFF" />
              <ThemedText style={styles.reviewButtonText}>Approve</ThemedText>
            </Pressable>
            <Pressable 
              style={[styles.reviewButton, styles.rejectButton]}
              onPress={() => handleReject(item.id)}
            >
              <Ionicons name="close" size={20} color="#FFF" />
              <ThemedText style={styles.reviewButtonText}>Reject</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </ThemedView>
  );

  const renderSettings = () => (
    <View style={styles.settingsContainer}>
      <View style={styles.settingsSection}>
        <ThemedText style={styles.settingsTitle}>Account Settings</ThemedText>
        <View style={styles.settingItem}>
          <ThemedText style={styles.settingLabel}>Email</ThemedText>
          <ThemedText style={styles.settingValue}>{user?.email}</ThemedText>
        </View>
        <View style={styles.settingItem}>
          <ThemedText style={styles.settingLabel}>Role</ThemedText>
          <ThemedText style={styles.settingValue}>{isSuperAdmin ? 'Super Admin' : 'Admin'}</ThemedText>
        </View>
      </View>

      <View style={styles.settingsSection}>
        <ThemedText style={styles.settingsTitle}>App Settings</ThemedText>
        {/*<View style={styles.settingItem}>
          <ThemedText style={styles.settingLabel}>Dark Mode</ThemedText>
          <Switch
            value={isDarkMode}
            onValueChange={setIsDarkMode}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={isDarkMode ? '#007AFF' : '#f4f3f4'}
          />
        </View>*/}
        <View style={styles.settingItem}>
          <ThemedText style={styles.settingLabel}>Notifications</ThemedText>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={notificationsEnabled ? '#007AFF' : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <ThemedText style={styles.settingsTitle}>Danger Zone</ThemedText>
        <Pressable 
          style={styles.dangerButton}
          onPress={() => {
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel'
                },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: handleSignOut
                }
              ]
            );
          }}
        >
          <Ionicons name="log-out" size={24} color="#FF6B6B" />
          <ThemedText style={styles.dangerButtonText}>Sign Out</ThemedText>
        </Pressable>
      </View>
    </View>
  );

  if (!isAdmin) return null;

  return (
    <ThemedView style={responsiveStyles.container}>
      <View style={styles.tabContainer}>
        <Pressable 
          style={[styles.tab, activeTab === 'landmarks' && styles.activeTab]}
          onPress={() => setActiveTab('landmarks')}>
          <ThemedText style={[styles.tabText, activeTab === 'landmarks' && styles.activeTabText]}>
            Landmarks
          </ThemedText>
        </Pressable>
        {isSuperAdmin && (
          <Pressable 
            style={[styles.tab, activeTab === 'users' && styles.activeTab]}
            onPress={() => {
              setActiveTab('users');
              console.log('Users Tab - All Users Details:');
              users.forEach(user => {
                console.log({
                  username: user.username,
                  email: user.email,
                  role: user.role || 'user'
                });
              });
            }}
          >
            <ThemedText style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
              Users
            </ThemedText>
          </Pressable>
        )}
        <Pressable 
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}>
          <ThemedText style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending
          </ThemedText>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}>
          <ThemedText style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
            Settings
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.contentContainer}>
        {activeTab === 'landmarks' && (
          <>
            <View style={styles.addLandmarkContainer}>
              <Pressable 
                style={styles.addLandmarkButton}
                onPress={() => setShowAddLandmark(true)}
              >
                <View style={styles.addLandmarkIconContainer}>
                  <Ionicons name="add-circle" size={28} color="#FFF" />
                </View>
                <View style={styles.addLandmarkTextContainer}>
                  <ThemedText style={styles.addLandmarkTitle}>Add New Landmark</ThemedText>
                  <ThemedText style={styles.addLandmarkSubtitle}>Create a new landmark to add to the map</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#FFF" style={styles.addLandmarkArrow} />
              </Pressable>
            </View>
            <FlatList
              data={landmarks.filter(landmark => landmark.status === 'approved')}
              renderItem={renderLandmark}
              keyExtractor={item => item.id}
              contentContainerStyle={responsiveStyles.listContainer}
              numColumns={isLandscape && !isTablet ? 2 : 1}
              key={isLandscape ? 'landscape' : 'portrait'}
              showsVerticalScrollIndicator={false}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={5}
              removeClippedSubviews={true}
              style={styles.scrollView}
              columnWrapperStyle={isLandscape && !isTablet ? { justifyContent: 'space-between' } : undefined}
            />
          </>
        )}
        {activeTab === 'users' && (
          <ScrollView style={styles.listContainer}>
            {isSuperAdmin && (
              <Pressable 
                style={styles.createAdminButton}
                onPress={() => setShowCreateAdmin(true)}
              >
                <Ionicons name="person-add" size={24} color="#FFF" />
                <ThemedText style={styles.createAdminButtonText}>Create Admin</ThemedText>
              </Pressable>
            )}
            {users.map(user => (
              <View key={user.id} style={styles.userCard}>
                <ThemedText style={styles.userName}>{user.username}</ThemedText>
                <ThemedText style={styles.userEmail}>{user.email}</ThemedText>
                <ThemedText style={styles.userRole}>{user.role || 'user'}</ThemedText>
              </View>
            ))}
          </ScrollView>
        )}
        {activeTab === 'pending' && (
          <View style={styles.contentContainer}>
            <FlatList
              data={landmarks.filter(landmark => landmark.status === 'pending')}
              renderItem={renderPendingLandmark}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={5}
              removeClippedSubviews={true}
            />
          </View>
        )}
        {activeTab === 'settings' && renderSettings()}
      </View>

      <Modal
        visible={showAddLandmark}
        animationType="slide"
        transparent={true}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="location" size={28} color="#3498DB" />
                <ThemedText style={styles.modalTitle}>
                  {isEditing ? 'Edit Landmark' : 'Add New Landmark'}
                </ThemedText>
              </View>
              <Pressable 
                onPress={() => {
                  setShowAddLandmark(false);
                  setEditingLandmarkId(null);
                  setIsEditing(false);
                  setNewLandmark({
                    name: '',
                    description: '',
                    location: { latitude: 0, longitude: 0 },
                    status: 'pending',
                  });
                  setSelectedImage('');
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.imageUploadContainer}>
                {selectedImage ? (
                  <Image 
                    source={{ uri: selectedImage }} 
                    style={styles.uploadedImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Pressable 
                    style={styles.imageUploadPlaceholder}
                    onPress={handleImagePick}
                  >
                    <Ionicons name="camera" size={40} color="#3498DB" />
                    <ThemedText style={styles.imageUploadText}>Tap to add image</ThemedText>
                    <ThemedText style={styles.imageUploadSubtext}>16:9 aspect ratio recommended</ThemedText>
                  </Pressable>
                )}
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.inputLabel}>Landmark Name</ThemedText>
                <ThemedTextInput
                  value={newLandmark.name}
                  onChangeText={(text) => setNewLandmark(prev => ({ ...prev, name: text }))}
                  placeholder="Enter landmark name"
                  style={styles.input}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.inputLabel}>Description</ThemedText>
                <ThemedTextInput
                  value={newLandmark.description}
                  onChangeText={(text) => setNewLandmark(prev => ({ ...prev, description: text }))}
                  placeholder="Enter landmark description"
                  style={[styles.input, styles.textArea]}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.inputLabel}>Location</ThemedText>
                <Pressable 
                  style={styles.locationPickerButton}
                  onPress={() => setShowMapPicker(true)}
                >
                  <Ionicons name="map" size={20} color="#3498DB" />
                  <ThemedText style={styles.locationPickerText}>
                    {newLandmark.location?.latitude && newLandmark.location?.longitude
                      ? `${newLandmark.location.latitude.toFixed(4)}, ${newLandmark.location.longitude.toFixed(4)}`
                      : 'Pick location on map'}
                  </ThemedText>
                </Pressable>
              </View>

            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddLandmark(false);
                  setEditingLandmarkId(null);
                  setIsEditing(false);
                  setNewLandmark({
                    name: '',
                    description: '',
                    location: { latitude: 0, longitude: 0 },
                    status: 'pending',
                  });
                  setSelectedImage('');
                }}
              >
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.createButton]}
                onPress={handleAddOrEditLandmark}
                disabled={!newLandmark.name || !newLandmark.description || !selectedImage || !newLandmark.location}
              >
                <ThemedText style={styles.buttonText}>
                  {isEditing ? 'Update Landmark' : 'Add Landmark'}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </ThemedView>
      </Modal>

      <Modal
        visible={showCreateAdmin}
        animationType="slide"
        transparent={true}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Create New Admin User</ThemedText>
              <Pressable 
                onPress={() => setShowCreateAdmin(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.inputLabel}>Admin Email</ThemedText>
                <ThemedTextInput
                  value={newAdmin.email}
                  onChangeText={(text) => setNewAdmin(prev => ({ ...prev, email: text }))}
                  placeholder="Enter admin email"
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.inputLabel}>Admin Username</ThemedText>
                <ThemedTextInput
                  value={newAdmin.username}
                  onChangeText={(text) => setNewAdmin(prev => ({ ...prev, username: text }))}
                  placeholder="Enter admin username"
                  style={styles.input}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.inputLabel}>Admin Password</ThemedText>
                <ThemedTextInput
                  value={newAdmin.password}
                  onChangeText={(text) => setNewAdmin(prev => ({ ...prev, password: text }))}
                  placeholder="Enter admin password"
                  style={styles.input}
                  secureTextEntry
                />
              </View>

              <View style={styles.roleInfo}>
                <ThemedText style={styles.roleInfoText}>
                  This user will be created with admin privileges
                </ThemedText>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCreateAdmin(false)}
                disabled={loading}
              >
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateAdmin}
                disabled={loading}
              >
                <ThemedText style={styles.buttonText}>
                  {loading ? 'Creating Admin...' : 'Create Admin'}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </ThemedView>
      </Modal>

      <Modal
        visible={showMapPicker}
        animationType="slide"
        transparent={true}
      >
        <ThemedView style={styles.mapModalOverlay}>
          <ThemedView style={styles.mapModalContent}>
            <View style={styles.mapModalHeader}>
              <ThemedText style={styles.mapModalTitle}>Pick Location</ThemedText>
              <Pressable 
                onPress={() => setShowMapPicker(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </Pressable>
            </View>

            <MapView
              style={styles.mapPicker}
              initialRegion={{
                latitude: 0,
                longitude: 0,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
              onPress={handleLocationPick}
            >
              {tempLocation.latitude !== 0 && tempLocation.longitude !== 0 && (
                <Marker coordinate={tempLocation} />
              )}
            </MapView>

            <View style={styles.mapModalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowMapPicker(false)}
              >
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmLocation}
                disabled={tempLocation.latitude === 0 && tempLocation.longitude === 0}
              >
                <ThemedText style={styles.buttonText}>Confirm Location</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 15,
    borderRadius: 16,
    backgroundColor: '#FFF',
    padding: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  activeTabText: {
    color: '#FFF',
    fontWeight: '700',
  },
  landmarkCard: {
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  approvedStatus: {
    color: '#059669',
  },
  rejectedStatus: {
    color: '#DC2626',
  },
  pendingStatus: {
    color: '#D97706',
  },
  dateText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  landmarkImage: {
    width: '100%',
    aspectRatio: 4/3,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardContent: {
    padding: 20,
  },
  landmarkName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  landmarkDescription: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 16,
  },
  locationInfo: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  locationText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  signOutButton: {
    backgroundColor: '#E74C3C',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  signOutText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  addLandmarkContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  addLandmarkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    padding: 20,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addLandmarkIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 8,
  },
  addLandmarkTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  addLandmarkTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  addLandmarkSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  addLandmarkArrow: {
    marginLeft: 10,
  },
  editContainer: {
    padding: 20,
  },
  editHeader: {
    marginBottom: 25,
    alignItems: 'center',
  },
  editTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 8,
  },
  editSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  editForm: {
    gap: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    color: '#2C3E50',
  },
  editTextArea: {
    minHeight: 100,
    paddingTop: 15,
  },
  editImageContainer: {
    marginVertical: 15,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  editImage: {
    width: '100%',
    height: 200,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: '#2ECC71',
    flex: 2,
  },
  cancelButton: {
    backgroundColor: '#E74C3C',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2C3E50',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  modalScroll: {
    maxHeight: '70%',
  },
  imageUploadContainer: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E9ECEF',
    borderStyle: 'dashed',
  },
  uploadedImage: {
    width: '100%',
    height: 200,
  },
  imageUploadPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imageUploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3498DB',
    marginTop: 10,
  },
  imageUploadSubtext: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 5,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  locationPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    gap: 10,
  },
  locationPickerText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  statusSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  statusOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    alignItems: 'center',
  },
  statusOptionActive: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7F8C8D',
  },
  statusOptionTextActive: {
    color: '#FFF',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
  },
  createButton: {
    backgroundColor: '#3B82F6',
  },
  addButton: {
    backgroundColor: '#2ECC71',
  },
  confirmButton: {
    backgroundColor: '#3498DB',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  mapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  mapModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2C3E50',
  },
  mapPicker: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  mapModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  roleInfo: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#81C784',
  },
  roleInfoText: {
    color: '#2E7D32',
    fontSize: 14,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  approveButton: {
    backgroundColor: '#E8F5E9',
  },
  rejectButton: {
    backgroundColor: '#FFEBEE',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  locationEditContainer: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  locationMap: {
    width: '100%',
    height: 200,
  },
  coordinatesInputs: {
    flexDirection: 'row',
    gap: 10,
    padding: 15,
    backgroundColor: '#F8F9FA',
  },
  coordinateGroup: {
    flex: 1,
  },
  coordinateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 5,
  },
  coordinateInput: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 14,
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  pendingIconContainer: {
    backgroundColor: '#FCD34D',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pendingIcon: {
    fontSize: 16,
  },
  pendingBannerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
  },
  submissionDate: {
    fontSize: 13,
    color: '#92400E',
    opacity: 0.8,
  },
  pendingContent: {
    padding: 16,
  },
  pendingImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  pendingDetails: {
    gap: 12,
  },
  pendingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  pendingDescription: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  pendingMetadata: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  pendingLocation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  submitterDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metadataLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  reviewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  reviewButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  approveButton: {
    backgroundColor: '#059669',
  },
  rejectButton: {
    backgroundColor: '#DC2626',
  },
  settingsContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  settingsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingLabel: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    gap: 8,
  },
  dangerButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  userEmail: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
  },
  userRole: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
    flex: 1,
  },
  createAdminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  createAdminButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 16,
    color: '#1E293B',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
}); 