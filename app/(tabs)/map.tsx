import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, Modal, Pressable, Image, Alert, Linking, ScrollView } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, getDocs, GeoPoint, doc, getDoc, updateDoc, setDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { storage } from '@/utils/storage';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { useAuth } from '@/contexts/AuthContext';
import { landmarks as predefinedLandmarks } from '@/data/landmarks';
import Ionicons from '@expo/vector-icons/Ionicons';
import { UserProgress } from '@/types/gamification';

interface Landmark {
  id: string;
  name: string;
  description: string;
  image: string;
  location: {
    latitude: number;
    longitude: number;
  };
  isPreset?: boolean;
  userId?: string;
  createdAt?: string;
}

interface Location {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const IPIL_REGION = {
  latitude: 7.7844,
  longitude: 122.5935,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const MAX_DISTANCE_KM = 50; // Maximum distance from Ipil in kilometers
const VISIT_DISTANCE_THRESHOLD = 100; // 100 meters instead of 50
const LOCATION_CHECK_INTERVAL = 10000; // Check every 10 seconds instead of 30

const BADGE_CHALLENGES = [
  {
    id: 'explorer-novice',
    name: 'Explorer Novice',
    icon: '🗺️',
    requirement: 3,
    description: 'Visit 3 different landmarks',
    tips: [
      'Open the map to find nearby landmarks',
      'Get within 100 meters of a landmark to register a visit',
      'Visit any 3 unique landmarks to earn this badge'
    ]
  },
  {
    id: 'explorer-intermediate',
    name: 'Explorer Pro',
    icon: '🌟',
    requirement: 10,
    description: 'Visit 10 different landmarks',
    tips: [
      'Explore different areas of Ipil',
      'Use the map directions feature to find your way',
      'Historical sites and monuments count towards this badge'
    ]
  },
  {
    id: 'explorer-master',
    name: 'Master Explorer',
    icon: '👑',
    requirement: 20,
    description: 'Visit 20 different landmarks',
    tips: [
      'Visit landmarks in all areas of Ipil',
      'Try to visit both historical and modern landmarks',
      'Share your discoveries with other explorers'
    ]
  }
];

export default function MapScreen() {
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [isAddingLandmark, setIsAddingLandmark] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newLandmark, setNewLandmark] = useState({
    name: '',
    description: '',
    image: '',
    location: IPIL_REGION,
  });
  const [selectedLocation, setSelectedLocation] = useState<Location>(IPIL_REGION);
  const [manualCoords, setManualCoords] = useState({
    latitude: '',
    longitude: ''
  });
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [userProgress, setUserProgress] = useState<UserProgress>({
    points: 0,
    visitedLandmarks: [],
    completedChallenges: [],
    earnedBadges: [],
    quizScores: {},
    monthlyPoints: 0,
    currentStreak: 0
  });

  // Memoize predefined landmarks transformation
  const transformedPredefinedLandmarks = useMemo(() => 
    predefinedLandmarks.map(landmark => ({
      id: landmark.id,
      name: landmark.name,
      description: landmark.description,
      image: landmark.images[0] || '',
      location: {
        latitude: landmark.location.latitude,
        longitude: landmark.location.longitude,
      },
      isPreset: true,
    })), []
  );

  // Use useCallback for functions to prevent unnecessary re-renders
  const fetchLandmarks = useCallback(async () => {
    try {
      let userLandmarks: Landmark[] = [];
      
      try {
        const landmarksCollection = collection(db, 'landmarks');
        const snapshot = await getDocs(landmarksCollection);
        userLandmarks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isPreset: false,
        })) as Landmark[];
      } catch (firestoreError) {
        console.error('Error fetching from Firestore:', firestoreError);
      }

      setLandmarks([...transformedPredefinedLandmarks, ...userLandmarks]);
    } catch (error) {
      console.error('Error in fetchLandmarks:', error);
      setLandmarks(transformedPredefinedLandmarks);
    }
  }, [transformedPredefinedLandmarks]);

  // Initialize location and landmarks
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission denied', 'Location permission is required');
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // Reduce accuracy for better performance
        });
        
        if (mounted) {
          setLocation(currentLocation);
          fetchLandmarks();
        }
      } catch (error) {
        console.error('Error initializing:', error);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchLandmarks]);

  const handleMapPress = (event: any) => {
    if (isAddingLandmark) {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      const newLocation = {
        latitude,
        longitude,
        latitudeDelta: IPIL_REGION.latitudeDelta,
        longitudeDelta: IPIL_REGION.longitudeDelta
      };
      setSelectedLocation(newLocation);
      setNewLandmark(prev => ({
        ...prev,
        location: newLocation
      }));
    }
  };

  const handleAddLandmark = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to add landmarks');
      return;
    }

    if (!newLandmark.name || !newLandmark.description || !newLandmark.image) {
      Alert.alert('Error', 'Please fill in all fields and select a location');
      return;
    }

    setIsLoading(true);
    try {
      const storedImage = await storage.saveImage(newLandmark.image, {
        userId: user.uid,
        description: newLandmark.description
      });

      const landmarkData = {
        name: newLandmark.name,
        description: newLandmark.description,
        image: storedImage.uri,
        location: new GeoPoint(selectedLocation.latitude, selectedLocation.longitude),
        status: 'pending',
        userId: user.uid,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'landmarks'), landmarkData);
      
      Alert.alert('Success', 'Landmark submitted for review');
      setIsAddingLandmark(false);
      setNewLandmark({
        name: '',
        description: '',
        image: '',
        location: IPIL_REGION,
      });
      setSelectedLocation(IPIL_REGION);
    } catch (error) {
      console.error('Error adding landmark:', error);
      Alert.alert('Error', 'Failed to add landmark');
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      setIsLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
        aspect: [4, 3]
      });

      if (!result.canceled) {
        setNewLandmark(prev => ({
          ...prev,
          image: result.assets[0].uri
        }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setIsLoading(false);
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
        aspect: [4, 3]
      });

      if (!result.canceled) {
        setNewLandmark(prev => ({
          ...prev,
          image: result.assets[0].uri
        }));
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const getDirections = (landmark: Landmark) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${landmark.location.latitude},${landmark.location.longitude}`;
    Linking.openURL(url);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in kilometers
  };

  // Memoize the markers to prevent unnecessary re-renders
  const mapMarkers = useMemo(() => 
    landmarks.map(landmark => (
      <Marker
        key={landmark.id}
        coordinate={{
          latitude: landmark.location.latitude,
          longitude: landmark.location.longitude,
        }}
        onPress={() => setSelectedLandmark(landmark)}
        pinColor={landmark.isPreset ? '#A1CEDC' : '#FF6B6B'}
      />
    )), [landmarks]
  );

  const handleManualLocation = () => {
    const lat = parseFloat(manualCoords.latitude);
    const lng = parseFloat(manualCoords.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Error', 'Please enter valid coordinates');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('Error', 'Coordinates out of range');
      return;
    }

    const newLocation = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: IPIL_REGION.latitudeDelta,
      longitudeDelta: IPIL_REGION.longitudeDelta
    };

    setSelectedLocation(newLocation);
    setNewLandmark(prev => ({
      ...prev,
      location: newLocation
    }));
  };

  const renderImagePicker = () => (
    <View style={styles.imagePickerContainer}>
      {newLandmark.image ? (
        <View style={styles.selectedImageContainer}>
          <Image 
            source={{ uri: newLandmark.image }} 
            style={styles.selectedImage} 
          />
          <Pressable 
            style={styles.removeImageButton}
            onPress={() => setNewLandmark(prev => ({ ...prev, image: '' }))}>
              <Ionicons name="close-circle" size={24} color="white" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.imagePickerButtons}>
            <Pressable style={styles.pickButton} onPress={pickImage}>
              <Ionicons name="images" size={24} color="#666" />
              <ThemedText style={styles.pickButtonText}>Choose Photo</ThemedText>
            </Pressable>
            <Pressable style={styles.pickButton} onPress={takePhoto}>
              <Ionicons name="camera" size={24} color="#666" />
              <ThemedText style={styles.pickButtonText}>Take Photo</ThemedText>
            </Pressable>
          </View>
        )}
    </View>
  );

  const fetchUserProgress = async () => {
    if (!user) return;
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        setUserProgress(userDoc.data() as UserProgress);
      }
    } catch (error) {
      console.error('Error fetching user progress:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserProgress();
    }
  }, [user]);

  const checkNearbyLandmarks = async () => {
    if (!user || isCheckingLocation) return;

    try {
      setIsCheckingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Location permission denied');
        Alert.alert('Permission Denied', 'Location permission is required to track visits.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      console.log('Current location:', location.coords);
      setUserLocation(location);

      const userDocRef = doc(db, 'users', user.uid);

      // Use a transaction to ensure data consistency
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists()) {
          throw new Error("User document doesn't exist!");
        }

        const userData = userDoc.data() as UserProgress;
        const visitedLandmarks = userData.visitedLandmarks || [];
        const earnedBadges = userData.earnedBadges || [];

        // Check distance to each landmark
        const nearbyLandmarks = landmarks.filter(landmark => {
          const distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            landmark.location.latitude,
            landmark.location.longitude
          ) * 1000; // Convert km to meters
          console.log(`Distance to ${landmark.name}: ${distance.toFixed(2)} meters`);
          return distance <= VISIT_DISTANCE_THRESHOLD;
        });

        console.log('Nearby landmarks:', nearbyLandmarks.length);
        console.log('Current visited landmarks:', visitedLandmarks);

        // Filter out landmarks that haven't been visited yet
        const newVisits = nearbyLandmarks.filter(
          landmark => !visitedLandmarks.includes(landmark.id)
        );

        console.log('New visits:', newVisits.length);

        if (newVisits.length > 0) {
          const updatedVisits = [...visitedLandmarks, ...newVisits.map(l => l.id)];
          const pointsEarned = newVisits.length * 50;

          // Check for new badges based on total visits
          const totalVisits = updatedVisits.length;
          let newBadges: string[] = [];

          // Define visit milestones and their corresponding badges
          const visitMilestones = [
            { count: 3, badgeId: 'explorer-novice' },
            { count: 10, badgeId: 'explorer-intermediate' },
            { count: 20, badgeId: 'explorer-master' }
          ];

          // Check each milestone
          visitMilestones.forEach(milestone => {
            if (totalVisits >= milestone.count && !earnedBadges.includes(milestone.badgeId)) {
              newBadges.push(milestone.badgeId);
            }
          });

          // Update user progress with new visits and badges
          const updatedProgress = {
            ...userData,
            visitedLandmarks: updatedVisits,
            points: (userData.points || 0) + pointsEarned,
            monthlyPoints: (userData.monthlyPoints || 0) + pointsEarned,
            earnedBadges: [...earnedBadges, ...newBadges]
          };

          await transaction.update(userDocRef, updatedProgress);
          setUserProgress(updatedProgress);

          // Show achievement alerts
          if (newBadges.length > 0) {
            const badgeNames = newBadges.map(badgeId => {
              const badge = BADGE_CHALLENGES.find(b => b.id === badgeId);
              return badge?.name || badgeId;
            });

            setTimeout(() => {
              Alert.alert(
                'New Badge Earned!',
                `Congratulations! You've earned:\n${badgeNames.join('\n')}`
              );
            }, 1000);
          }

          Alert.alert(
            'New Places Discovered!',
            `You've discovered ${newVisits.length} new landmark${newVisits.length > 1 ? 's' : ''}!\n` +
            `+${pointsEarned} points earned!`
          );
        }
      });

    } catch (error) {
      console.error('Error checking nearby landmarks:', error);
      Alert.alert('Error', 'Failed to update progress. Please try again.');
    } finally {
      setIsCheckingLocation(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const locationInterval = setInterval(checkNearbyLandmarks, LOCATION_CHECK_INTERVAL);
    // Initial check
    checkNearbyLandmarks();

    return () => {
      clearInterval(locationInterval);
    };
  }, [user, landmarks]);

  const ChallengesModal = () => (
    <Modal
      visible={showChallenges}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowChallenges(false)}
    >
      <ThemedView style={styles.challengeModalContainer}>
        <ThemedView style={styles.challengeModalContent}>
          <ThemedText style={styles.modalTitle}>Badge Challenges</ThemedText>
          <ScrollView 
            style={styles.challengeScroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {BADGE_CHALLENGES.map(challenge => (
              <ThemedView key={challenge.id} style={styles.challengeCard}>
                <View style={styles.challengeHeader}>
                  <ThemedText style={styles.challengeIcon}>{challenge.icon}</ThemedText>
                  <ThemedText style={styles.challengeName}>{challenge.name}</ThemedText>
                </View>
                
                <ThemedText style={styles.challengeDescription}>
                  {challenge.description}
                </ThemedText>
                
                <ThemedText style={styles.requirementText}>
                  Progress: {userProgress?.visitedLandmarks?.length || 0}/{challenge.requirement} landmarks
                </ThemedText>
                
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${Math.min(((userProgress?.visitedLandmarks?.length || 0) / challenge.requirement) * 100, 100)}%` 
                      }
                    ]} 
                  />
                </View>

                <ThemedText style={styles.tipsHeader}>Tips:</ThemedText>
                {challenge.tips.map((tip, index) => (
                  <ThemedText key={index} style={styles.tipText}>
                    • {tip}
                  </ThemedText>
                ))}
              </ThemedView>
            ))}
          </ScrollView>

          <Pressable
            style={styles.closeModalButton}
            onPress={() => setShowChallenges(false)}
          >
            <ThemedText style={styles.closeButtonText}>Close</ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={IPIL_REGION}
        showsUserLocation
        showsMyLocationButton
        maxZoomLevel={18} // Limit max zoom for better performance
        minZoomLevel={10} // Set minimum zoom
        onPress={handleMapPress}
      >
        {mapMarkers}

        {/* Show temporary marker when adding new landmark */}
        {isAddingLandmark && (
          <Marker
            coordinate={{
              latitude: selectedLocation.latitude,
              longitude: selectedLocation.longitude,
            }}
            pinColor="#4CAF50"
          />
        )}
      </MapView>

      <Pressable
        style={styles.addButton}
        onPress={() => setIsAddingLandmark(true)}>
        <ThemedText style={styles.addButtonText}>Add Landmark</ThemedText>
      </Pressable>

      {/* Add Landmark Modal */}
      <Modal
        visible={isAddingLandmark}
        animationType="slide"
        transparent={true}
      >
        <ThemedView style={styles.modalContainer}>
          <ScrollView 
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
          >
            <ThemedView style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>Add New Landmark</ThemedText>
              
              <ThemedText style={styles.instruction}>
                Tap on the map to place the landmark marker
              </ThemedText>

              {/* Show selected coordinates */}
              <ThemedView style={styles.coordinatesContainer}>
                <ThemedText style={styles.coordinatesText}>
                  Selected Location:
                </ThemedText>
                <ThemedText style={styles.coordinates}>
                  Latitude: {selectedLocation.latitude.toFixed(6)}
                </ThemedText>
                <ThemedText style={styles.coordinates}>
                  Longitude: {selectedLocation.longitude.toFixed(6)}
                </ThemedText>

                <ThemedText style={[styles.coordinatesText, { marginTop: 15 }]}>
                  Enter Coordinates Manually:
                </ThemedText>
                <ThemedView style={styles.coordInputContainer}>
                  <ThemedTextInput
                    placeholder="Latitude"
                    value={manualCoords.latitude}
                    onChangeText={(text) => setManualCoords(prev => ({ ...prev, latitude: text }))}
                    style={styles.coordInput}
                    keyboardType="numeric"
                  />
                  <ThemedTextInput
                    placeholder="Longitude"
                    value={manualCoords.longitude}
                    onChangeText={(text) => setManualCoords(prev => ({ ...prev, longitude: text }))}
                    style={styles.coordInput}
                    keyboardType="numeric"
                  />
                  <Pressable 
                    style={styles.updateButton}
                    onPress={handleManualLocation}
                  >
                    <ThemedText style={styles.updateButtonText}>Update</ThemedText>
                  </Pressable>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.addLandmarkForm}>
                <ThemedTextInput
                  placeholder="Landmark Name"
                  value={newLandmark.name}
                  onChangeText={(text) => setNewLandmark(prev => ({ ...prev, name: text }))}
                  style={styles.input}
                />
                <ThemedTextInput
                  placeholder="Description"
                  value={newLandmark.description}
                  onChangeText={(text) => setNewLandmark(prev => ({ ...prev, description: text }))}
                  style={styles.input}
                  multiline
                />
                {renderImagePicker()}
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.button, styles.submitButton]}
                    onPress={handleAddLandmark}
                    disabled={isLoading}
                  >
                    <ThemedText style={styles.buttonText}>
                      {isLoading ? 'Adding...' : 'Add Landmark'}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => {
                      setIsAddingLandmark(false);
                      setNewLandmark({
                        name: '',
                        description: '',
                        image: '',
                        location: IPIL_REGION,
                      });
                    }}
                  >
                    <ThemedText style={styles.buttonText}>Cancel</ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            </ThemedView>
          </ScrollView>
        </ThemedView>
      </Modal>

      {/* Landmark Details Modal */}
      <Modal
        visible={!!selectedLandmark}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedLandmark(null)}>
        <View style={styles.detailsModalContainer}>
          <ThemedView style={styles.detailsContent}>
            {selectedLandmark && (
              <>
                <Image source={{ uri: selectedLandmark.image }} style={styles.landmarkImage} />
                <ThemedText type="title" style={styles.landmarkName}>
                  {selectedLandmark.name}
                </ThemedText>
                <ThemedText style={styles.landmarkDescription}>
                  {selectedLandmark.description}
                </ThemedText>
                
                <Pressable
                  style={styles.directionsButton}
                  onPress={() => getDirections(selectedLandmark)}>
                  <ThemedText style={styles.directionsButtonText}>
                    Get Directions
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={styles.closeButton}
                  onPress={() => setSelectedLandmark(null)}>
                  <ThemedText style={styles.closeButtonText}>Close</ThemedText>
                </Pressable>
              </>
            )}
          </ThemedView>
        </View>
      </Modal>

      <Pressable
        style={styles.challengesButton}
        onPress={() => setShowChallenges(true)}
      >
        <ThemedText style={styles.challengesButtonText}>View Badge Challenges</ThemedText>
      </Pressable>

      <ChallengesModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#A1CEDC',
    padding: 15,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalScroll: {
    maxHeight: '80%',
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 15,
  },
  imagePreviewContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
  },
  removeImageButton: {
    backgroundColor: '#FF6B6B',
    padding: 10,
    borderRadius: 5,
  },
  removeImageText: {
    color: 'white',
    fontWeight: 'bold',
  },
  imageButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginVertical: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#A1CEDC',
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  detailsModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  detailsContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  landmarkImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 15,
  },
  landmarkName: {
    fontSize: 20,
    marginBottom: 10,
  },
  landmarkDescription: {
    marginBottom: 20,
  },
  directionsButton: {
    backgroundColor: '#A1CEDC',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  directionsButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  closeButtonText: {
    color: '#666',
  },
  coordinatesContainer: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  coordinatesText: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  coordinates: {
    color: '#666',
  },
  coordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 10,
  },
  coordInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  updateButton: {
    backgroundColor: '#A1CEDC',
    padding: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  imagePickerContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  imagePickerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  pickButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pickButtonText: {
    fontSize: 16,
    color: '#666',
  },
  selectedImageContainer: {
    position: 'relative',
  },
  selectedImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  addLandmarkForm: {
    marginBottom: 20,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  challengesButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#A1CEDC',
    padding: 10,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  challengesButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  challengeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  challengeIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  challengeName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  challengeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  requirementText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 15,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#A1CEDC',
    borderRadius: 4,
  },
  tipsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    marginBottom: 3,
  },
  challengeModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  challengeScroll: {
    marginVertical: 20,
  },
  closeModalButton: {
    backgroundColor: '#A1CEDC',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
}); 