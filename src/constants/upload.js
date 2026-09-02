export const DEFAULT_MAX_IMAGE_SIZE_KB = 500;

export const MAX_IMAGE_SIZE_KB = Number(import.meta.env.VITE_MAX_IMAGE_SIZE_KB) || DEFAULT_MAX_IMAGE_SIZE_KB;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_KB * 1024;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const ALLOWED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
];

export const UPLOAD_FOLDERS = {
  QUIZ: 'QUIZ',
  MANDALA: 'MANDALA',
};
