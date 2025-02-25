import { StyleSheet, Image, View, Pressable, Alert, Switch, ScrollView, Modal, TextInput } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { auth, db } from '@/config/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { UserProgress } from '@/types/gamification';
import * as ImagePicker from 'expo-image-picker';
import { storage } from '@/utils/storage';

interface LandmarkDetails {
  id: string;
  name: string;
  description?: string;
  visitedAt?: string;
  image?: string;
}

// Define props interface for EditProfileModal
interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  username: string;
  setUsername: (username: string) => void;
  avatar: string;
  setAvatar: (avatar: string) => void;
  isUploading: boolean;
  onPickImage: () => Promise<void>;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recentLandmarks, setRecentLandmarks] = useState<LandmarkDetails[]>([]);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newAvatar, setNewAvatar] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const APP_VERSION = '1.0.0';

  useEffect(() => {
    const loadUserProgress = async () => {
      await fetchUserProgress();
    };

    loadUserProgress();
  }, []);

  const fetchUserProgress = async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserProgress(userDoc.data() as UserProgress);
      }
    } catch (error) {
      console.error('Error fetching user progress:', error);
    }
  };

  const fetchVisitedLandmarks = async () => {
    if (!userProgress?.visitedLandmarks) return;
    
    try {
      const visitedLandmarkIds = userProgress.visitedLandmarks;
      const landmarksData: LandmarkDetails[] = [];

      for (const landmarkId of visitedLandmarkIds) {
        const landmarkDoc = await getDoc(doc(db, 'landmarks', landmarkId));
        if (landmarkDoc.exists()) {
          const data = landmarkDoc.data();
          landmarksData.push({
            id: landmarkId,
            name: data.name,
            description: data.description,
            visitedAt: new Date().toLocaleDateString(),
            image: data.image
          });
        }
      }

      setRecentLandmarks(landmarksData);
    } catch (error) {
      console.error('Error fetching landmark details:', error);
    }
  };

  useEffect(() => {
    const loadRecentLandmarks = async () => {
      if (userProgress) {
        await fetchVisitedLandmarks();
      }
    };

    loadRecentLandmarks();
  }, [userProgress]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets[0].uri) {
        setNewAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUploading(true);

    try {
      let avatarUrl = userProgress?.avatar || '';

      if (newAvatar) {
        const uploadedImage = await storage.saveImage(newAvatar, {
          userId: user.uid,
          type: 'avatar'
        });
        avatarUrl = uploadedImage.uri;
      }

      const updates: any = {};
      if (newUsername.trim()) updates.username = newUsername.trim();
      if (avatarUrl) updates.avatar = avatarUrl;

      await updateDoc(doc(db, 'users', user.uid), updates);
      await fetchUserProgress(); // Refresh user data
      setShowEditProfile(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {userProgress?.avatar ? (
                <Image 
                  source={{ uri: userProgress.avatar }} 
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={40} color="#666" />
              )}
            </View>
          </View>
          
          <ThemedText style={styles.username}>
            {userProgress?.username || 'Anonymous'}
          </ThemedText>
          <ThemedText style={styles.email}>{user?.email}</ThemedText>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>
              {userProgress?.visitedLandmarks?.length || 0}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Visited</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>
              {userProgress?.points || 0}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Points</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>
              {userProgress?.earnedBadges?.length || 0}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Badges</ThemedText>
          </View>
        </View>

        <View style={styles.visitedSection}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Visited Landmarks</ThemedText>
            <ThemedText style={styles.visitCount}>
              {recentLandmarks.length} places
            </ThemedText>
          </View>
          
          {recentLandmarks.length > 0 ? (
            <ScrollView 
              style={styles.visitedList}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
            >
              {recentLandmarks.map((landmark) => (
                <View key={landmark.id} style={styles.visitedItem}>
                  <View style={styles.visitedLeft}>
                    <Ionicons name="location" size={24} color="#A1CEDC" />
                    <View style={styles.visitedInfo}>
                      <ThemedText style={styles.landmarkName}>{landmark.name}</ThemedText>
                      {landmark.description && (
                        <ThemedText numberOfLines={1} style={styles.landmarkDescription}>
                          {landmark.description}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                  <ThemedText style={styles.visitedDate}>{landmark.visitedAt}</ThemedText>
                </View>
              ))}
            </ScrollView>
          ) : (
            <ThemedText style={styles.emptyText}>No landmarks visited yet</ThemedText>
          )}
        </View>

        <View style={styles.achievementsSection}>
          <ThemedText style={styles.sectionTitle}>Achievements</ThemedText>
          <View style={styles.badgeGrid}>
            {userProgress?.earnedBadges.slice(0, 4).map((badgeId) => (
              <View key={badgeId} style={styles.badgeItem}>
                <View style={styles.badgeIcon}>
                  <Ionicons name="trophy" size={24} color="#FFD700" />
                </View>
                <ThemedText style={styles.badgeText}>{badgeId}</ThemedText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.settingsSection}>
          <ThemedText style={styles.sectionTitle}>Settings</ThemedText>
          
          <Pressable style={styles.settingItem} onPress={() => setShowEditProfile(true)}>
            <View style={styles.settingLeft}>
              <Ionicons name="person-circle-outline" size={24} color="#666" />
              <ThemedText style={styles.settingText}>Edit Profile</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </Pressable>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={24} color="#666" />
              <ThemedText style={styles.settingText}>Notifications</ThemedText>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#767577', true: '#A1CEDC' }}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="moon-outline" size={24} color="#666" />
              <ThemedText style={styles.settingText}>Dark Mode</ThemedText>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={setIsDarkMode}
              trackColor={{ false: '#767577', true: '#A1CEDC' }}
            />
          </View>

          <Pressable style={styles.settingItem} onPress={() => {/* TODO: Help */}}>
            <View style={styles.settingLeft}>
              <Ionicons name="help-circle-outline" size={24} color="#666" />
              <ThemedText style={styles.settingText}>Help & Support</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </Pressable>

          <Pressable style={styles.settingItem} onPress={() => {/* TODO: Privacy */}}>
            <View style={styles.settingLeft}>
              <Ionicons name="shield-outline" size={24} color="#666" />
              <ThemedText style={styles.settingText}>Privacy Policy</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </Pressable>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="information-circle-outline" size={24} color="#666" />
              <ThemedText style={styles.settingText}>App Version</ThemedText>
            </View>
            <ThemedText style={styles.versionText}>{APP_VERSION}</ThemedText>
          </View>

          <Pressable 
            style={[styles.settingItem, styles.dangerItem]} 
            onPress={() => setShowDeleteConfirm(true)}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
              <ThemedText style={styles.dangerText}>Delete Account</ThemedText>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <Pressable onPress={handleSignOut} style={styles.signOutButton}>
        <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
      </Pressable>

      <EditProfileModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        onSave={handleUpdateProfile}
        username={newUsername}
        setUsername={setNewUsername}
        avatar={newAvatar}
        setAvatar={setNewAvatar}
        isUploading={isUploading}
        onPickImage={pickImage}
      />
    </ThemedView>
  );
}

// Update the EditProfileModal component
const EditProfileModal = ({
  visible,
  onClose,
  onSave,
  username,
  setUsername,
  avatar,
  setAvatar,
  isUploading,
  onPickImage
}: EditProfileModalProps) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
  >
    <ThemedView style={styles.modalOverlay}>
      <ThemedView style={styles.modalContent}>
        <ThemedText style={styles.modalTitle}>Edit Profile</ThemedText>

        <Pressable style={styles.avatarUpload} onPress={onPickImage}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarPreview} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="camera" size={30} color="#666" />
              <ThemedText style={styles.avatarText}>Change Photo</ThemedText>
            </View>
          )}
        </Pressable>

        <TextInput
          placeholder="New Username"
          value={username}
          onChangeText={setUsername}
          style={[styles.usernameInput, {
            color: '#000000',
            backgroundColor: '#FFFFFF'
          }]}
          placeholderTextColor="#999"
        />

        <View style={styles.modalButtons}>
          <Pressable 
            style={[styles.modalButton, styles.cancelButton]}
            onPress={() => {
              onClose();
              setUsername('');
              setAvatar('');
            }}
          >
            <ThemedText style={styles.buttonText}>Cancel</ThemedText>
          </Pressable>

          <Pressable 
            style={[styles.modalButton, styles.saveButton]}
            onPress={onSave}
            disabled={isUploading}
          >
            <ThemedText style={styles.buttonText}>
              {isUploading ? 'Saving...' : 'Save'}
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </ThemedView>
  </Modal>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#A1CEDC',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  signOutButton: {
    backgroundColor: '#FF6B6B',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    margin: 20,
  },
  signOutText: {
    color: 'white',
    fontWeight: 'bold',
  },
  settingsSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
  },
  visitedSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    marginHorizontal: 20,
    maxHeight: 300,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  visitCount: {
    color: '#666',
    fontSize: 14,
  },
  visitedList: {
    maxHeight: 250,
  },
  visitedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  visitedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  visitedInfo: {
    marginLeft: 12,
    flex: 1,
  },
  landmarkName: {
    fontSize: 16,
    fontWeight: '500',
  },
  landmarkDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  visitedDate: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  achievementsSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    marginHorizontal: 20,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badgeItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 15,
  },
  badgeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  badgeText: {
    fontSize: 12,
    textAlign: 'center',
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#FF6B6B',
    fontSize: 16,
  },
  versionText: {
    color: '#666',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    paddingVertical: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  avatarUpload: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    marginTop: 5,
    color: '#666',
    fontSize: 14,
  },
  usernameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#A1CEDC',
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
}); 