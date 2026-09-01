import {
  DEFAULT_ESTIMATED_TIME_SECONDS,
  DEFAULT_QUIZ_FORM,
  DEFAULT_REFERENCE,
  QUESTION_OPTION_COUNT,
  QUIZ_LEVEL_OPTIONS,
  QUIZ_LEVELS,
  QUIZ_STATUSES,
  QUIZ_STATUS_OPTIONS,
} from '../constants/quizManagement';

export function slugifyQuizTitle(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatQuizStatusLabel(status) {
  return String(status || QUIZ_STATUSES.DRAFT)
    .split('_')
    .map((token) => token.charAt(0) + token.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeQuizStatus(status) {
  const normalizedStatus = String(status || '').trim().toUpperCase();
  return QUIZ_STATUS_OPTIONS.includes(normalizedStatus)
    ? normalizedStatus
    : QUIZ_STATUSES.DRAFT;
}

export function normalizeQuizLevel(level) {
  const normalizedLevel = String(level || '').trim().toUpperCase();
  return QUIZ_LEVEL_OPTIONS.includes(normalizedLevel)
    ? normalizedLevel
    : QUIZ_LEVELS.BEGINNER;
}

export function timestampToInputValue(value) {
  if (!value) return '';

  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

export function inputValueToDate(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeOptionValue(value) {
  return String(value || '').trim();
}

export function createEmptyQuestion(index, remainingTime = DEFAULT_ESTIMATED_TIME_SECONDS) {
  return {
    correctIndex: 0,
    id: `q${index + 1}`,
    options: Array.from({ length: QUESTION_OPTION_COUNT }, () => ''),
    references: [{ ...DEFAULT_REFERENCE }],
    text: '',
    time: Math.max(1, Number(remainingTime) || 1),
  };
}

export function normalizeQuestionForForm(question = {}, index = 0, fallbackTime = 30) {
  const options = Array.from({ length: QUESTION_OPTION_COUNT }, (_, optionIndex) => (
    normalizeOptionValue(question.options?.[optionIndex])
  ));

  const references = Array.isArray(question.references) && question.references.length
    ? question.references.map((reference) => ({
        chapter: reference?.chapter ?? '',
        source: reference?.source || '',
        text: reference?.text || '',
        verse: reference?.verse ?? '',
      }))
    : [{ ...DEFAULT_REFERENCE }];

  return {
    correctIndex: Number.isInteger(Number(question.correctIndex))
      ? Math.min(Math.max(Number(question.correctIndex), 0), QUESTION_OPTION_COUNT - 1)
      : 0,
    id: question.id || `q${index + 1}`,
    options,
    references,
    text: question.text || question.prompt || '',
    time: Math.max(1, Number(question.time || question.timeLimitSeconds || fallbackTime) || fallbackTime),
  };
}

export function quizToFormState(quiz = {}) {
  const questions = Array.isArray(quiz.questions)
    ? quiz.questions.map((question, index) => normalizeQuestionForForm(question, index))
    : [];

  return {
    ...DEFAULT_QUIZ_FORM,
    allowRetake: quiz.allowRetake !== false,
    category: quiz.category || '',
    description: quiz.description || '',
    estimatedTime: Math.max(
      1,
      Number(quiz.estimatedTime || (Number(quiz.estimatedMinutes) ? Number(quiz.estimatedMinutes) * 60 : 0)) || DEFAULT_ESTIMATED_TIME_SECONDS,
    ),
    expireAt: timestampToInputValue(quiz.expireAt),
    imageAlt: quiz.imageAlt || '',
    imageUrl: quiz.imageUrl || '',
    level: normalizeQuizLevel(quiz.level),
    publishAt: timestampToInputValue(quiz.publishAt),
    questions,
    slug: quiz.slug || slugifyQuizTitle(quiz.title),
    status: normalizeQuizStatus(quiz.status),
    title: quiz.title || '',
    visualKey: quiz.visualKey || '',
  };
}

export function getTotalQuestionTime(questions = []) {
  return questions.reduce((total, question) => total + (Number(question.time) || 0), 0);
}

export function getRemainingQuestionTime(questions = [], estimatedTime = DEFAULT_ESTIMATED_TIME_SECONDS) {
  return Math.max(0, Number(estimatedTime) - getTotalQuestionTime(questions));
}

export function getQuestionTimeLimit({ estimatedTime, questionIndex, questions }) {
  const otherQuestionsTime = questions.reduce((total, question, index) => (
    index === questionIndex ? total : total + (Number(question.time) || 0)
  ), 0);

  return Math.max(1, Number(estimatedTime) - otherQuestionsTime);
}

export function buildQuizPayloadFromForm(formState, status) {
  const normalizedTitle = String(formState.title || '').trim();
  const normalizedSlug = slugifyQuizTitle(formState.slug || normalizedTitle);
  const normalizedQuestions = (formState.questions || []).map((question, index) => ({
    correctIndex: Number(question.correctIndex) || 0,
    id: question.id || `q${index + 1}`,
    options: Array.from({ length: QUESTION_OPTION_COUNT }, (_, optionIndex) => (
      normalizeOptionValue(question.options?.[optionIndex])
    )),
    references: (question.references || [])
      .map((reference) => ({
        chapter: reference.chapter === '' ? null : Number(reference.chapter),
        source: String(reference.source || '').trim(),
        text: String(reference.text || '').trim(),
        verse: reference.verse === '' ? null : Number(reference.verse),
      }))
      .filter((reference) => (
        reference.source
        || reference.text
        || reference.chapter !== null
        || reference.verse !== null
      )),
    text: String(question.text || '').trim(),
    time: Math.max(1, Number(question.time) || 1),
  }));

  return {
    allowRetake: formState.allowRetake !== false,
    category: String(formState.category || '').trim().toLowerCase(),
    description: String(formState.description || '').trim(),
    estimatedTime: Math.max(1, Number(formState.estimatedTime) || DEFAULT_ESTIMATED_TIME_SECONDS),
    expireAt: inputValueToDate(formState.expireAt),
    imageAlt: String(formState.imageAlt || '').trim(),
    imageUrl: String(formState.imageUrl || '').trim(),
    level: normalizeQuizLevel(formState.level),
    publishAt: inputValueToDate(formState.publishAt),
    questions: normalizedQuestions,
    slug: normalizedSlug,
    status: normalizeQuizStatus(status || formState.status),
    title: normalizedTitle,
    totalQuestions: normalizedQuestions.length,
    visualKey: String(formState.visualKey || '').trim(),
  };
}

export function validateQuizPayload(payload, { mode = 'publish' } = {}) {
  const errors = {};
  const isDraft = mode === 'draft' || payload.status === QUIZ_STATUSES.DRAFT;

  if (!payload.title) {
    errors.title = 'Title is required.';
  }

  if (!payload.slug) {
    errors.slug = 'Slug is required.';
  }

  if (!isDraft) {
    if (!payload.description) {
      errors.description = 'Description is required before publishing.';
    }

    if (!payload.category) {
      errors.category = 'Category is required before publishing.';
    }

    if (!payload.questions.length) {
      errors.questions = 'Add at least one question before publishing.';
    }
  }

  if (payload.publishAt && payload.expireAt && payload.publishAt.getTime() > payload.expireAt.getTime()) {
    errors.expireAt = 'Publish date cannot be after expiry date.';
  }

  const totalQuestionTime = getTotalQuestionTime(payload.questions);
  if (totalQuestionTime > payload.estimatedTime) {
    errors.estimatedTime = 'Question timers cannot exceed the estimated quiz time.';
  }

  if (!isDraft) {
    payload.questions.forEach((question, index) => {
      const questionNumber = index + 1;

      if (!question.text) {
        errors[`question-${index}-text`] = `Question ${questionNumber} text is required.`;
      }

      if (question.options.length !== QUESTION_OPTION_COUNT || question.options.some((option) => !option)) {
        errors[`question-${index}-options`] = `Question ${questionNumber} must have exactly 4 options.`;
      }

      if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= QUESTION_OPTION_COUNT) {
        errors[`question-${index}-correctIndex`] = `Question ${questionNumber} needs one correct answer.`;
      }

      if (!Number(question.time) || Number(question.time) <= 0) {
        errors[`question-${index}-time`] = `Question ${questionNumber} timer must be greater than 0.`;
      }
    });
  }

  return errors;
}

export function validateSingleQuestion(question, index = 0) {
  const errors = {};
  const questionNumber = index + 1;
  const text = String(question?.text || '').trim();
  const options = question?.options || [];
  const correctIndex = Number(question?.correctIndex);
  const time = Number(question?.time);

  if (!text) {
    errors[`question-${index}-text`] = `Question ${questionNumber} text is required.`;
  }

  if (!Array.isArray(options) || options.length !== QUESTION_OPTION_COUNT || options.some((option) => !String(option || '').trim())) {
    errors[`question-${index}-options`] = `Question ${questionNumber} must have exactly 4 options.`;
  }

  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= QUESTION_OPTION_COUNT) {
    errors[`question-${index}-correctIndex`] = `Question ${questionNumber} needs one correct answer.`;
  }

  if (!time || time <= 0) {
    errors[`question-${index}-time`] = `Question ${questionNumber} timer must be greater than 0.`;
  }

  return errors;
}

export function isQuestionComplete(question) {
  if (!question) return false;
  const text = String(question.text || '').trim();
  const options = question.options || [];
  const correctIndex = Number(question.correctIndex);
  const time = Number(question.time);

  return (
    Boolean(text) &&
    Array.isArray(options) &&
    options.length === QUESTION_OPTION_COUNT &&
    options.every((opt) => Boolean(String(opt || '').trim())) &&
    Number.isInteger(correctIndex) &&
    correctIndex >= 0 &&
    correctIndex < QUESTION_OPTION_COUNT &&
    Boolean(time && time > 0)
  );
}

