import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  copyImageUrl,
  formatCloudinaryUrl,
  getCloudinarySignature,
  validateImageFile,
  warmupImageApi,
} from './cloudinaryService';

describe('cloudinaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('validateImageFile', () => {
    it('returns error when file is missing', () => {
      const result = validateImageFile(null);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/select an image/i);
    });

    it('rejects unsupported file formats (.gif, .pdf)', () => {
      const gifFile = { name: 'animation.gif', size: 1000, type: 'image/gif' };
      const pdfFile = { name: 'document.pdf', size: 1000, type: 'application/pdf' };

      expect(validateImageFile(gifFile).valid).toBe(false);
      expect(validateImageFile(gifFile).error).toBe('Please upload a JPG, PNG, or WebP image.');

      expect(validateImageFile(pdfFile).valid).toBe(false);
      expect(validateImageFile(pdfFile).error).toBe('Please upload a JPG, PNG, or WebP image.');
    });

    it('allows valid formats (.jpg, .jpeg, .png, .webp)', () => {
      const jpgFile = { name: 'photo.jpg', size: 10000, type: 'image/jpeg' };
      const pngFile = { name: 'graphic.png', size: 10000, type: 'image/png' };
      const webpFile = { name: 'artwork.webp', size: 10000, type: 'image/webp' };

      expect(validateImageFile(jpgFile).valid).toBe(true);
      expect(validateImageFile(pngFile).valid).toBe(true);
      expect(validateImageFile(webpFile).valid).toBe(true);
    });

    it('rejects files larger than 500 KB', () => {
      const largeFile = {
        name: 'heavy.png',
        size: 501 * 1024, // 501 KB
        type: 'image/png',
      };

      const result = validateImageFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Image must be 500 KB or smaller.');
    });

    it('allows files 500 KB or smaller', () => {
      const exactFile = {
        name: 'exact.jpg',
        size: 500 * 1024,
        type: 'image/jpeg',
      };

      const smallFile = {
        name: 'small.webp',
        size: 350 * 1024,
        type: 'image/webp',
      };

      expect(validateImageFile(exactFile).valid).toBe(true);
      expect(validateImageFile(smallFile).valid).toBe(true);
    });
  });

  describe('formatCloudinaryUrl', () => {
    it('inserts f_auto,q_auto into standard Cloudinary upload URLs', () => {
      const original = 'https://res.cloudinary.com/demo/image/upload/v12345/sample.jpg';
      const formatted = formatCloudinaryUrl(original);
      expect(formatted).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v12345/sample.jpg');
    });

    it('does not duplicate f_auto,q_auto if already present', () => {
      const alreadyFormatted = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v12345/sample.jpg';
      expect(formatCloudinaryUrl(alreadyFormatted)).toBe(alreadyFormatted);
    });

    it('returns non-cloudinary URLs untouched', () => {
      const external = 'https://example.com/images/photo.png';
      expect(formatCloudinaryUrl(external)).toBe(external);
    });
  });

  describe('warmupImageApi', () => {
    it('calls GET /health without throwing on network failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(warmupImageApi()).resolves.toBeUndefined();
    });
  });

  describe('copyImageUrl', () => {
    it('copies text to clipboard and calls showNotice', async () => {
      const showNotice = vi.fn();
      const writeTextMock = vi.fn().mockResolvedValue(undefined);

      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      await copyImageUrl('https://res.cloudinary.com/test/image.jpg', showNotice);

      expect(writeTextMock).toHaveBeenCalledWith('https://res.cloudinary.com/test/image.jpg');
      expect(showNotice).toHaveBeenCalledWith('Image URL copied.', 'info');
    });
  });
});
