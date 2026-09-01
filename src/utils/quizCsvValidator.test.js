import { describe, expect, it } from 'vitest';
import { validateAndGroupQuizRows } from './quizCsvValidator';

function createRow(override = {}, rowNumber = 2) {
  return {
    data: {
      allowRetake: 'true',
      category: 'focus',
      correctIndex: '0',
      description: 'Learn to maintain clarity during stressful situations.',
      estimatedMinutes: '1',
      expireAt: '',
      imageAlt: 'Person meditating',
      imageUrl: '',
      level: 'BEGINNER',
      option1: 'Practice mindfulness',
      option2: 'Avoid thinking',
      option3: 'Ignore stress',
      option4: 'Overwork',
      questionId: 'q1',
      questionText: 'How can one maintain focus during stressful situations?',
      referenceChapter: '6',
      referenceSource: 'Bhagavad Gita',
      referenceText: 'The restless mind can be controlled.',
      referenceVerse: '35',
      slug: 'focus',
      status: 'ACTIVE',
      time: '30',
      title: 'Concept 1: Focus',
      visualKey: 'focus-lake',
      ...override,
    },
    rowNumber,
  };
}

describe('quizCsvValidator', () => {
  it('validates and groups 1 valid quiz with 1 question', () => {
    const rows = [createRow()];
    const result = validateAndGroupQuizRows(rows);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.quizzes).toHaveLength(1);
    expect(result.totalQuestionsCount).toBe(1);

    const quiz = result.quizzes[0];
    expect(quiz.title).toBe('Concept 1: Focus');
    expect(quiz.slug).toBe('focus');
    expect(quiz.estimatedTime).toBe(60);
    expect(quiz.totalQuestions).toBe(1);
    expect(quiz.publishAt).toBeInstanceOf(Date);
    expect(quiz.questions[0].id).toBe('q1');
    expect(quiz.questions[0].correctIndex).toBe(0);
    expect(quiz.questions[0].options).toEqual([
      'Practice mindfulness',
      'Avoid thinking',
      'Ignore stress',
      'Overwork',
    ]);
    expect(quiz.questions[0].references[0]).toEqual({
      chapter: 6,
      source: 'Bhagavad Gita',
      text: 'The restless mind can be controlled.',
      verse: 35,
    });
  });

  it('validates 1 quiz with 20 questions', () => {
    const rows = Array.from({ length: 20 }, (_, i) => (
      createRow({
        estimatedMinutes: '10',
        questionId: `q${i + 1}`,
        questionText: `Question ${i + 1}`,
        time: '25',
      }, i + 2)
    ));

    const result = validateAndGroupQuizRows(rows);
    expect(result.isValid).toBe(true);
    expect(result.quizzes).toHaveLength(1);
    expect(result.quizzes[0].questions).toHaveLength(20);
    expect(result.totalQuestionsCount).toBe(20);
  });

  it('groups multiple quizzes correctly (focus, jnana, bhakti)', () => {
    const rows = [
      createRow({ questionId: 'q1', slug: 'focus', title: 'Focus' }, 2),
      createRow({ questionId: 'q2', slug: 'focus', title: 'Focus' }, 3),
      createRow({ category: 'jnana', questionId: 'q1', slug: 'jnana', title: 'Jnana' }, 4),
      createRow({ category: 'bhakti', questionId: 'q1', slug: 'bhakti', title: 'Bhakti' }, 5),
    ];

    const result = validateAndGroupQuizRows(rows);
    expect(result.isValid).toBe(true);
    expect(result.quizzes).toHaveLength(3);
    expect(result.quizzes[0].slug).toBe('focus');
    expect(result.quizzes[0].questions).toHaveLength(2);
    expect(result.quizzes[1].slug).toBe('jnana');
    expect(result.quizzes[1].questions).toHaveLength(1);
    expect(result.quizzes[2].slug).toBe('bhakti');
    expect(result.quizzes[2].questions).toHaveLength(1);
  });

  it('detects invalid correctIndex (e.g. 5 or not an integer)', () => {
    const rows = [createRow({ correctIndex: '5' })];
    const result = validateAndGroupQuizRows(rows);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'correctIndex')).toBe(true);
  });

  it('detects missing options', () => {
    const rows = [createRow({ option3: '' })];
    const result = validateAndGroupQuizRows(rows);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'options')).toBe(true);
  });

  it('detects duplicate questionId within the same quiz', () => {
    const rows = [
      createRow({ questionId: 'q1' }, 2),
      createRow({ questionId: 'q1' }, 3),
    ];
    const result = validateAndGroupQuizRows(rows);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'questionId' && e.message.includes('duplicate'))).toBe(true);
  });

  it('detects metadata mismatch between rows of the same quiz', () => {
    const rows = [
      createRow({ questionId: 'q1', title: 'Concept 1: Focus' }, 2),
      createRow({ questionId: 'q2', title: 'Concept 1: Focus Changed' }, 3),
    ];
    const result = validateAndGroupQuizRows(rows);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'title' && e.message.includes('inconsistent'))).toBe(true);
  });

  it('detects existing slug in database', () => {
    const existingSlugs = new Set(['focus']);
    const rows = [createRow({ slug: 'focus' }, 2)];
    const result = validateAndGroupQuizRows(rows, existingSlugs);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'slug' && e.message.includes('already exists in Firestore'))).toBe(true);
  });

  it('detects invalid slug formatting', () => {
    const rows = [createRow({ slug: 'Focus Quiz Invalid!' })];
    const result = validateAndGroupQuizRows(rows);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'slug' && e.message.includes('invalid characters'))).toBe(true);
  });

  it('detects when question timer exceeds estimated quiz time', () => {
    const rows = [
      createRow({ estimatedMinutes: '1', time: '90' }),
    ];
    const result = validateAndGroupQuizRows(rows);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'estimatedMinutes' && e.message.includes('exceed'))).toBe(true);
  });

  it('extracts imagePath and validates metadata consistency for imagePath', () => {
    const rows = [
      createRow({ imagePath: 'images/focus.png', questionId: 'q1' }, 2),
      createRow({ imagePath: 'images/focus.png', questionId: 'q2' }, 3),
    ];
    const result = validateAndGroupQuizRows(rows);

    expect(result.isValid).toBe(true);
    expect(result.quizzes[0].imagePath).toBe('images/focus.png');
  });
});
