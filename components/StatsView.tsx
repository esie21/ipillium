import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { UserStats, ActivityLogEntry } from '@/types/gamification';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

interface StatsViewProps {
  stats: UserStats;
}

export function StatsView({ stats }: StatsViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'achievements'>('overview');

  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      data: [20, 45, 28, 80, 99, 43, 50]
    }]
  };

  const renderActivityItem = (activity: ActivityLogEntry) => (
    <View key={activity.id} style={styles.activityItem}>
      <View style={styles.activityIcon}>
        {activity.type === 'visit' && <ThemedText>🏛️</ThemedText>}
        {activity.type === 'quiz' && <ThemedText>📝</ThemedText>}
        {activity.type === 'photo' && <ThemedText>📸</ThemedText>}
        {activity.type === 'route' && <ThemedText>🗺️</ThemedText>}
        {activity.type === 'badge' && <ThemedText>🏅</ThemedText>}
      </View>
      <View style={styles.activityContent}>
        <ThemedText style={styles.activityTitle}>
          {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
        </ThemedText>
        <ThemedText style={styles.activityDetails}>
          {activity.details.points && `+${activity.details.points} points`}
          {activity.details.score && ` • Score: ${activity.details.score}`}
        </ThemedText>
        <ThemedText style={styles.activityTime}>
          {new Date(activity.timestamp).toLocaleDateString()}
        </ThemedText>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.tabs}>
        {['overview', 'activity', 'achievements'].map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab as any)}>
            <ThemedText style={[
              styles.tabText,
              activeTab === tab && styles.activeTabText
            ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'overview' && (
          <View style={styles.overviewContainer}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{stats.totalVisits}</ThemedText>
                <ThemedText style={styles.statLabel}>Total Visits</ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{stats.totalQuizzes}</ThemedText>
                <ThemedText style={styles.statLabel}>Quizzes Taken</ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{stats.totalPhotos}</ThemedText>
                <ThemedText style={styles.statLabel}>Photos Shared</ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{stats.averageQuizScore}%</ThemedText>
                <ThemedText style={styles.statLabel}>Avg. Quiz Score</ThemedText>
              </View>
            </View>

            <View style={styles.chartContainer}>
              <ThemedText style={styles.chartTitle}>Weekly Activity</ThemedText>
              <LineChart
                data={chartData}
                width={Dimensions.get('window').width - 40}
                height={220}
                chartConfig={{
                  backgroundColor: '#fff',
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
                }}
                bezier
                style={styles.chart}
              />
            </View>
          </View>
        )}

        {activeTab === 'activity' && (
          <View style={styles.activityContainer}>
            {stats.activityLog.map(activity => renderActivityItem(activity))}
          </View>
        )}

        {activeTab === 'achievements' && (
          <View style={styles.achievementsContainer}>
            {stats.achievements.map(achievement => (
              <View key={achievement.category} style={styles.achievementCard}>
                <ThemedText style={styles.achievementCategory}>
                  {achievement.category}
                </ThemedText>
                <ThemedText style={styles.achievementCount}>
                  {achievement.count}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 10,
  },
  tab: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#3498db',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  // ... add remaining styles
}); 