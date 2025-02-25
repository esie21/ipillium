import { useState, useEffect } from 'react';
import { StyleSheet, Pressable, FlatList, Image, Alert, View, useWindowDimensions, ScrollView, Modal } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { auth, db } from '@/config/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { Landmark } from '@/types/landmarks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { storage } from '@/utils/storage';

type Tab = 'landmarks' | 'users' | 'reports' | 'analytics';

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

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)');
    } else {
      fetchAdminData();
    }
  }, [isAdmin]);

  const fetchAdminData = async () => {
    try {
      // Fetch users
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData = usersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User));
      setUsers(usersData);

      // Fetch landmarks
      const landmarksSnap = await getDocs(collection(db, 'landmarks'));
      const landmarksData = landmarksSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Landmark));
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
        borderRadius: 12,
        backgroundColor: '#FFF',
        padding: 5,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      landmarkCard: {
        marginHorizontal: 20,
        marginVertical: 10,
        backgroundColor: '#fff',
        borderRadius: 15,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        overflow: 'hidden',
      },
      landmarkImage: {
        width: '100%',
        height: isTablet ? 300 : 200,
        borderRadius: 8,
        marginBottom: 10,
      },
      landmarkName: {
        fontSize: 20,
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 8,
      },
      landmarkDescription: {
        fontSize: 15,
        color: '#5D6D7E',
        lineHeight: 22,
        marginBottom: 15,
      },
      buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: isTablet ? 15 : 10,
      },
      button: {
        flex: 1,
        padding: isTablet ? 15 : 10,
        borderRadius: 5,
        alignItems: 'center',
      },
      buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: isTablet ? 16 : 14,
      },
      tab: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 2,
      },
      tabText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#7F8C8D',
      },
      activeTab: {
        backgroundColor: '#3498DB',
      },
      activeTabText: {
        color: '#FFF',
        fontWeight: '600',
      },
      listContainer: {
        paddingBottom: insets.bottom + 20,
        flexDirection: isLandscape && !isTablet ? 'row' : 'column',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
      },
      settingsContainer: {
        flex: 1,
        padding: isTablet ? 30 : 20,
        alignItems: isTablet ? 'center' : 'stretch',
      },
      settingsCard: {
        backgroundColor: '#FFF',
        borderRadius: 15,
        padding: 25,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      settingsTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: '#2C3E50',
        marginBottom: 25,
        textAlign: 'center',
      },
      settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
      },
      settingLabel: {
        fontSize: 16,
        color: '#7F8C8D',
        fontWeight: '500',
      },
      settingValue: {
        fontSize: 16,
        color: '#2C3E50',
        fontWeight: '600',
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
      cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
      },
      statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#f8f9fa',
      },
      pendingBadge: {
        backgroundColor: '#FFF3CD',
        borderWidth: 1,
        borderColor: '#FFE69C',
      },
      approvedBadge: {
        backgroundColor: '#D4EDDA',
        borderWidth: 1,
        borderColor: '#C3E6CB',
      },
      rejectedBadge: {
        backgroundColor: '#F8D7DA',
        borderWidth: 1,
        borderColor: '#F5C6CB',
      },
      cardContent: {
        padding: 20,
      },
      locationInfo: {
        backgroundColor: '#F8F9FA',
        padding: 12,
        borderRadius: 10,
        marginTop: 15,
        borderWidth: 1,
        borderColor: '#E9ECEF',
      },
      locationText: {
        fontSize: 14,
        color: '#5D6D7E',
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
                onPress={() => setEditingLandmark(item)}>
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
              style={[styles.reviewButton, styles.approveButton]}
              onPress={() => handleApprove(item.id)}>
              <ThemedText style={styles.reviewButtonText}>✓ Approve</ThemedText>
            </Pressable>
            <Pressable 
              style={[styles.reviewButton, styles.rejectButton]}
              onPress={() => handleReject(item.id)}>
              <ThemedText style={styles.reviewButtonText}>✕ Reject</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </ThemedView>
  );

  const renderSettings = () => (
    <ThemedView style={responsiveStyles.settingsContainer}>
      <View style={responsiveStyles.settingsCard}>
        <ThemedText style={responsiveStyles.settingsTitle}>Admin Settings</ThemedText>
        
        <ThemedView style={styles.settingItem}>
          <ThemedText style={styles.settingLabel}>Email</ThemedText>
          <ThemedText style={styles.settingValue}>{user?.email}</ThemedText>
        </ThemedView>

        <ThemedView style={styles.settingItem}>
          <ThemedText style={styles.settingLabel}>Role</ThemedText>
          <ThemedText style={styles.settingValue}>Administrator</ThemedText>
        </ThemedView>

        <Pressable 
          style={styles.signOutButton} 
          onPress={() => {
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Sign Out', 
                  style: 'destructive',
                  onPress: () => signOut(auth)
                }
              ]
            );
          }}
        >
          <ThemedText style={responsiveStyles.signOutText}>Sign Out</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
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
        <Pressable 
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}>
          <ThemedText style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
            Users
          </ThemedText>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
          onPress={() => setActiveTab('reports')}>
          <ThemedText style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>
            Reports
          </ThemedText>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
          onPress={() => setActiveTab('analytics')}>
          <ThemedText style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>
            Analytics
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.contentContainer}>
        {activeTab === 'landmarks' && (
          <FlatList
            data={landmarks}
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
          />
        )}
        {activeTab === 'users' && (
          <View style={styles.listContainer}>
            <Pressable 
              style={styles.addButton}
              onPress={() => setShowAddLandmark(true)}
            >
              <Ionicons name="add" size={24} color="white" />
              <ThemedText style={styles.addButtonText}>Add User</ThemedText>
            </Pressable>

            {users.map(user => (
              <View key={user.id} style={styles.userCard}>
                <ThemedText style={styles.userName}>{user.username}</ThemedText>
                <ThemedText style={styles.userEmail}>{user.email}</ThemedText>
                <Pressable 
                  style={styles.deleteButton}
                  onPress={() => handleDeleteUser(user.id)}
                >
                  <Ionicons name="trash" size={24} color="#FF6B6B" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {activeTab === 'reports' && (
          <View style={styles.listContainer}>
            {/* Add report rendering logic here */}
          </View>
        )}
        {activeTab === 'analytics' && (
          <View style={styles.listContainer}>
            {/* Add analytics rendering logic here */}
          </View>
        )}
      </View>

      <Modal
        visible={showAddLandmark}
        animationType="slide"
        transparent={true}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.addLandmarkTitle}>Add Landmark</ThemedText>
              <Pressable 
                onPress={() => setShowAddLandmark(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <ThemedTextInput
                value={newLandmark.name}
                onChangeText={(text) => setNewLandmark(prev => ({ ...prev, name: text }))}
                placeholder="Enter landmark name"
                style={styles.input}
              />
              <ThemedTextInput
                value={newLandmark.description}
                onChangeText={(text) => setNewLandmark(prev => ({ ...prev, description: text }))}
                placeholder="Enter landmark description"
                style={styles.input}
              />
              <ThemedTextInput
                value={newLandmark.location?.latitude.toString() || '0'}
                onChangeText={(text) => {
                  setNewLandmark(prev => ({
                    ...prev,
                    location: {
                      ...prev.location,
                      latitude: parseFloat(text) || 0
                    }
                  }));
                }}
                placeholder="Enter latitude"
                keyboardType="numeric"
                style={styles.input}
              />
              <ThemedTextInput
                value={newLandmark.location?.longitude.toString() || '0'}
                onChangeText={(text) => {
                  setNewLandmark(prev => ({
                    ...prev,
                    location: {
                      ...prev.location,
                      longitude: parseFloat(text) || 0
                    }
                  }));
                }}
                placeholder="Enter longitude"
                keyboardType="numeric"
                style={styles.input}
              />
              <ThemedTextInput
                value={newLandmark.status || 'pending'}
                onChangeText={(text) => {
                  setNewLandmark(prev => ({
                    ...prev,
                    status: text as 'pending' | 'approved' | 'rejected'
                  }));
                }}
                placeholder="Enter status (pending/approved/rejected)"
                style={styles.input}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddLandmark(false)}
              >
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.addButton]}
                onPress={handleAddLandmark}
              >
                <ThemedText style={styles.buttonText}>Add Landmark</ThemedText>
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
    borderRadius: 12,
    backgroundColor: '#FFF',
    padding: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  landmarkCard: {
    marginHorizontal: 20,
    marginVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  landmarkImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  landmarkName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  landmarkDescription: {
    fontSize: 15,
    color: '#5D6D7E',
    lineHeight: 22,
    marginBottom: 15,
  },
  status: {
    color: '#888',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#3498DB',
  },
  deleteButton: {
    backgroundColor: '#E74C3C',
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
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495E',
    marginLeft: 4,
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
    minHeight: 120,
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
  actionButton: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  signOutButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FF6B6B',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutText: {
    color: 'white',
    fontWeight: 'bold',
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  activeTab: {
    backgroundColor: '#3498DB',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#7F8C8D',
  },
  activeTabText: {
    color: '#FFF',
    fontWeight: '600',
  },
  approveButton: {
    backgroundColor: '#2ECC71',
  },
  rejectButton: {
    backgroundColor: '#E74C3C',
  },
  settingsContainer: {
    flex: 1,
    padding: 20,
  },
  settingsCard: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  settingsTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 25,
    textAlign: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  pendingBadge: {
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  approvedBadge: {
    backgroundColor: '#D4EDDA',
    borderWidth: 1,
    borderColor: '#C3E6CB',
  },
  rejectedBadge: {
    backgroundColor: '#F8D7DA',
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  approvedStatus: {
    color: '#198754',
  },
  rejectedStatus: {
    color: '#DC3545',
  },
  pendingStatus: {
    color: '#856404',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  cardContent: {
    padding: 20,
  },
  locationInfo: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  locationText: {
    fontSize: 14,
    color: '#5D6D7E',
  },
  submitterInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  submitterText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  pendingCard: {
    padding: 0,
    overflow: 'hidden',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE69C',
  },
  pendingIconContainer: {
    marginRight: 8,
  },
  pendingIcon: {
    fontSize: 18,
  },
  pendingBannerText: {
    color: '#856404',
    fontWeight: '600',
    fontSize: 14,
  },
  submissionDate: {
    marginLeft: 'auto',
    color: '#856404',
    fontSize: 12,
  },
  pendingContent: {
    padding: 15,
  },
  pendingImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
  },
  pendingDetails: {
    gap: 12,
  },
  pendingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C3E50',
  },
  pendingDescription: {
    fontSize: 15,
    color: '#5D6D7E',
    lineHeight: 22,
  },
  pendingMetadata: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 15,
    gap: 12,
  },
  pendingLocation: {
    gap: 4,
  },
  submitterDetail: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  metadataLabel: {
    fontSize: 13,
    color: '#7F8C8D',
    fontWeight: '600',
  },
  metadataValue: {
    fontSize: 14,
    color: '#2C3E50',
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },
  reviewButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  reviewButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  locationEditContainer: {
    marginTop: 10,
    gap: 15,
  },
  locationMap: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  coordinatesInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  coordinateGroup: {
    flex: 1,
  },
  coordinateLabel: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 5,
  },
  coordinateInput: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  addLandmarkModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addLandmarkTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#3498DB',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userCard: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: '#7F8C8D',
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 8,
  },
  modalScroll: {
    maxHeight: '70%',
  },
  input: {
    marginBottom: 15,
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
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 