import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QuizAnalytics from './QuizAnalytics';

// Mock the admin analytics service
vi.mock('../services/adminAnalyticsService', () => ({
  loadQuizAnalytics: vi.fn().mockResolvedValue([
    {
      id: 'a1',
      userId: 'user1',
      userName: 'John Doe',
      status: 'COMPLETED',
      percentage: 80,
      totalTimeTaken: 120,
      startedAt: { toMillis: () => 123456789 },
      completedAt: { toMillis: () => 123456909 }
    },
    {
      id: 'a2',
      userId: 'user2',
      userName: 'Jane Smith',
      status: 'COMPLETED',
      percentage: 80,
      totalTimeTaken: 100,
      startedAt: { toMillis: () => 123456800 },
      completedAt: { toMillis: () => 123456900 }
    }
  ])
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
    expect(screen.getAllByText('2').length).toBeGreaterThan(0); // total attempts / unique users
    expect(screen.getByText('80%')).toBeInTheDocument(); // avg score
    
    // Check users list
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });
});
