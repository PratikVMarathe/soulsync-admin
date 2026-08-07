import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QuizAnalytics from './QuizAnalytics';

// Mock the admin analytics service
vi.mock('../services/adminAnalyticsService', () => ({
  loadQuizAnalytics: vi.fn().mockResolvedValue({
    users: [
      {
        userId: 'user1',
        userName: 'John Doe',
        status: 'COMPLETED',
        latestScore: 8,
        bestScore: 9,
        attempts: [{ id: 'a1' }],
        lastAttemptDate: 123456789
      }
    ],
    stats: {
      totalAttempts: 10,
      uniqueUsers: 5,
      avgScore: 80,
      completionRate: 90,
      avgTime: '02:00',
      passRate: 75
    }
  })
}));

describe('QuizAnalytics Component', () => {
  it('renders loading state initially', () => {
    render(<QuizAnalytics quiz={{ slug: 'test-quiz', title: 'Test Quiz' }} onBack={() => {}} />);
    expect(screen.getByText('Loading Analytics...')).toBeInTheDocument();
  });

  it('renders analytics dashboard after loading', async () => {
    render(<QuizAnalytics quiz={{ slug: 'test-quiz', title: 'Test Quiz' }} onBack={() => {}} />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading Analytics...')).not.toBeInTheDocument();
    });

    // Check stats
    expect(screen.getByText('10')).toBeInTheDocument(); // total attempts
    expect(screen.getByText('5')).toBeInTheDocument(); // unique users
    expect(screen.getByText('80%')).toBeInTheDocument(); // avg score
    
    // Check users list
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
