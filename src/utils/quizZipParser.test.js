import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { normalizeZipImagePath, parseQuizZip } from './quizZipParser';

describe('quizZipParser', () => {
  const sampleCsvContent = `title,slug,description,status,allowRetake,level,category,estimatedMinutes,visualKey,imagePath,imageUrl,imageAlt,expireAt,questionId,questionText,option1,option2,option3,option4,correctIndex,time,referenceSource,referenceChapter,referenceVerse,referenceText
Concept 1: Focus,focus,Learn to focus,ACTIVE,true,BEGINNER,focus,1,focus-lake,images/focus.png,,Person meditating,,q1,How to focus?,Mindfulness,Ignore,Avoid,Rush,0,30,Bhagavad Gita,6,35,Mind can be controlled`;

  it('normalizes zip image paths correctly', () => {
    expect(normalizeZipImagePath('./images/focus.png')).toBe('images/focus.png');
    expect(normalizeZipImagePath('images\\focus.png')).toBe('images/focus.png');
    expect(normalizeZipImagePath('/images/focus.png')).toBe('images/focus.png');
  });

  it('parses valid ZIP containing quizzes.csv and valid images', async () => {
    const zip = new JSZip();
    zip.file('quizzes.csv', sampleCsvContent);

    // Create a small 5 KB mock png image buffer
    const mockImageBuffer = new Uint8Array(5 * 1024);
    zip.file('images/focus.png', mockImageBuffer);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const result = await parseQuizZip(zipBlob);

    expect(result.isZip).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.imageErrors).toHaveLength(0);
    expect(result.referencedImageCount).toBe(1);
    expect(result.zipImagesMap.has('images/focus.png')).toBe(true);
  });

  it('returns error when referenced image is missing from ZIP', async () => {
    const zip = new JSZip();
    zip.file('quizzes.csv', sampleCsvContent);
    // Don't add images/focus.png

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const result = await parseQuizZip(zipBlob);

    expect(result.imageErrors).toHaveLength(1);
    expect(result.imageErrors[0].message).toMatch(/not found in the zip/i);
    expect(result.imageErrors[0].field).toBe('imagePath');
  });

  it('rejects unsupported image extensions in ZIP', async () => {
    const csvWithGif = sampleCsvContent.replace('images/focus.png', 'images/focus.gif');
    const zip = new JSZip();
    zip.file('quizzes.csv', csvWithGif);
    zip.file('images/focus.gif', new Uint8Array(100));

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const result = await parseQuizZip(zipBlob);

    expect(result.imageErrors).toHaveLength(1);
    expect(result.imageErrors[0].message).toMatch(/unsupported format/i);
    expect(result.imageErrors[0].field).toBe('imagePath');
  });

  it('rejects image files exceeding 500 KB in ZIP', async () => {
    const zip = new JSZip();
    zip.file('quizzes.csv', sampleCsvContent);

    // 600 KB mock image (> 500 KB)
    const largeImageBuffer = new Uint8Array(600 * 1024);
    zip.file('images/focus.png', largeImageBuffer);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const result = await parseQuizZip(zipBlob);

    expect(result.imageErrors).toHaveLength(1);
    expect(result.imageErrors[0].message).toMatch(/exceeds the maximum allowed size of 500 KB/i);
    expect(result.imageErrors[0].field).toBe('imagePath');
  });
});
