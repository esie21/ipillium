import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Pressable } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useRouter } from 'expo-router';
import { UserProgress } from '@/types/gamification';

interface LandmarkDetails {
  id: string;
  name: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [recentLandmarks, setRecentLandmarks] = useState<LandmarkDetails[]>([]);

  useEffect(() => {
    fetchUserProgress();
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

  const fetchLandmarkDetails = async () => {
    if (!userProgress?.visitedLandmarks) return;
    
    try {
      const landmarkPromises = userProgress.visitedLandmarks
        .slice(-3)
        .reverse()
        .map(async (landmarkId) => {
          const landmarkDoc = await getDoc(doc(db, 'landmarks', landmarkId));
          if (landmarkDoc.exists()) {
            return {
              id: landmarkId,
              name: landmarkDoc.data().name
            };
          }
          return null;
        });

      const landmarks = (await Promise.all(landmarkPromises)).filter((l): l is LandmarkDetails => l !== null);
      setRecentLandmarks(landmarks);
    } catch (error) {
      console.error('Error fetching landmark details:', error);
    }
  };

  useEffect(() => {
    if (userProgress) {
      fetchLandmarkDetails();
    }
  }, [userProgress]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <ThemedText style={styles.greeting}>
            Welcome back, {userProgress?.username || 'Explorer'}!
          </ThemedText>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="location" size={24} color="#A1CEDC" />
              <ThemedText style={styles.statNumber}>
                {userProgress?.visitedLandmarks?.length || 0}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Places Visited</ThemedText>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="trophy" size={24} color="#FFD700" />
              <ThemedText style={styles.statNumber}>
                {userProgress?.points || 0}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Points Earned</ThemedText>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="ribbon" size={24} color="#FF6B6B" />
              <ThemedText style={styles.statNumber}>
                {userProgress?.earnedBadges?.length || 0}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Badges</ThemedText>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
          <View style={styles.actionGrid}>
            <Pressable 
              style={styles.actionCard}
              onPress={() => router.push('/map')}
            >
              <Ionicons name="map" size={32} color="#A1CEDC" />
              <ThemedText style={styles.actionText}>Explore Map</ThemedText>
            </Pressable>
            <Pressable 
              style={styles.actionCard}
              onPress={() => router.push('/discover')}
            >
              <Ionicons name="compass" size={32} color="#A1CEDC" />
              <ThemedText style={styles.actionText}>Discover</ThemedText>
            </Pressable>
            <Pressable 
              style={styles.actionCard}
              onPress={() => router.push('/profile')}
            >
              <Ionicons name="person" size={32} color="#A1CEDC" />
              <ThemedText style={styles.actionText}>Profile</ThemedText>
            </Pressable>
            <Pressable 
              style={styles.actionCard}
              onPress={() => {/* TODO: Implement QR Scanner */}}
            >
              <Ionicons name="qr-code" size={32} color="#A1CEDC" />
              <ThemedText style={styles.actionText}>Scan QR</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
          {recentLandmarks.length > 0 ? (
            recentLandmarks.map((landmark) => (
              <View key={landmark.id} style={styles.activityCard}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <View style={styles.activityInfo}>
                  <ThemedText style={styles.activityText}>
                    Visited {landmark.name}
                  </ThemedText>
                  <ThemedText style={styles.activityDate}>Today</ThemedText>
                </View>
              </View>
            ))
          ) : (
            <ThemedText style={styles.emptyText}>No recent visits</ThemedText>
          )}
        </View>

        {/* Tips Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Tips & Tricks</ThemedText>
          <View style={styles.tipCard}>
            <Ionicons name="bulb" size={24} color="#FFD700" />
            <ThemedText style={styles.tipText}>
              Visit landmarks to earn points and unlock special badges!
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  welcomeSection: {
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    margin: 5,
    borderRadius: 12,
    elevation: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 2,
  },
  actionText: {
    marginTop: 10,
    fontSize: 14,
    color: '#333',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
  },
  activityInfo: {
    marginLeft: 15,
    flex: 1,
  },
  activityText: {
    fontSize: 16,
  },
  activityDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },
  tipText: {
    marginLeft: 15,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
});
