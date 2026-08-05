import { describe, expect, it } from 'vitest';
import {
  createEmptyQuestion,
  getRemainingQuestionTime,
  getQuestionTimeLimit,
  getTotalQuestionTime,
  normalizeQuizLevel,
  normalizeQuizStatus,
  slugifyQuizTitle,
  validateQuizPayload,
} from './quizManagement';

// ─── slugifyQuizTitle ─────────────────────────────────────────────────────────

describe('slugifyQuizTitle', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugifyQuizTitle('Bhagavad Gita Quiz')).toBe('bhagavad-gita-quiz');
  });

  it('collapses multiple spaces to a single hyphen', () => {
    expect(slugifyQuizTitle('Hello   World')).toBe('hello-world');
  });

  it('removes single quotes', () => {
    expect(slugifyQuizTitle("Krishna's Message")).toBe('krishnas-message');
  });

  it('removes double quotes', () => {
    expect(slugifyQuizTitle('"Gita" Basics')).toBe('gita-basics');
  });

  it('replaces special characters with hyphens', () => {
    expect(slugifyQuizTitle('Bhakti & Yoga (Introduction)')).toBe('bhakti-yoga-introduction');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugifyQuizTitle('  !! Quiz !! ')).toBe('quiz');
  });

  it('returns empty string for empty input', () => {
    expect(slugifyQuizTitle('')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(slugifyQuizTitle(null)).toBe('');
  });

  it('handles unicode letters correctly', () => {
    // Non-ASCII letters get stripped (only a-z0-9 allowed)
    expect(slugifyQuizTitle('Ā Chapter 1')).toBe('chapter-1');
  });
});

// ─── normalizeQuizStatus ──────────────────────────────────────────────────────

describe('normalizeQuizStatus', () => {
  it('returns "DRAFT" for valid "DRAFT"', () => {
    expect(normalizeQuizStatus('DRAFT')).toBe('DRAFT');
  });

  it('returns "ACTIVE" for valid "ACTIVE"', () => {
    expect(normalizeQuizStatus('ACTIVE')).toBe('ACTIVE');
  });

  it('normalizes lowercase to uppercase', () => {
    expect(normalizeQuizStatus('draft')).toBe('DRAFT');
  });

  it('returns "DRAFT" for invalid status', () => {
    expect(normalizeQuizStatus('INVALID')).toBe('DRAFT');
  });

  it('returns "DRAFT" for null', () => {
    expect(normalizeQuizStatus(null)).toBe('DRAFT');
  });

  it('returns "DRAFT" for undefined', () => {
    expect(normalizeQuizStatus(undefined)).toBe('DRAFT');
  });

  it('trims whitespace before normalizing', () => {
    expect(normalizeQuizStatus('  ACTIVE  ')).toBe('ACTIVE');
  });
});

// ─── normalizeQuizLevel ───────────────────────────────────────────────────────

describe('normalizeQuizLevel', () => {
  it('returns "BEGINNER" for valid "BEGINNER"', () => {
    expect(normalizeQuizLevel('BEGINNER')).toBe('BEGINNER');
  });

  it('returns "ADVANCED" for valid "ADVANCED"', () => {
    expect(normalizeQuizLevel('ADVANCED')).toBe('ADVANCED');
  });

  it('normalizes lowercase to uppercase', () => {
    expect(normalizeQuizLevel('intermediate')).toBe('INTERMEDIATE');
  });

  it('returns "BEGINNER" for invalid level', () => {
    expect(normalizeQuizLevel('EXPERT')).toBe('BEGINNER');
  });

  it('returns "BEGINNER" for null', () => {
    expect(normalizeQuizLevel(null)).toBe('BEGINNER');
  });
});

// ─── getTotalQuestionTime ─────────────────────────────────────────────────────

describe('getTotalQuestionTime', () => {
  it('sums time of all questions', () => {
    const questions = [{ time: 30 }, { time: 45 }, { time: 60 }];
    expect(getTotalQuestionTime(questions)).toBe(135);
  });

  it('returns 0 for empty array', () => {
    expect(getTotalQuestionTime([])).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(getTotalQuestionTime(undefined)).toBe(0);
  });

  it('handles missing time field as 0', () => {
    const questions = [{ time: 30 }, { text: 'no time' }, { time: 60 }];
    expect(getTotalQuestionTime(questions)).toBe(90);
  });
});

// ─── getRemainingQuestionTime ─────────────────────────────────────────────────

describe('getRemainingQuestionTime', () => {
  it('returns estimated time minus total question time', () => {
    const questions = [{ time: 30 }, { time: 45 }];
    expect(getRemainingQuestionTime(questions, 120)).toBe(45);
  });

  it('returns 0 when question time equals estimated time', () => {
    const questions = [{ time: 60 }, { time: 60 }];
    expect(getRemainingQuestionTime(questions, 120)).toBe(0);
  });

  it('clamps to 0 when question time exceeds estimated time', () => {
    const questions = [{ time: 100 }, { time: 100 }];
    expect(getRemainingQuestionTime(questions, 120)).toBe(0);
  });

  it('returns estimated time when no questions', () => {
    expect(getRemainingQuestionTime([], 90)).toBe(90);
  });
});

// ─── getQuestionTimeLimit ─────────────────────────────────────────────────────

describe('getQuestionTimeLimit', () => {
  it('returns max time for a question (estimated minus other questions)', () => {
    const questions = [{ time: 30 }, { time: 45 }, { time: 60 }];
    // questionIndex=1 (45s). Others = 30 + 60 = 90. Remaining = 120 - 90 = 30
    expect(getQuestionTimeLimit({ estimatedTime: 120, questionIndex: 1, questions })).toBe(30);
  });

  it('returns at least 1 second', () => {
    const questions = [{ time: 119 }, { time: 0 }];
    // questionIndex=1. Others = 119. Remaining = 120 - 119 = 1
    expect(getQuestionTimeLimit({ estimatedTime: 120, questionIndex: 1, questions })).toBe(1);
  });

  it('clamps to 1 when other questions exceed estimated time', () => {
    const questions = [{ time: 150 }, { time: 10 }];
    // questionIndex=1. Others = 150. Remaining = 120 - 150 = -30. Clamp to 1.
    expect(getQuestionTimeLimit({ estimatedTime: 120, questionIndex: 1, questions })).toBe(1);
  });

  it('returns full estimated time when only one question', () => {
    const questions = [{ time: 60 }];
    expect(getQuestionTimeLimit({ estimatedTime: 120, questionIndex: 0, questions })).toBe(120);
  });
});

// ─── createEmptyQuestion ──────────────────────────────────────────────────────

describe('createEmptyQuestion', () => {
  it('generates an id based on index (1-indexed)', () => {
    expect(createEmptyQuestion(0).id).toBe('q1');
    expect(createEmptyQuestion(4).id).toBe('q5');
  });

  it('generates 4 empty options', () => {
    const q = createEmptyQuestion(0);
    expect(q.options).toHaveLength(4);
    expect(q.options.every((o) => o === '')).toBe(true);
  });

  it('sets correctIndex to 0', () => {
    expect(createEmptyQuestion(0).correctIndex).toBe(0);
  });

  it('sets text to empty string', () => {
    expect(createEmptyQuestion(0).text).toBe('');
  });

  it('uses remaining time as time value', () => {
    expect(createEmptyQuestion(0, 45).time).toBe(45);
  });

  it('clamps time to at least 1', () => {
    expect(createEmptyQuestion(0, 0).time).toBe(1);
    expect(createEmptyQuestion(0, -10).time).toBe(1);
  });

  it('creates one reference entry', () => {
    const q = createEmptyQuestion(0);
    expect(Array.isArray(q.references)).toBe(true);
    expect(q.references).toHaveLength(1);
  });
});

// ─── validateQuizPayload ──────────────────────────────────────────────────────

describe('validateQuizPayload — draft mode', () => {
  const basePayload = {
    allowRetake: true,
    category: '',
    description: '',
    estimatedTime: 120,
    expireAt: null,
    imageAlt: '',
    imageUrl: '',
    level: 'BEGINNER',
    publishAt: null,
    questions: [],
    slug: 'test-slug',
    status: 'DRAFT',
    title: 'Test Quiz',
    totalQuestions: 0,
    visualKey: '',
  };

  it('returns no errors for a minimal valid draft', () => {
    const errors = validateQuizPayload(basePayload, { mode: 'draft' });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('errors on missing title', () => {
    const errors = validateQuizPayload({ ...basePayload, title: '' }, { mode: 'draft' });
    expect(errors).toHaveProperty('title');
  });

  it('errors on missing slug', () => {
    const errors = validateQuizPayload({ ...basePayload, slug: '' }, { mode: 'draft' });
    expect(errors).toHaveProperty('slug');
  });

  it('does NOT error on missing description in draft mode', () => {
    const errors = validateQuizPayload({ ...basePayload, description: '' }, { mode: 'draft' });
    expect(errors).not.toHaveProperty('description');
  });

  it('does NOT error on empty questions in draft mode', () => {
    const errors = validateQuizPayload({ ...basePayload, questions: [] }, { mode: 'draft' });
    expect(errors).not.toHaveProperty('questions');
  });
});

describe('validateQuizPayload — publish mode', () => {
  const validQuestion = {
    correctIndex: 0,
    id: 'q1',
    options: ['A', 'B', 'C', 'D'],
    text: 'What is the first chapter of Gita?',
    time: 30,
  };

  const basePublishPayload = {
    allowRetake: true,
    category: 'bhakti',
    description: 'Test description',
    estimatedTime: 120,
    expireAt: null,
    imageAlt: '',
    imageUrl: '',
    level: 'BEGINNER',
    publishAt: null,
    questions: [validQuestion],
    slug: 'test-slug',
    status: 'PUBLISHED',
    title: 'Test Quiz',
    totalQuestions: 1,
    visualKey: '',
  };

  it('returns no errors for a valid publishable quiz', () => {
    const errors = validateQuizPayload(basePublishPayload, { mode: 'publish' });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('errors on missing description when publishing', () => {
    const errors = validateQuizPayload(
      { ...basePublishPayload, description: '' },
      { mode: 'publish' },
    );
    expect(errors).toHaveProperty('description');
  });

  it('errors on missing category when publishing', () => {
    const errors = validateQuizPayload(
      { ...basePublishPayload, category: '' },
      { mode: 'publish' },
    );
    expect(errors).toHaveProperty('category');
  });

  it('errors when no questions when publishing', () => {
    const errors = validateQuizPayload(
      { ...basePublishPayload, questions: [] },
      { mode: 'publish' },
    );
    expect(errors).toHaveProperty('questions');
  });

  it('errors when question time exceeds estimated time', () => {
    const heavyQuestion = { ...validQuestion, time: 200 };
    const errors = validateQuizPayload(
      { ...basePublishPayload, questions: [heavyQuestion], estimatedTime: 120 },
      { mode: 'publish' },
    );
    expect(errors).toHaveProperty('estimatedTime');
  });

  it('errors when publishAt is after expireAt', () => {
    const errors = validateQuizPayload(
      {
        ...basePublishPayload,
        publishAt: new Date('2025-12-01'),
        expireAt: new Date('2025-01-01'),
      },
      { mode: 'publish' },
    );
    expect(errors).toHaveProperty('expireAt');
  });

  it('errors when question has empty text', () => {
    const emptyTextQ = { ...validQuestion, text: '' };
    const errors = validateQuizPayload(
      { ...basePublishPayload, questions: [emptyTextQ] },
      { mode: 'publish' },
    );
    expect(errors).toHaveProperty('question-0-text');
  });

  it('errors when question has fewer than 4 options', () => {
    const shortOptionsQ = { ...validQuestion, options: ['A', 'B'] };
    const errors = validateQuizPayload(
      { ...basePublishPayload, questions: [shortOptionsQ] },
      { mode: 'publish' },
    );
    expect(errors).toHaveProperty('question-0-options');
  });

  it('errors when question has empty option string', () => {
    const emptyOptionQ = { ...validQuestion, options: ['A', 'B', '', 'D'] };
    const errors = validateQuizPayload(
      { ...basePublishPayload, questions: [emptyOptionQ] },
      { mode: 'publish' },
    );
    expect(errors).toHaveProperty('question-0-options');
  });

  it('errors when question has invalid correctIndex', () => {
    const badIndexQ = { ...validQuestion, correctIndex: 5 };
    const errors = validateQuizPayload(
      { ...basePublishPayload, questions: [badIndexQ] },
      { mode: 'publish' },
    );
    expect(errors).toHaveProperty('question-0-correctIndex');
  });

  it('errors when question time is zero', () => {
    const zeroTimeQ = { ...validQuestion, time: 0 };
    const errors = validateQuizPayload(
      { ...basePublishPayload, questions: [zeroTimeQ] },
      { mode: 'publish' },
    );
    expect(errors).toHaveProperty('question-0-time');
  });
});
