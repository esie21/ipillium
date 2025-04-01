import { useState, useEffect } from 'react';
import { Modal, View, StyleSheet, Pressable } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { Quiz, QuizQuestion } from '@/types/gamification';

interface QuizModalProps {
  quiz: Quiz;
  visible: boolean;
  onClose: () => void;
  onComplete: (score: number) => void;
}

export function QuizModal({ quiz, visible, onClose, onComplete }: QuizModalProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(quiz.timeLimit);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (visible && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleQuizComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [visible, timeLeft]);

  const handleAnswer = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    const question = quiz.questions[currentQuestion];
    
    if (answerIndex === question.correctAnswer) {
      setScore(prev => prev + question.points);
    }

    if (currentQuestion < quiz.questions.length - 1) {
      setTimeout(() => {
        setCurrentQuestion(prev => prev + 1);
        setSelectedAnswer(null);
      }, 1000);
    } else {
      handleQuizComplete();
    }
  };

  const handleQuizComplete = () => {
    setIsComplete(true);
    setTimeout(() => {
      onComplete(score);
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <ThemedView style={styles.container}>
        {!isComplete ? (
          <View style={styles.quizContent}>
            <View style={styles.header}>
              <ThemedText style={styles.timer}>{formatTime(timeLeft)}</ThemedText>
              <ThemedText style={styles.progress}>
                Question {currentQuestion + 1}/{quiz.questions.length}
              </ThemedText>
            </View>

            <ThemedText style={styles.question}>
              {quiz.questions[currentQuestion].question}
            </ThemedText>

            <View style={styles.options}>
              {quiz.questions[currentQuestion].options.map((option, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.option,
                    selectedAnswer === index && styles.selectedOption,
                    selectedAnswer !== null && index === quiz.questions[currentQuestion].correctAnswer && 
                    styles.correctOption
                  ]}
                  onPress={() => selectedAnswer === null && handleAnswer(index)}
                >
                  <ThemedText style={styles.optionText}>{option}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.completionScreen}>
            <ThemedText style={styles.completionTitle}>Quiz Complete!</ThemedText>
            <ThemedText style={styles.scoreText}>Score: {score}</ThemedText>
          </View>
        )}
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  quizContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 15,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timer: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  progress: {
    fontSize: 16,
    color: '#666',
  },
  question: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  options: {
    gap: 10,
  },
  option: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#FFD700',
  },
  correctOption: {
    backgroundColor: '#90EE90',
  },
  optionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  completionScreen: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  scoreText: {
    fontSize: 20,
    color: '#666',
  },
}); 