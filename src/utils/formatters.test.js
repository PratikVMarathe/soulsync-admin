import { describe, expect, it } from 'vitest';
import {
  formatDateTime,
  formatQuizLevel,
  formatRoleLabel,
  formatShortDate,
  formatStatNumber,
  getInitials,
  getQuizDisplayTitle,
} from './formatters';

// ─── formatRoleLabel ──────────────────────────────────────────────────────────

describe('formatRoleLabel', () => {
  it('formats "SUPER_ADMIN" → "Super Admin"', () => {
    expect(formatRoleLabel('SUPER_ADMIN')).toBe('Super Admin');
  });

  it('formats "ADMIN" → "Admin"', () => {
    expect(formatRoleLabel('ADMIN')).toBe('Admin');
  });

  it('formats "USER" → "User"', () => {
    expect(formatRoleLabel('USER')).toBe('User');
  });

  it('returns "Member" for null', () => {
    expect(formatRoleLabel(null)).toBe('Member');
  });

  it('returns "Member" for undefined', () => {
    expect(formatRoleLabel(undefined)).toBe('Member');
  });

  it('returns "Member" for empty string', () => {
    expect(formatRoleLabel('')).toBe('Member');
  });
});

// ─── formatQuizLevel ──────────────────────────────────────────────────────────

describe('formatQuizLevel', () => {
  it('formats "BEGINNER" → "Beginner"', () => {
    expect(formatQuizLevel('BEGINNER')).toBe('Beginner');
  });

  it('formats "INTERMEDIATE_PLUS" → "Intermediate Plus"', () => {
    expect(formatQuizLevel('INTERMEDIATE_PLUS')).toBe('Intermediate Plus');
  });

  it('formats "ADVANCED" → "Advanced"', () => {
    expect(formatQuizLevel('ADVANCED')).toBe('Advanced');
  });

  it('returns "General" for null', () => {
    expect(formatQuizLevel(null)).toBe('General');
  });

  it('returns "General" for undefined', () => {
    expect(formatQuizLevel(undefined)).toBe('General');
  });
});

// ─── formatShortDate ──────────────────────────────────────────────────────────

describe('formatShortDate', () => {
  it('returns "Recently" for null', () => {
    expect(formatShortDate(null)).toBe('Recently');
  });

  it('returns "Recently" for undefined', () => {
    expect(formatShortDate(undefined)).toBe('Recently');
  });

  it('returns "Recently" for invalid date', () => {
    expect(formatShortDate('not-a-date')).toBe('Recently');
  });

  it('formats a JS Date object (contains numeric year)', () => {
    const date = new Date('2024-03-15T00:00:00Z');
    const result = formatShortDate(date);
    expect(result).toMatch(/2024/);
  });

  it('formats a Firestore Timestamp-like object with toDate()', () => {
    const timestamp = { toDate: () => new Date('2024-06-01T00:00:00Z') };
    const result = formatShortDate(timestamp);
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/Jun/);
  });

  it('formats an ISO string', () => {
    const result = formatShortDate('2024-12-25T00:00:00Z');
    expect(result).toMatch(/2024/);
  });
});

// ─── formatDateTime ───────────────────────────────────────────────────────────

describe('formatDateTime', () => {
  it('returns "Recently" for null', () => {
    expect(formatDateTime(null)).toBe('Recently');
  });

  it('returns "Recently" for invalid date', () => {
    expect(formatDateTime('garbage')).toBe('Recently');
  });

  it('includes hour and minute for a valid date', () => {
    const date = new Date('2024-03-15T14:30:00Z');
    const result = formatDateTime(date);
    // Result will contain digits for hour/minute in en-IN locale
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('formats Firestore Timestamp-like object', () => {
    const timestamp = { toDate: () => new Date('2024-08-01T09:00:00Z') };
    const result = formatDateTime(timestamp);
    expect(result).toMatch(/2024/);
  });
});

// ─── formatStatNumber ─────────────────────────────────────────────────────────

describe('formatStatNumber', () => {
  it('formats 0 to "0"', () => {
    expect(formatStatNumber(0)).toBe('0');
  });

  it('formats null to "0"', () => {
    expect(formatStatNumber(null)).toBe('0');
  });

  it('formats undefined to "0"', () => {
    expect(formatStatNumber(undefined)).toBe('0');
  });

  it('formats a positive integer (locale-specific grouping)', () => {
    const result = formatStatNumber(1000);
    // en-IN uses commas: 1,000
    expect(result).toMatch(/1.000/);
  });

  it('formats a large number', () => {
    const result = formatStatNumber(123456);
    expect(result.replace(/\D/g, '')).toBe('123456');
  });
});

// ─── getInitials ──────────────────────────────────────────────────────────────

describe('getInitials', () => {
  it('returns first letter of a single name', () => {
    expect(getInitials('Priya')).toBe('P');
  });

  it('returns first letters of first and last name', () => {
    expect(getInitials('Priya Sharma')).toBe('PS');
  });

  it('uses only first 2 words', () => {
    expect(getInitials('Priya Ramadevi Sharma')).toBe('PR');
  });

  it('returns "S" for null (default is "SoulSync" — one word)', () => {
    expect(getInitials(null)).toBe('S');
  });

  it('returns "S" for undefined', () => {
    expect(getInitials(undefined)).toBe('S');
  });

  it('returns "S" for empty string', () => {
    expect(getInitials('')).toBe('S');
  });

  it('uppercases initials from lowercase input', () => {
    expect(getInitials('priya sharma')).toBe('PS');
  });
});

// ─── getQuizDisplayTitle ──────────────────────────────────────────────────────

describe('getQuizDisplayTitle', () => {
  it('strips "Concept N: " prefix', () => {
    expect(getQuizDisplayTitle('Concept 1: Bhagavad Gita')).toBe('Bhagavad Gita');
  });

  it('strips "concept 2: " (case insensitive)', () => {
    expect(getQuizDisplayTitle('concept 2: basics')).toBe('basics');
  });

  it('returns the string unchanged if no Concept prefix', () => {
    expect(getQuizDisplayTitle('Bhagavad Gita')).toBe('Bhagavad Gita');
  });

  it('returns "Concept" for null', () => {
    expect(getQuizDisplayTitle(null)).toBe('Concept');
  });

  it('returns "Concept" for undefined', () => {
    expect(getQuizDisplayTitle(undefined)).toBe('Concept');
  });

  it('returns "Concept" for empty string', () => {
    expect(getQuizDisplayTitle('')).toBe('Concept');
  });

  it('handles "Concept 10: " with double-digit number', () => {
    expect(getQuizDisplayTitle('Concept 10: Advanced Topics')).toBe('Advanced Topics');
  });
});
