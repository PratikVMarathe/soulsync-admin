import {
  DEFAULT_ESTIMATED_TIME_SECONDS,
  QUESTION_OPTION_COUNT,
  QUIZ_LEVEL_OPTIONS,
  QUIZ_STATUS_OPTIONS,
  QUIZ_STATUSES,
} from '../constants/quizManagement';
import {
  normalizeQuizLevel,
  normalizeQuizStatus,
} from './quizManagement';

function parseBooleanValue(val, defaultValue = true) {
  if (val === undefined || val === null || val === '') return defaultValue;
  const str = String(val).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(str)) return true;
  if (['false', '0', 'no', 'n'].includes(str)) return false;
  return null; // Invalid boolean
}

function parseDateValue(val) {
  if (!val || !String(val).trim()) return null;
  const raw = String(val).trim();

  // Try direct parsing (handles ISO 8601 YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, YYYY/MM/DD, etc.)
  let date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date;

  // Handle DD-MM-YYYY or DD/MM/YYYY with optional time
  const dmyMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dmyMatch) {
    const [, day, month, year, hours = 0, mins = 0, secs = 0] = dmyMatch;
    date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(mins), Number(secs));
    if (!Number.isNaN(date.getTime())) return date;
  }

  return 'INVALID';
}

const METADATA_FIELDS_TO_COMPARE = [
  'title',
  'description',
  'status',
  'allowRetake',
  'level',
  'category',
  'estimatedMinutes',
  'visualKey',
  'imagePath',
  'imageUrl',
  'imageAlt',
  'expireAt',
];

/**
 * Validates parsed CSV rows, checks metadata consistency, verifies uniqueness,
 * checks Firestore slug conflicts, and groups rows into structured quiz documents.
 */
export function validateAndGroupQuizRows(rows = [], existingSlugsSet = new Set()) {
  const errors = [];
  const groupedBySlug = new Map();

  if (!rows || rows.length === 0) {
    return {
      errors: [{ field: 'file', message: 'No question data rows found in CSV.', quizSlug: '', row: 0 }],
      isValid: false,
      quizCount: 0,
      quizzes: [],
      totalQuestionsCount: 0,
    };
  }

  const uploadTime = new Date();

  // 1. Row-level validation and grouping by slug
  rows.forEach(({ data, rowNumber }) => {
    const title = String(data.title || '').trim();
    const slug = String(data.slug || '').trim().toLowerCase();
    const description = String(data.description || '').trim();
    const rawStatus = String(data.status || '').trim().toUpperCase();
    const status = normalizeQuizStatus(rawStatus);
    const rawLevel = String(data.level || '').trim().toUpperCase();
    const level = normalizeQuizLevel(rawLevel);
    const category = String(data.category || '').trim().toLowerCase();
    const visualKey = String(data.visualKey || '').trim();
    const imagePath = String(data.imagePath || '').trim();
    const imageUrl = String(data.imageUrl || '').trim();
    const imageAlt = String(data.imageAlt || '').trim();

    const allowRetakeParsed = parseBooleanValue(data.allowRetake, true);
    if (allowRetakeParsed === null) {
      errors.push({
        field: 'allowRetake',
        message: `Row ${rowNumber}: Invalid boolean value "${data.allowRetake}" for allowRetake. Expected true/false.`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    const estimatedMinutesNum = Number(data.estimatedMinutes);
    if (!data.estimatedMinutes || Number.isNaN(estimatedMinutesNum) || estimatedMinutesNum <= 0) {
      errors.push({
        field: 'estimatedMinutes',
        message: `Row ${rowNumber}: estimatedMinutes must be a positive number.`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    const expireAtDate = parseDateValue(data.expireAt);
    if (expireAtDate === 'INVALID') {
      errors.push({
        field: 'expireAt',
        message: `Row ${rowNumber}: Invalid date format for expireAt: "${data.expireAt}".`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    if (expireAtDate instanceof Date && expireAtDate.getTime() < uploadTime.getTime()) {
      errors.push({
        field: 'expireAt',
        message: `Row ${rowNumber}: expireAt date must be in the future.`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    // Slug validation
    if (!slug) {
      errors.push({
        field: 'slug',
        message: `Row ${rowNumber}: Quiz slug is required.`,
        quizSlug: '',
        row: rowNumber,
      });
    } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      errors.push({
        field: 'slug',
        message: `Row ${rowNumber}: Slug "${slug}" contains invalid characters. Use only lowercase letters, numbers, and hyphens.`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    if (!title) {
      errors.push({
        field: 'title',
        message: `Row ${rowNumber}: Quiz title is required.`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    if (!QUIZ_STATUS_OPTIONS.includes(status)) {
      errors.push({
        field: 'status',
        message: `Row ${rowNumber}: Status "${rawStatus}" is invalid. Expected one of: ${QUIZ_STATUS_OPTIONS.join(', ')}.`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    if (!QUIZ_LEVEL_OPTIONS.includes(level)) {
      errors.push({
        field: 'level',
        message: `Row ${rowNumber}: Level "${rawLevel}" is invalid. Expected one of: ${QUIZ_LEVEL_OPTIONS.join(', ')}.`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    if (status !== QUIZ_STATUSES.DRAFT) {
      if (!description) {
        errors.push({
          field: 'description',
          message: `Row ${rowNumber}: Description is required before publishing/activating.`,
          quizSlug: slug,
          row: rowNumber,
        });
      }

      if (!category) {
        errors.push({
          field: 'category',
          message: `Row ${rowNumber}: Category is required before publishing/activating.`,
          quizSlug: slug,
          row: rowNumber,
        });
      }
    }

    // Question fields validation
    const questionId = String(data.questionId || '').trim();
    const questionText = String(data.questionText || '').trim();
    const option1 = String(data.option1 || '').trim();
    const option2 = String(data.option2 || '').trim();
    const option3 = String(data.option3 || '').trim();
    const option4 = String(data.option4 || '').trim();
    const rawCorrectIndex = data.correctIndex;
    const timeNum = Number(data.time);

    if (!questionId) {
      errors.push({
        field: 'questionId',
        message: `Row ${rowNumber}: questionId is required.`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    if (!questionText) {
      errors.push({
        field: 'questionText',
        message: `Row ${rowNumber}: questionText is required.`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    const options = [option1, option2, option3, option4];
    if (options.some((opt) => !opt)) {
      errors.push({
        field: 'options',
        message: `Row ${rowNumber}: Question "${questionId || 'unknown'}" must have all 4 non-empty options.`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    const correctIndexNum = Number(rawCorrectIndex);
    if (!Number.isInteger(correctIndexNum) || correctIndexNum < 0 || correctIndexNum >= QUESTION_OPTION_COUNT) {
      errors.push({
        field: 'correctIndex',
        message: `Row ${rowNumber}: Question "${questionId || 'unknown'}" correctIndex must be an integer between 0 and 3. Received: "${rawCorrectIndex}".`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    if (!data.time || Number.isNaN(timeNum) || timeNum <= 0) {
      errors.push({
        field: 'time',
        message: `Row ${rowNumber}: Question "${questionId || 'unknown'}" timer must be greater than 0 seconds.`,
        quizSlug: slug,
        row: rowNumber,
      });
    }

    // Scripture reference
    const referenceSource = String(data.referenceSource || '').trim();
    const referenceChapter = String(data.referenceChapter || '').trim();
    const referenceVerse = String(data.referenceVerse || '').trim();
    const referenceText = String(data.referenceText || '').trim();

    let parsedChapter = null;
    if (referenceChapter) {
      parsedChapter = Number(referenceChapter);
      if (Number.isNaN(parsedChapter) || parsedChapter <= 0) {
        errors.push({
          field: 'referenceChapter',
          message: `Row ${rowNumber}: referenceChapter must be a positive number if provided.`,
          quizSlug: slug,
          row: rowNumber,
        });
      }
    }

    let parsedVerse = null;
    if (referenceVerse) {
      parsedVerse = Number(referenceVerse);
      if (Number.isNaN(parsedVerse) || parsedVerse <= 0) {
        errors.push({
          field: 'referenceVerse',
          message: `Row ${rowNumber}: referenceVerse must be a positive number if provided.`,
          quizSlug: slug,
          row: rowNumber,
        });
      }
    }

    const questionReference = referenceSource || referenceText || parsedChapter || parsedVerse
      ? [
          {
            chapter: parsedChapter,
            source: referenceSource,
            text: referenceText,
            verse: parsedVerse,
          },
        ]
      : [];

    const questionObj = {
      correctIndex: Number.isInteger(correctIndexNum) ? correctIndexNum : 0,
      id: questionId || `q-${rowNumber}`,
      options,
      references: questionReference,
      rowNumber,
      text: questionText,
      time: timeNum > 0 ? timeNum : 30,
    };

    // Grouping
    if (slug) {
      if (!groupedBySlug.has(slug)) {
        groupedBySlug.set(slug, {
          allowRetake: allowRetakeParsed !== false,
          category,
          description,
          estimatedMinutes: estimatedMinutesNum > 0 ? estimatedMinutesNum : 1,
          estimatedTime: (estimatedMinutesNum > 0 ? estimatedMinutesNum : 1) * 60,
          expireAt: expireAtDate instanceof Date ? expireAtDate : null,
          firstRowNumber: rowNumber,
          imageAlt,
          imagePath,
          imageUrl,
          level,
          publishAt: uploadTime,
          questions: [],
          rawMetadata: {
            allowRetake: String(data.allowRetake || '').trim(),
            category,
            description,
            estimatedMinutes: String(data.estimatedMinutes || '').trim(),
            expireAt: String(data.expireAt || '').trim(),
            imageAlt,
            imagePath,
            imageUrl,
            level,
            status,
            title,
            visualKey,
          },
          slug,
          status,
          title,
          visualKey,
        });
      }

      const group = groupedBySlug.get(slug);
      group.questions.push(questionObj);

      // Validate metadata consistency across rows of the same quiz slug
      METADATA_FIELDS_TO_COMPARE.forEach((field) => {
        const firstVal = group.rawMetadata[field];
        const currentVal = String(data[field] || '').trim();
        if (firstVal !== currentVal) {
          errors.push({
            field,
            message: `Quiz "${slug}" has inconsistent ${field} values between row ${group.firstRowNumber} ("${firstVal}") and row ${rowNumber} ("${currentVal}").`,
            quizSlug: slug,
            row: rowNumber,
          });
        }
      });
    }
  });

  // 2. Quiz-level cross checks and Firestore conflict check
  const structuredQuizzes = [];
  let totalQuestionsCount = 0;

  groupedBySlug.forEach((group, slug) => {
    // Check if slug already exists in Firestore
    if (existingSlugsSet && (existingSlugsSet.has(slug) || (typeof existingSlugsSet.includes === 'function' && existingSlugsSet.includes(slug)))) {
      errors.push({
        field: 'slug',
        message: `Quiz "${slug}" already exists in Firestore. Resolve the slug conflict before importing.`,
        quizSlug: slug,
        row: group.firstRowNumber,
      });
    }

    // Check unique question IDs within quiz
    const seenQuestionIds = new Set();
    group.questions.forEach((q) => {
      if (seenQuestionIds.has(q.id)) {
        errors.push({
          field: 'questionId',
          message: `Quiz "${slug}" contains duplicate questionId "${q.id}" at row ${q.rowNumber}.`,
          quizSlug: slug,
          row: q.rowNumber,
        });
      }
      seenQuestionIds.add(q.id);
    });

    if (group.questions.length === 0) {
      errors.push({
        field: 'questions',
        message: `Quiz "${slug}" has no questions.`,
        quizSlug: slug,
        row: group.firstRowNumber,
      });
    }

    // Total question timer vs estimated time check
    const totalQuestionTime = group.questions.reduce((sum, q) => sum + q.time, 0);
    if (totalQuestionTime > group.estimatedTime) {
      errors.push({
        field: 'estimatedMinutes',
        message: `Quiz "${slug}" total question timers (${totalQuestionTime}s) exceed the estimated quiz time (${group.estimatedTime}s / ${group.estimatedMinutes}m).`,
        quizSlug: slug,
        row: group.firstRowNumber,
      });
    }

    const cleanQuestions = group.questions.map(({ rowNumber: _, ...rest }) => rest);
    totalQuestionsCount += cleanQuestions.length;

    structuredQuizzes.push({
      allowRetake: group.allowRetake,
      category: group.category,
      description: group.description,
      estimatedTime: group.estimatedTime,
      expireAt: group.expireAt,
      imageAlt: group.imageAlt,
      imagePath: group.imagePath || '',
      imageUrl: group.imageUrl,
      level: group.level,
      publishAt: group.publishAt,
      questions: cleanQuestions,
      slug: group.slug,
      status: group.status,
      title: group.title,
      totalQuestions: cleanQuestions.length,
      visualKey: group.visualKey,
    });
  });

  return {
    errors,
    isValid: errors.length === 0,
    quizCount: structuredQuizzes.length,
    quizzes: structuredQuizzes,
    totalQuestionsCount,
  };
}
