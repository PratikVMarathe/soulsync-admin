export const QUIZ_CSV_HEADERS = [
  'title',
  'slug',
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
  'questionId',
  'questionText',
  'option1',
  'option2',
  'option3',
  'option4',
  'correctIndex',
  'time',
  'referenceSource',
  'referenceChapter',
  'referenceVerse',
  'referenceText',
];

/**
 * Parses raw CSV text into array of rows (each a record mapping header -> value).
 * Correctly handles quotes, escaped quotes (""), commas inside quotes, and newlines inside quotes.
 */
export function parseCsvRows(text) {
  if (typeof text !== 'string') {
    throw new Error('CSV content must be a string.');
  }

  // Remove BOM if present
  let cleanText = text.startsWith('\uFEFF') ? text.slice(1) : text;
  cleanText = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i += 1) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i += 1; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n') {
      currentRow.push(currentField.trim());
      currentField = '';
      // Only push non-empty rows
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Final field & row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses a quiz CSV string into validated raw row objects.
 */
export function parseQuizCsv(csvText) {
  if (!csvText || !csvText.trim()) {
    throw new Error('The CSV file is empty.');
  }

  const rawRows = parseCsvRows(csvText);
  if (rawRows.length < 2) {
    throw new Error('The CSV file must contain a header row and at least one question row.');
  }

  const rawHeaders = rawRows[0].map((h) => h.trim());
  const headerMap = {};
  rawHeaders.forEach((h, index) => {
    headerMap[h] = index;
  });

  // Check required headers
  const missingHeaders = QUIZ_CSV_HEADERS.filter((h) => headerMap[h] === undefined);
  if (missingHeaders.length > 0) {
    throw new Error(`CSV is missing required column headers: ${missingHeaders.join(', ')}`);
  }

  const dataRows = [];
  for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex += 1) {
    const rawRow = rawRows[rowIndex];
    const rowData = {};

    QUIZ_CSV_HEADERS.forEach((header) => {
      const colIndex = headerMap[header];
      rowData[header] = colIndex !== undefined && rawRow[colIndex] !== undefined
        ? rawRow[colIndex]
        : '';
    });

    dataRows.push({
      data: rowData,
      rowNumber: rowIndex + 1, // 1-indexed for human readability
    });
  }

  return {
    headers: rawHeaders,
    rows: dataRows,
  };
}

/**
 * Generates the sample CSV template content with exact expected headers and sample rows.
 */
export function generateQuizCsvTemplate() {
  const headerLine = QUIZ_CSV_HEADERS.join(',');
  const sampleRow1 = [
    'Concept 1: Focus',
    'focus',
    'Learn to maintain clarity during stressful situations.',
    'ACTIVE',
    'true',
    'BEGINNER',
    'focus',
    '1',
    'focus-lake',
    'images/focus.png',
    '',
    'Person meditating near a peaceful lake',
    '',
    'q1',
    'How can one maintain focus during stressful situations?',
    'Practice mindfulness',
    'Avoid thinking',
    'Ignore stress',
    'Overwork',
    '0',
    '30',
    'Bhagavad Gita',
    '6',
    '35',
    'The restless mind can be controlled by constant practice and detachment.',
  ].map((val) => (val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val)).join(',');

  const sampleRow2 = [
    'Concept 1: Focus',
    'focus',
    'Learn to maintain clarity during stressful situations.',
    'ACTIVE',
    'true',
    'BEGINNER',
    'focus',
    '1',
    'focus-lake',
    'images/focus.png',
    '',
    'Person meditating near a peaceful lake',
    '',
    'q2',
    'What helps control the restless mind?',
    'Practice',
    'Avoid action',
    'Ignore it',
    'Overwork',
    '0',
    '30',
    'Bhagavad Gita',
    '6',
    '35',
    'Reference text for spiritual grounding.',
  ].map((val) => (val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val)).join(',');

  return `${headerLine}\n${sampleRow1}\n${sampleRow2}\n`;
}

/**
 * Triggers a browser download of the CSV template file.
 */
export function downloadQuizCsvTemplate() {
  const content = generateQuizCsvTemplate();
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', 'soulsync_quiz_bulk_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
