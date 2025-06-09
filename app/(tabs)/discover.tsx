import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Pressable, Image, View, useWindowDimensions, Alert } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Challenge, LeaderboardEntry, UserProgress } from '@/types/gamification';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import * as Location from 'expo-location';

interface NearbyLandmark {
  id: string;
  name: string;
  distance: number;
  location: {
    latitude: number;
    longitude: number;
  };
}

const VISIT_BADGES = [
  {
    id: 'explorer-novice',
    name: 'Explorer Novice',
    icon: '🗺️',
    requirement: 3,
    points: 100,
    category: 'explorer',
    description: 'Visit your first 3 landmarks'
  },
  {
    id: 'explorer-intermediate',
    name: 'Explorer Pro',
    icon: '🌟',
    requirement: 10,
    points: 250,
    category: 'explorer',
    description: 'Visit 10 different landmarks'
  },
  {
    id: 'explorer-master',
    name: 'Master Explorer',
    icon: '👑',
    requirement: 20,
    points: 500,
    category: 'explorer',
    description: 'Visit 20 different landmarks'
  }
] as const;

export default function DiscoverScreen() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<'challenges' | 'leaderboard' | 'badges'>('challenges');
  const [userProgress, setUserProgress] = useState<UserProgress>({
    points: 0,
    visitedLandmarks: [],
    completedChallenges: [],
    earnedBadges: [],
    quizScores: {},
    monthlyPoints: 0,
    currentStreak: 0
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [showAchievement, setShowAchievement] = useState(false);
  const [latestAchievement, setLatestAchievement] = useState<Badge | null>(null);
  const [nearbyLandmarks, setNearbyLandmarks] = useState<NearbyLandmark[]>([]);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserProgress();
      fetchLeaderboard();
      fetchChallenges();
      fetchBadges();
    }
  }, [user]);

  const fetchUserProgress = async () => {
    try {
      const userDocRef = doc(db, 'users', user!.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        setUserProgress(userDocSnap.data() as UserProgress);
      } else {
        // Initialize new user progress
        const initialProgress: UserProgress = {
          points: 0,
          visitedLandmarks: [],
          completedChallenges: [],
          earnedBadges: [],
          quizScores: {},
          monthlyPoints: 0,
          currentStreak: 0
        };
        await setDoc(userDocRef, initialProgress);
        setUserProgress(initialProgress);
      }
    } catch (error) {
      console.error('Error fetching user progress:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        orderBy('monthlyPoints', 'desc'),
        limit(10)
      );
      
      const snapshot = await getDocs(q);
      const leaderboardData: LeaderboardEntry[] = [];
      
      snapshot.docs.forEach((doc, index) => {
        const userData = doc.data();
        leaderboardData.push({
          userId: doc.id,
          username: userData.username || 'Anonymous',
          points: userData.monthlyPoints || 0,
          badges: userData.earnedBadges?.length || 0,
          avatar: userData.avatar,
          rank: index + 1
        });
      });
      
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const fetchChallenges = async () => {
    try {
      const now = new Date();
      const challengesRef = collection(db, 'challenges');
      
      // Simpler query that doesn't require a composite index
      const q = query(
        challengesRef,
        where('deadline', '>', now.toISOString())
      );
      
      const snapshot = await getDocs(q);
      const challengesData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(challenge => !challenge.completed) as Challenge[]; // Filter client-side instead
      
      setActiveChallenges(challengesData);
    } catch (error) {
      console.error('Error fetching challenges:', error);
    }
  };

  const fetchBadges = async () => {
    try {
      const badgesRef = collection(db, 'badges');
      const snapshot = await getDocs(badgesRef);
      
      const badgesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Badge[];
      
      setBadges(badgesData);
    } catch (error) {
      console.error('Error fetching badges:', error);
    }
  };

  const checkAchievements = async (type: 'visits' | 'photos' | 'quiz') => {
    const relevantBadges = badges.filter(badge => 
      !userProgress.earnedBadges.includes(badge.id) && 
      badge.category === type
    );

    for (const badge of relevantBadges) {
      if (badge.progress >= badge.requirement) {
        // Award badge
        const updatedProgress = {
          ...userProgress,
          points: userProgress.points + badge.points,
          earnedBadges: [...userProgress.earnedBadges, badge.id]
        };
        
        await updateDoc(doc(db, 'users', user!.uid), updatedProgress);
        setUserProgress(updatedProgress);
        setLatestAchievement(badge);
        setShowAchievement(true);
      }
    }
  };

  const VISIT_DISTANCE_THRESHOLD = 50; // meters

  const checkNearbyLandmarks = async () => {
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location services to discover nearby landmarks.');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);

      // Fetch all landmarks
      const landmarksRef = collection(db, 'landmarks');
      const snapshot = await getDocs(landmarksRef);
      
      const landmarks = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter(landmark => !userProgress.visitedLandmarks.includes(landmark.id));

      // Calculate distances and filter nearby landmarks
      const nearby = landmarks
        .map(landmark => ({
          id: landmark.id,
          name: landmark.name,
          location: landmark.location,
          distance: getDistance(
            location.coords.latitude,
            location.coords.longitude,
            landmark.location.latitude,
            landmark.location.longitude
          )
        }))
        .filter(landmark => landmark.distance <= VISIT_DISTANCE_THRESHOLD)
        .sort((a, b) => a.distance - b.distance);

      setNearbyLandmarks(nearby);

      // If there are nearby unvisited landmarks, mark them as visited
      if (nearby.length > 0) {
        const updatedVisited = [...userProgress.visitedLandmarks];
        let pointsEarned = 0;

        nearby.forEach(landmark => {
          if (!updatedVisited.includes(landmark.id)) {
            updatedVisited.push(landmark.id);
            pointsEarned += 50;
          }
        });

        if (pointsEarned > 0) {
          // Check for badges based on total visits
          const totalVisits = updatedVisited.length;
          const newBadges = VISIT_BADGES.filter(badge => 
            !userProgress.earnedBadges.includes(badge.id) && 
            totalVisits >= badge.requirement
          );

          const updatedProgress = {
            ...userProgress,
            visitedLandmarks: updatedVisited,
            points: userProgress.points + pointsEarned,
            monthlyPoints: userProgress.monthlyPoints + pointsEarned,
            earnedBadges: [...userProgress.earnedBadges, ...newBadges.map(b => b.id)]
          };

          // Update user progress in Firestore
          await updateDoc(doc(db, 'users', user!.uid), updatedProgress);
          setUserProgress(updatedProgress);

          // Show achievement popup for each new badge
          if (newBadges.length > 0) {
            // Show the highest tier badge earned
            const highestBadge = newBadges[newBadges.length - 1];
            setLatestAchievement({
              ...highestBadge,
              progress: totalVisits,
              unlocked: true
            });
            setShowAchievement(true);
          }

          // Show discovery alert
          Alert.alert(
            'New Places Discovered!',
            `You've discovered ${nearby.length} new landmark${nearby.length > 1 ? 's' : ''}!\n` +
            `+${pointsEarned} points earned!${newBadges.length > 0 ? '\n\nNew badge(s) unlocked!' : ''}`
          );
        }
      }
    } catch (error) {
      console.error('Error checking nearby landmarks:', error);
      Alert.alert(
        'Error',
        'Failed to update progress. Please check your internet connection.'
      );
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        checkNearbyLandmarks();
      }
    }, [user, userProgress.visitedLandmarks])
  );

  return (
    <ThemedView style={styles.container}>
      {/* User Stats Header */}
      <View style={styles.userStats}>
        <View style={styles.pointsContainer}>
          <ThemedText style={styles.pointsText}>{userProgress.points}</ThemedText>
          <ThemedText style={styles.pointsLabel}>POINTS</ThemedText>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>{userProgress.visitedLandmarks.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Visited</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>{userProgress.earnedBadges.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Badges</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>{userProgress.currentStreak}</ThemedText>
            <ThemedText style={styles.statLabel}>Day Streak</ThemedText>
          </View>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabs}>
        {['challenges', 'leaderboard', 'badges'].map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeSection === tab && styles.activeTab]}
            onPress={() => setActiveSection(tab as any)}>
            <ThemedText style={[styles.tabText, activeSection === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {activeSection === 'challenges' && (
          <View style={styles.challengesContainer}>
            {activeChallenges.map(challenge => (
              <View key={challenge.id} style={styles.challengeCard}>
                <View style={styles.challengeHeader}>
                  <ThemedText style={styles.challengeTitle}>{challenge.title}</ThemedText>
                  <View style={styles.rewardBadge}>
                    <ThemedText style={styles.rewardText}>+{challenge.reward.points} pts</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.challengeDescription}>{challenge.description}</ThemedText>
                <View style={styles.progressBar}>
                  <View 
                    style={[styles.progressFill, 
                      { width: `${(challenge.progress / challenge.requirements.count) * 100}%` }
                    ]} 
                  />
                </View>
                <ThemedText style={styles.progressText}>
                  {challenge.progress}/{challenge.requirements.count}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        {activeSection === 'leaderboard' && (
          <View style={styles.leaderboardContainer}>
            {leaderboard.map((entry, index) => (
              <View 
                key={entry.userId} 
                style={[
                  styles.leaderboardRow,
                  entry.userId === user?.uid && styles.currentUserRow
                ]}
              >
                <ThemedText style={styles.rankText}>#{index + 1}</ThemedText>
                <Image 
                  source={{ uri: entry.avatar }} 
                  style={styles.avatarImage}
                />
                <ThemedText style={styles.username}>{entry.username}</ThemedText>
                <ThemedText style={styles.points}>{entry.points}</ThemedText>
              </View>
            ))}
          </View>
        )}

        {activeSection === 'badges' && (
          <View style={styles.badgesContainer}>
            {badges.map(badge => (
              <View key={badge.id} style={styles.badgeCard}>
                <View style={[
                  styles.badgeIcon,
                  userProgress.earnedBadges.includes(badge.id) && styles.unlockedBadge
                ]}>
                  <ThemedText style={styles.badgeEmoji}>{badge.icon}</ThemedText>
                </View>
                <ThemedText style={styles.badgeName}>{badge.name}</ThemedText>
                <ThemedText style={styles.badgeDescription}>{badge.description}</ThemedText>
                <View style={styles.progressBar}>
                  <View style={[
                    styles.progressFill,
                    { width: `${(badge.progress / badge.requirement) * 100}%` }
                  ]} />
                </View>
                <ThemedText style={styles.progressText}>
                  {badge.progress}/{badge.requirement}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Achievement Popup */}
      {showAchievement && latestAchievement && (
        <View style={styles.achievementOverlay}>
          <View style={styles.achievementPopup}>
            <ThemedText style={styles.achievementEmoji}>{latestAchievement.icon}</ThemedText>
            <ThemedText style={styles.achievementTitle}>New Badge Unlocked!</ThemedText>
            <ThemedText style={styles.achievementName}>{latestAchievement.name}</ThemedText>
            <ThemedText style={styles.achievementDescription}>
              {latestAchievement.description}
            </ThemedText>
            <ThemedText style={styles.achievementPoints}>+{latestAchievement.points} points</ThemedText>
            <Pressable 
              style={styles.achievementButton}
              onPress={() => setShowAchievement(false)}>
              <ThemedText style={styles.achievementButtonText}>Awesome!</ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  userStats: {
    padding: 20,
  },
  pointsContainer: {
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  pointsLabel: {
    fontSize: 16,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  tab: {
    padding: 10,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  tabText: {
    fontSize: 16,
  },
  activeTabText: {
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  challengesContainer: {
    padding: 20,
  },
  challengeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  rewardBadge: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    padding: 5,
  },
  rewardText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  challengeDescription: {
    fontSize: 14,
    color: '#666',
  },
  progressBar: {
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    height: 10,
    marginTop: 10,
  },
  progressFill: {
    backgroundColor: '#FFD700',
    borderRadius: 5,
    height: '100%',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  leaderboardContainer: {
    padding: 20,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  currentUserRow: {
    backgroundColor: '#f0f0f0',
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  points: {
    
    fontSize: 14,
    color: '#666',
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 15,
  },
  badgeCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  badgeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  unlockedBadge: {
    backgroundColor: '#FFD700',
  },
  badgeEmoji: {
    fontSize: 30,
  },
  badgeName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 5,
  },
  badgeDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  achievementOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementPopup: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    width: '80%',
    maxWidth: 300,
  },
  achievementEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  achievementTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  achievementDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  achievementPoints: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  achievementButton: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    padding: 10,
  },
  achievementButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
