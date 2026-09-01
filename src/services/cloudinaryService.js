import { auth } from '../config/firebase';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_KB,
  UPLOAD_FOLDERS,
} from '../constants/upload';

const RETRY_DELAYS = [2000, 3000, 5000];
const WARMUP_TIMEOUT_MS = 10000;

let hasWarmedUp = false;

export function getImageApiBaseUrl() {
  const url = import.meta.env.VITE_IMAGE_API_URL;
  if (url) {
    return url.replace(/\/+$/, '');
  }
  // Default to local dev port or origin fallback
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5003';
  }
  return '';
}

/**
 * Opportunistic background warm-up ping for Render cold-starts.
 * Fires at most once per page session, max 10s timeout, never blocks UI or shows errors.
 */
export async function warmupImageApi() {
  if (hasWarmedUp) return;
  hasWarmedUp = true;

  const baseUrl = getImageApiBaseUrl();
  if (!baseUrl) return;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WARMUP_TIMEOUT_MS);

  try {
    await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (_err) {
    // Opportunistic health check; silently ignore any failure
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validates image format and file size.
 */
export function validateImageFile(file) {
  if (!file) {
    return {
      error: 'Please select an image file to upload.',
      valid: false,
    };
  }

  const fileName = (file.name || '').toLowerCase();
  const fileType = (file.type || '').toLowerCase();

  const hasValidMime = ALLOWED_IMAGE_TYPES.includes(fileType);
  const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (!hasValidMime && !hasValidExt) {
    return {
      error: 'Please upload a JPG, PNG, or WebP image.',
      valid: false,
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      error: `Image must be ${MAX_IMAGE_SIZE_KB} KB or smaller.`,
      valid: false,
    };
  }

  return {
    error: null,
    valid: true,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Obtains Firebase Auth ID Token for current user.
 */
async function getIdToken(authUser) {
  if (authUser && typeof authUser.getIdToken === 'function') {
    return authUser.getIdToken();
  }
  const currentUser = auth.currentUser;
  if (currentUser && typeof currentUser.getIdToken === 'function') {
    return currentUser.getIdToken();
  }
  return null;
}

/**
 * Requests signed upload parameters from soulsync-api with bounded cold-start retries.
 */
export async function getCloudinarySignature(folderType = UPLOAD_FOLDERS.QUIZ, authUser = null, fileSize = null) {
  const token = await getIdToken(authUser);

  if (!token) {
    const err = new Error('You do not have permission to upload images.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const baseUrl = getImageApiBaseUrl();
  const endpoint = `${baseUrl}/api/cloudinary/signature`;

  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          folder: folderType,
          fileSize: fileSize || undefined,
        }),
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          const err = new Error(
            data?.error?.message || 'You do not have permission to upload images.',
          );
          err.code = data?.error?.code || 'FORBIDDEN';
          err.statusCode = response.status;
          throw err;
        }

        if (response.status === 400) {
          const err = new Error(
            data?.error?.message || 'Invalid upload parameters.',
          );
          err.code = data?.error?.code || 'BAD_REQUEST';
          err.statusCode = 400;
          throw err;
        }

        // Server error: could be waking up or temporary
        const err = new Error(data?.error?.message || 'Signature request failed.');
        err.statusCode = response.status;
        throw err;
      }

      if (!data.signature || !data.timestamp || !data.cloudName || !data.apiKey) {
        throw new Error('Incomplete signature response received from backend.');
      }

      return data;
    } catch (err) {
      lastError = err;

      // Do NOT retry 401, 403, or 400 errors
      if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 400) {
        throw err;
      }

      // If attempts remain, wait the specified retry delay
      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        await sleep(delay);
      }
    }
  }

  console.error('All Cloudinary signature attempts failed:', lastError);
  const finalError = new Error('Image upload service is currently unavailable. Please try again.');
  finalError.code = 'SERVICE_UNAVAILABLE';
  throw finalError;
}

/**
 * Ensures Cloudinary URL has f_auto,q_auto delivery transformations inserted.
 */
export function formatCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('cloudinary.com') || !url.includes('/image/upload/')) return url;
  if (url.includes('/image/upload/f_auto,q_auto/')) return url;
  return url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
}

/**
 * Directly uploads an image file to Cloudinary after obtaining backend signature.
 */
export async function uploadImageToCloudinary(file, folderType = UPLOAD_FOLDERS.QUIZ, authUser = null) {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    const error = new Error(validation.error);
    error.code = 'INVALID_FILE';
    throw error;
  }

  // 1. Obtain signature from soulsync-api
  const signatureData = await getCloudinarySignature(folderType, authUser, file.size);

  const { apiKey, cloudName, folder, signature, timestamp, uploadPreset } = signatureData;

  // 2. Direct upload to Cloudinary
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', folder);
  formData.append('upload_preset', uploadPreset);

  const cloudinaryUploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const response = await fetch(cloudinaryUploadUrl, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('Cloudinary direct upload failed:', data);
    const err = new Error(
      data?.error?.message || 'Failed to upload image to Cloudinary.',
    );
    err.code = 'CLOUDINARY_UPLOAD_FAILED';
    throw err;
  }

  const rawUrl = data.secure_url || data.url;
  if (!rawUrl) {
    throw new Error('Cloudinary did not return a secure image URL.');
  }

  const formattedUrl = formatCloudinaryUrl(rawUrl);

  return {
    bytes: data.bytes,
    format: data.format,
    height: data.height,
    publicId: data.public_id,
    secureUrl: formattedUrl,
    width: data.width,
  };
}

/**
 * Copies image URL to clipboard and triggers AppNotice.
 */
export async function copyImageUrl(url, showNotice) {
  if (!url) return;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    if (typeof showNotice === 'function') {
      showNotice('Image URL copied.', 'info');
    }
  } catch (err) {
    console.error('Failed to copy image URL to clipboard:', err);
    if (typeof showNotice === 'function') {
      showNotice('Failed to copy image URL to clipboard.', 'error');
    }
  }
}
