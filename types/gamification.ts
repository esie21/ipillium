export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'explorer' | 'photographer' | 'historian' | 'social';
  requirement: number;
  points: number;
  unlocked: boolean;
  progress: number;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'special';
  reward: {
    points: number;
    badgeId?: string;
  };
  requirements: {
    type: 'visits' | 'photos' | 'quiz' | 'route';
    count: number;
    specificLocations?: string[];
  };
  progress: number;
  deadline: string;
  completed: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  points: number;
  badges: number;
  avatar?: string;
  rank?: number;
}

export interface UserProgress {
  points: number;
  visitedLandmarks: string[];
  completedChallenges: string[];
  earnedBadges: string[];
  quizScores: { [landmarkId: string]: number };
  monthlyPoints: number;
  currentStreak: number;
}

export interface Quiz {
  id: string;
  landmarkId: string;
  questions: QuizQuestion[];
  reward: {
    points: number;
    badgeId?: string;
  };
  timeLimit: number; // in seconds
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  points: number;
}

export interface Route {
  id: string;
  name: string;
  description: string;
  landmarks: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number; // in minutes
  reward: {
    points: number;
    badgeId?: string;
  };
}

export interface UserStats {
  totalVisits: number;
  totalQuizzes: number;
  totalPhotos: number;
  averageQuizScore: number;
  completedRoutes: number;
  totalTime: number; // in minutes
  achievements: {
    category: string;
    count: number;
  }[];
  activityLog: ActivityLogEntry[];
}

export interface ActivityLogEntry {
  id: string;
  type: 'visit' | 'quiz' | 'photo' | 'route' | 'badge';
  landmarkId?: string;
  timestamp: string;
  details: {
    points?: number;
    score?: number;
    routeName?: string;
    badgeName?: string;
  };
}

export interface SocialFeatures {
  friends: string[];
  pendingFriends: string[];
  sharedAchievements: SharedAchievement[];
}

export interface SharedAchievement {
  id: string;
  userId: string;
  username: string;
  achievementType: 'badge' | 'challenge' | 'route';
  achievementId: string;
  achievementName: string;
  timestamp: string;
  likes: string[];
  comments: Comment[];
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: string;
} 