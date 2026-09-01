import { describe, expect, it } from 'vitest';
import {
  generateQuizCsvTemplate,
  parseCsvRows,
  parseQuizCsv,
  QUIZ_CSV_HEADERS,
} from './quizCsvParser';

describe('quizCsvParser', () => {
  it('parses standard CSV text with headers and rows correctly', () => {
    const csv = `${QUIZ_CSV_HEADERS.join(',')}\n`
      + 'Concept 1: Focus,focus,Desc,ACTIVE,true,BEGINNER,focus,1,focus-lake,images/focus.png,,,,q1,Text,A,B,C,D,0,30,Gita,6,35,Detachment';

    const { headers, rows } = parseQuizCsv(csv);
    expect(headers).toEqual(QUIZ_CSV_HEADERS);
    expect(rows).toHaveLength(1);
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[0].data.title).toBe('Concept 1: Focus');
    expect(rows[0].data.slug).toBe('focus');
    expect(rows[0].data.imagePath).toBe('images/focus.png');
    expect(rows[0].data.questionId).toBe('q1');
    expect(rows[0].data.option1).toBe('A');
    expect(rows[0].data.correctIndex).toBe('0');
  });

  it('handles quotes, commas inside quotes, and escaped quotes properly', () => {
    const csv = 'title,description\n"Focus, Meditation & Clarity","He said ""Practice always"""';
    const rows = parseCsvRows(csv);

    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe('Focus, Meditation & Clarity');
    expect(rows[1][1]).toBe('He said "Practice always"');
  });

  it('handles BOM prefix and carriage returns gracefully', () => {
    const csv = `\uFEFF${QUIZ_CSV_HEADERS.join(',')}\r\n`
      + 'Concept 1,focus,Desc,ACTIVE,true,BEGINNER,focus,1,,,,,q1,QText,A,B,C,D,0,30,,,,';

    const { rows } = parseQuizCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].data.slug).toBe('focus');
  });

  it('throws an error if CSV content is empty or only headers', () => {
    expect(() => parseQuizCsv('')).toThrow(/empty/i);
    expect(() => parseQuizCsv(`${QUIZ_CSV_HEADERS.join(',')}\n`)).toThrow(/at least one question row/i);
  });

  it('throws an error if required headers are missing', () => {
    const invalidCsv = 'title,slug,description\nFocus,focus,Desc';
    expect(() => parseQuizCsv(invalidCsv)).toThrow(/missing required column headers/i);
  });

  it('generates a valid CSV template containing all headers and 2 sample questions', () => {
    const template = generateQuizCsvTemplate();
    expect(template).toContain(QUIZ_CSV_HEADERS.join(','));
    expect(template).toContain('Concept 1: Focus');
    expect(template).toContain('q1');
    expect(template).toContain('q2');

    const parsed = parseQuizCsv(template);
    expect(parsed.rows).toHaveLength(2);
  });
});
