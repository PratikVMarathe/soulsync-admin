import { IDENTITY_TYPES } from '../constants/auth';

export function normalizeEmail(email) {
  return email?.trim().toLowerCase() || '';
}

export function extractPhoneDigits(phoneNumber) {
  return String(phoneNumber || '').replace(/\D/g, '');
}

export function sanitizePhoneInput(phoneNumber) {
  return extractPhoneDigits(phoneNumber).slice(0, 10);
}

export function normalizePhoneNumber(phoneNumber) {
  const digits = extractPhoneDigits(phoneNumber);
  return digits.length === 10 ? digits : '';
}

export function isValidPhoneNumber(phoneNumber) {
  return extractPhoneDigits(phoneNumber).length === 10;
}

export function isValidEmailAddress(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function buildEmailIdentityDocumentId(email) {
  return `email_${normalizeEmail(email)}`;
}

export function buildPhoneIdentityDocumentId(phoneNumber) {
  return `phone_${normalizePhoneNumber(phoneNumber)}`;
}

export function buildIdentityDocumentId(type, value) {
  if (type === IDENTITY_TYPES.EMAIL) {
    return buildEmailIdentityDocumentId(value);
  }

  return buildPhoneIdentityDocumentId(value);
}
