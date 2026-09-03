import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import QuizSequenceDialog from './QuizSequenceDialog';

const mockQuizzes = [
  { id: 'quiz-1', title: 'Concept 1: Focus', category: 'Wisdom', status: 'ACTIVE', sequence: 2 },
  { id: 'quiz-2', title: 'Concept 2: Peace', category: 'Mind', status: 'ACTIVE', sequence: 1 },
  { id: 'quiz-3', title: 'Concept 3: Detachment', category: 'Karma', status: 'DRAFT', sequence: null },
];

describe('QuizSequenceDialog Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <QuizSequenceDialog isOpen={false} quizzes={mockQuizzes} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders quizzes sorted by initial sequence', () => {
    render(
      <QuizSequenceDialog isOpen={true} quizzes={mockQuizzes} onClose={vi.fn()} onSave={vi.fn()} />
    );

    expect(screen.getByRole('heading', { name: /manage quiz sequence/i })).toBeInTheDocument();
    
    // Quiz 2 has sequence 1, Quiz 1 has sequence 2, Quiz 3 has sequence null
    const badges = screen.getAllByText(/#\d+/);
    expect(badges).toHaveLength(3);
    expect(badges[0]).toHaveTextContent('#1');
    expect(badges[1]).toHaveTextContent('#2');
    expect(badges[2]).toHaveTextContent('#3');
  });

  it('allows reordering quizzes using Up/Down arrow buttons and saving the new sequence', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <QuizSequenceDialog
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        quizzes={mockQuizzes}
      />
    );

    // Initial order: Concept 2 (#1), Concept 1 (#2), Concept 3 (#3)
    // Move Concept 1 up to #1
    const moveUpButtons = screen.getAllByRole('button', { name: /move .* up/i });
    // First item move up is disabled
    expect(moveUpButtons[0]).toBeDisabled();
    
    // Second item (Concept 1) move up is enabled
    await user.click(moveUpButtons[1]);

    // Now click Save Sequence
    const saveButton = screen.getByRole('button', { name: /save sequence/i });
    await user.click(saveButton);

    expect(handleSave).toHaveBeenCalledTimes(1);
    const savedPayload = handleSave.mock.calls[0][0];
    expect(savedPayload).toEqual([
      { id: 'quiz-1', sequence: 1, title: 'Concept 1: Focus' },
      { id: 'quiz-2', sequence: 2, title: 'Concept 2: Peace' },
      { id: 'quiz-3', sequence: 3, title: 'Concept 3: Detachment' },
    ]);
  });
});
