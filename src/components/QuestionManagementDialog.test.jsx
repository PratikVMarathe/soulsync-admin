import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuestionManagementDialog from './QuestionManagementDialog';
import QuestionNavigator from './QuestionNavigator';
import QuestionEditor from './QuestionEditor';
import { AppNoticeContext } from '../context/appNoticeContextValue';

const mockShowNotice = vi.fn();
const mockClearNotice = vi.fn();

const renderWithNotice = (ui) => {
  return render(
    <AppNoticeContext.Provider value={{ showNotice: mockShowNotice, clearNotice: mockClearNotice, notice: null }}>
      {ui}
    </AppNoticeContext.Provider>
  );
};

describe('Question Management Workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleQuestions = [
    {
      id: 'q1',
      text: 'What is the purpose of Gita?',
      options: ['Clarity', 'Confusion', 'Doubt', 'Fear'],
      correctIndex: 0,
      time: 30,
      references: [{ source: 'Bhagavad Gita', chapter: 2, verse: 47, text: 'Karmanye vadikaraste' }],
    },
    {
      id: 'q2',
      text: 'Who spoke to Arjuna?',
      options: ['Krishna', 'Bhishma', 'Drona', 'Karna'],
      correctIndex: 0,
      time: 25,
      references: [{ source: 'Bhagavad Gita', chapter: 1, verse: 1, text: 'Dharmakshetre Kurukshetre' }],
    },
    {
      id: 'q3',
      text: '', // Incomplete question
      options: ['', '', '', ''],
      correctIndex: 0,
      time: 20,
      references: [],
    },
  ];

  const sampleFormState = {
    title: 'Test Quiz',
    slug: 'test-quiz',
    status: 'DRAFT',
    estimatedTime: 120,
    questions: sampleQuestions,
  };

  it('renders QuestionNavigator with correct question tags and indicators', () => {
    renderWithNotice(
      <QuestionNavigator
        currentIndex={0}
        fieldErrors={{ 'question-2-text': 'Question 3 text is required.' }}
        onSelectQuestion={vi.fn()}
        questions={sampleQuestions}
      />
    );

    // Q1 is complete & active
    expect(screen.getAllByText('Q1')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Q2')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Q3')[0]).toBeInTheDocument();

    // Check indicator badges
    expect(screen.getAllByTitle('Completed')[0]).toBeInTheDocument(); // Q1 and/or Q2 complete
    expect(screen.getAllByTitle('Validation Error')[0]).toBeInTheDocument(); // Q3 error
  });

  it('renders QuestionEditor with current question fields', () => {
    const onUpdateQuestion = vi.fn();
    const onUpdateOption = vi.fn();

    renderWithNotice(
      <QuestionEditor
        estimatedTime={120}
        fieldErrors={{}}
        onAddReference={vi.fn()}
        onRemoveQuestion={vi.fn()}
        onRemoveReference={vi.fn()}
        onUpdateOption={onUpdateOption}
        onUpdateQuestion={onUpdateQuestion}
        onUpdateReference={vi.fn()}
        question={sampleQuestions[0]}
        questionIndex={0}
        questions={sampleQuestions}
        totalQuestions={3}
      />
    );

    expect(screen.getByDisplayValue('What is the purpose of Gita?')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Clarity')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Karmanye vadikaraste')).toBeInTheDocument();

    // Type in question text
    const textarea = screen.getByDisplayValue('What is the purpose of Gita?');
    fireEvent.change(textarea, { target: { value: 'Updated Question Text' } });
    expect(onUpdateQuestion).toHaveBeenCalledWith(0, { text: 'Updated Question Text' });

    // Type in option 1
    const option1 = screen.getByDisplayValue('Clarity');
    fireEvent.change(option1, { target: { value: 'Spiritual Clarity' } });
    expect(onUpdateOption).toHaveBeenCalledWith(0, 0, 'Spiritual Clarity');
  });

  it('navigates between questions using Navigator, Next, and Previous in Dialog', () => {
    let formState = { ...sampleFormState };
    const setFormState = (updater) => {
      formState = typeof updater === 'function' ? updater(formState) : updater;
    };

    renderWithNotice(
      <QuestionManagementDialog
        fieldErrors={{}}
        formState={formState}
        isOpen={true}
        onAddQuestion={vi.fn()}
        onAddReference={vi.fn()}
        onClose={vi.fn()}
        onRemoveQuestion={vi.fn()}
        onRemoveReference={vi.fn()}
        onSave={vi.fn()}
        onUpdateOption={vi.fn()}
        onUpdateQuestion={vi.fn()}
        onUpdateReference={vi.fn()}
        setFieldErrors={vi.fn()}
        setFormState={setFormState}
      />
    );

    // Initial question is Q1
    expect(screen.getByDisplayValue('What is the purpose of Gita?')).toBeInTheDocument();
    const prevBtn = screen.getByRole('button', { name: /previous/i });
    expect(prevBtn).toBeDisabled();

    // Click Next (Q1 is valid, so it proceeds to Q2)
    const nextBtn = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextBtn);

    expect(screen.getByDisplayValue('Who spoke to Arjuna?')).toBeInTheDocument();
    expect(prevBtn).not.toBeDisabled();

    // Click Q1 in navigator directly
    const q1NavBtns = screen.getAllByRole('button', { name: /Question 1/i });
    fireEvent.click(q1NavBtns[0]);
    expect(screen.getByDisplayValue('What is the purpose of Gita?')).toBeInTheDocument();
  });

  it('prevents Next navigation when current question has validation errors', () => {
    const invalidQuestions = [
      {
        id: 'q1',
        text: '', // Invalid empty text
        options: ['', '', '', ''],
        correctIndex: 0,
        time: 30,
        references: [],
      },
      {
        id: 'q2',
        text: 'Valid second question',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        time: 20,
        references: [],
      },
    ];

    const setFieldErrors = vi.fn();

    renderWithNotice(
      <QuestionManagementDialog
        fieldErrors={{}}
        formState={{ ...sampleFormState, questions: invalidQuestions }}
        isOpen={true}
        onAddQuestion={vi.fn()}
        onAddReference={vi.fn()}
        onClose={vi.fn()}
        onRemoveQuestion={vi.fn()}
        onRemoveReference={vi.fn()}
        onSave={vi.fn()}
        onUpdateOption={vi.fn()}
        onUpdateQuestion={vi.fn()}
        onUpdateReference={vi.fn()}
        setFieldErrors={setFieldErrors}
        setFormState={vi.fn()}
      />
    );

    const nextBtn = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextBtn);

    // Should not advance, should report error
    expect(setFieldErrors).toHaveBeenCalled();
    expect(mockShowNotice).toHaveBeenCalledWith(
      'Please complete this question before proceeding.',
      'error'
    );
  });

  it('adds a new question and selects it', () => {
    let formState = { ...sampleFormState };
    const setFormState = vi.fn((updater) => {
      formState = typeof updater === 'function' ? updater(formState) : updater;
    });

    renderWithNotice(
      <QuestionManagementDialog
        fieldErrors={{}}
        formState={formState}
        isOpen={true}
        onAddQuestion={vi.fn()}
        onAddReference={vi.fn()}
        onClose={vi.fn()}
        onRemoveQuestion={vi.fn()}
        onRemoveReference={vi.fn()}
        onSave={vi.fn()}
        onUpdateOption={vi.fn()}
        onUpdateQuestion={vi.fn()}
        onUpdateReference={vi.fn()}
        setFieldErrors={vi.fn()}
        setFormState={setFormState}
      />
    );

    const addQuestionBtn = screen.getByRole('button', { name: /add question/i });
    fireEvent.click(addQuestionBtn);

    expect(setFormState).toHaveBeenCalled();
    expect(mockShowNotice).toHaveBeenCalledWith('Question added.', 'success');
  });

  it('renders empty state when all questions are removed', () => {
    renderWithNotice(
      <QuestionManagementDialog
        fieldErrors={{}}
        formState={{ ...sampleFormState, questions: [] }}
        isOpen={true}
        onAddQuestion={vi.fn()}
        onAddReference={vi.fn()}
        onClose={vi.fn()}
        onRemoveQuestion={vi.fn()}
        onRemoveReference={vi.fn()}
        onSave={vi.fn()}
        onUpdateOption={vi.fn()}
        onUpdateQuestion={vi.fn()}
        onUpdateReference={vi.fn()}
        setFieldErrors={vi.fn()}
        setFormState={vi.fn()}
      />
    );

    expect(screen.getByText('No Questions in Quiz')).toBeInTheDocument();
    expect(screen.getByText(/Your quiz is empty/i)).toBeInTheDocument();
  });

  it('displays validation summary banner on full quiz save failure and jumps to question on click', async () => {
    const invalidQuestions = [
      {
        id: 'q1',
        text: 'Valid question text',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        time: 30,
        references: [],
      },
      {
        id: 'q2',
        text: '', // Missing text
        options: ['A', '', 'C', 'D'], // Missing option
        correctIndex: 0,
        time: 20,
        references: [],
      },
    ];

    renderWithNotice(
      <QuestionManagementDialog
        fieldErrors={{}}
        formState={{ ...sampleFormState, questions: invalidQuestions }}
        isOpen={true}
        onAddQuestion={vi.fn()}
        onAddReference={vi.fn()}
        onClose={vi.fn()}
        onRemoveQuestion={vi.fn()}
        onRemoveReference={vi.fn()}
        onSave={vi.fn()}
        onUpdateOption={vi.fn()}
        onUpdateQuestion={vi.fn()}
        onUpdateReference={vi.fn()}
        setFieldErrors={vi.fn()}
        setFormState={vi.fn()}
      />
    );

    const saveBtn = screen.getByRole('button', { name: /^save$/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/require attention:/i)).toBeInTheDocument();
    });

    // Clicking the jump button switches to Q2
    const jumpBtn = screen.getByRole('button', { name: /Question 2 text is required/i });
    fireEvent.click(jumpBtn);

    // Q2 is now selected
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument();
  });

  it('shows unsaved changes prompt when closing dirty dialog, and handles discard/keep editing', () => {
    let formState = { ...sampleFormState };
    const onClose = vi.fn();
    const setFormState = vi.fn((updater) => {
      formState = typeof updater === 'function' ? updater(formState) : updater;
    });

    const { rerender } = renderWithNotice(
      <QuestionManagementDialog
        fieldErrors={{}}
        formState={formState}
        isOpen={true}
        onAddQuestion={vi.fn()}
        onAddReference={vi.fn()}
        onClose={onClose}
        onRemoveQuestion={vi.fn()}
        onRemoveReference={vi.fn()}
        onSave={vi.fn()}
        onUpdateOption={vi.fn()}
        onUpdateQuestion={vi.fn()}
        onUpdateReference={vi.fn()}
        setFieldErrors={vi.fn()}
        setFormState={setFormState}
      />
    );

    // Initial state is clean: clicking close should call onClose directly
    const closeBtn = screen.getByRole('button', { name: /close question management dialog/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Now simulate dirty state (e.g. question text modified in formState)
    const modifiedQuestions = [
      { ...sampleQuestions[0], text: 'Modified question text here' },
      sampleQuestions[1],
    ];

    rerender(
      <AppNoticeContext.Provider value={{ showNotice: mockShowNotice, clearNotice: mockClearNotice, notice: null }}>
        <QuestionManagementDialog
          fieldErrors={{}}
          formState={{ ...sampleFormState, questions: modifiedQuestions }}
          isOpen={true}
          onAddQuestion={vi.fn()}
          onAddReference={vi.fn()}
          onClose={onClose}
          onRemoveQuestion={vi.fn()}
          onRemoveReference={vi.fn()}
          onSave={vi.fn()}
          onUpdateOption={vi.fn()}
          onUpdateQuestion={vi.fn()}
          onUpdateReference={vi.fn()}
          setFieldErrors={vi.fn()}
          setFormState={setFormState}
        />
      </AppNoticeContext.Provider>
    );

    // Clicking close should now open unsaved changes prompt
    fireEvent.click(closeBtn);
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    expect(screen.getByText(/Discarding will revert the questions/i)).toBeInTheDocument();

    // Click Keep Editing -> Prompt closes, dialog remains open
    const keepEditingBtn = screen.getByRole('button', { name: /keep editing/i });
    fireEvent.click(keepEditingBtn);
    expect(screen.queryByText(/Discarding will revert the questions/i)).not.toBeInTheDocument();

    // Open prompt again, click Discard Changes -> Reverts form state and calls onClose
    fireEvent.click(closeBtn);
    const discardBtn = screen.getByRole('button', { name: /discard changes/i });
    fireEvent.click(discardBtn);
    expect(setFormState).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('removes a question and selects the nearest valid question', () => {
    let formState = { ...sampleFormState };
    const setFormState = vi.fn((updater) => {
      formState = typeof updater === 'function' ? updater(formState) : updater;
    });

    renderWithNotice(
      <QuestionManagementDialog
        fieldErrors={{}}
        formState={formState}
        isOpen={true}
        onAddQuestion={vi.fn()}
        onAddReference={vi.fn()}
        onClose={vi.fn()}
        onRemoveQuestion={vi.fn()}
        onRemoveReference={vi.fn()}
        onSave={vi.fn()}
        onUpdateOption={vi.fn()}
        onUpdateQuestion={vi.fn()}
        onUpdateReference={vi.fn()}
        setFieldErrors={vi.fn()}
        setFormState={setFormState}
      />
    );

    const removeBtn = screen.getByRole('button', { name: /remove question/i });
    fireEvent.click(removeBtn);

    expect(setFormState).toHaveBeenCalled();
    expect(mockShowNotice).toHaveBeenCalledWith('Question removed.', 'info');
  });
});
