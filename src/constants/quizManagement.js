export const QUIZ_STATUSES = {
  ACTIVE: 'ACTIVE',
  DRAFT: 'DRAFT',
  EXPIRED: 'EXPIRED',
  INACTIVE: 'INACTIVE',
};

export const QUIZ_LEVELS = {
  ADVANCED: 'ADVANCED',
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
};

export const QUIZ_ACTIONS = {
  ACTIVATE: 'ACTIVATE_QUIZ',
  CREATE: 'CREATE_QUIZ',
  DEACTIVATE: 'DEACTIVATE_QUIZ',
  DELETE: 'DELETE_QUIZ',
  PUBLISH: 'PUBLISH_QUIZ',
  RESUME_DRAFT: 'RESUME_DRAFT',
  SAVE_DRAFT: 'SAVE_DRAFT',
  UPDATE: 'UPDATE_QUIZ',
};

export const QUIZ_STATUS_OPTIONS = [
  QUIZ_STATUSES.DRAFT,
  QUIZ_STATUSES.ACTIVE,
  QUIZ_STATUSES.INACTIVE,
  QUIZ_STATUSES.EXPIRED,
];

export const QUIZ_LEVEL_OPTIONS = [
  QUIZ_LEVELS.BEGINNER,
  QUIZ_LEVELS.INTERMEDIATE,
  QUIZ_LEVELS.ADVANCED,
];

export const QUIZZES_PER_PAGE = 10;
export const MAX_DRAFTS_PER_ADMIN = 3;
export const DEFAULT_ESTIMATED_TIME_SECONDS = 60;
export const QUESTION_OPTION_COUNT = 4;

export const DEFAULT_REFERENCE = {
  chapter: '',
  source: '',
  text: '',
  verse: '',
};

export const DEFAULT_QUIZ_FORM = {
  allowRetake: true,
  category: '',
  description: '',
  estimatedTime: DEFAULT_ESTIMATED_TIME_SECONDS,
  expireAt: '',
  imageAlt: '',
  imageUrl: '',
  level: QUIZ_LEVELS.BEGINNER,
  publishAt: '',
  questions: [],
  slug: '',
  status: QUIZ_STATUSES.DRAFT,
  title: '',
  visualKey: '',
};
