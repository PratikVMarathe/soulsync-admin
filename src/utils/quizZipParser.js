import JSZip from 'jszip';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_KB,
} from '../constants/upload';
import { parseQuizCsv } from './quizCsvParser';

export function normalizeZipImagePath(pathStr) {
  if (!pathStr) return '';
  return pathStr.replace(/^[./\\]+/, '').replace(/\\/g, '/').toLowerCase();
}

/**
 * Parses and validates a Bulk Quiz ZIP archive containing `quizzes.csv` and an `images/` folder.
 */
export async function parseQuizZip(zipFile) {
  if (!zipFile) {
    throw new Error('No ZIP file provided.');
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(zipFile);
  } catch (err) {
    console.error('JSZip failed to load archive:', err);
    throw new Error('Could not read ZIP archive. Please ensure it is a valid, uncorrupted .zip file.');
  }

  // 1. Locate CSV file inside ZIP (look for quizzes.csv first, or any root .csv)
  let csvEntry = zip.file('quizzes.csv');
  if (!csvEntry) {
    const csvFiles = Object.keys(zip.files).filter(
      (fileName) => fileName.toLowerCase().endsWith('.csv') && !zip.files[fileName].dir,
    );

    if (csvFiles.length === 0) {
      throw new Error('No CSV file found inside the ZIP archive. Expected "quizzes.csv" in the root of the archive.');
    }

    // Use the first CSV file found
    csvEntry = zip.file(csvFiles[0]);
  }

  const csvText = await csvEntry.async('string');
  const { rows } = parseQuizCsv(csvText);

  // 2. Index all image files found inside the ZIP
  const zipImagesMap = new Map(); // normalizedPath -> { entry, name, path, getBlob(), size }

  const fileEntries = Object.keys(zip.files);
  for (const filePath of fileEntries) {
    const entry = zip.files[filePath];
    if (entry.dir) continue;

    const normalized = normalizeZipImagePath(filePath);
    const fileName = filePath.split('/').pop() || filePath;
    const lowerFileName = fileName.toLowerCase();

    // Map both full path (e.g. "images/focus.png") and filename ("focus.png")
    const imageInfo = {
      entry,
      fileName,
      getBlob: async () => {
        const arrayBuffer = await entry.async('arraybuffer');
        const ext = lowerFileName.slice(lowerFileName.lastIndexOf('.'));
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        if (ext === '.webp') mimeType = 'image/webp';
        return new Blob([arrayBuffer], { type: mimeType });
      },
      path: filePath,
    };

    zipImagesMap.set(normalized, imageInfo);
    if (!zipImagesMap.has(lowerFileName)) {
      zipImagesMap.set(lowerFileName, imageInfo);
    }
  }

  // 3. Validate image references in each row
  const imageErrors = [];
  const referencedImageKeys = new Set();

  for (const { data, rowNumber } of rows) {
    const rawImagePath = String(data.imagePath || '').trim();
    const rawImageUrl = String(data.imageUrl || '').trim();
    const rawImage = rawImagePath || rawImageUrl;
    const errorField = rawImagePath ? 'imagePath' : 'imageUrl';

    if (!rawImage) continue;

    // If it's an external http/https URL, leave it to normal URL validation
    if (/^https?:\/\//i.test(rawImage)) {
      continue;
    }

    const normalizedRef = normalizeZipImagePath(rawImage);
    const fileNameRef = rawImage.split(/[/|\\]/).pop().toLowerCase();

    const matchedImage = zipImagesMap.get(normalizedRef) || zipImagesMap.get(fileNameRef);

    if (!matchedImage) {
      imageErrors.push({
        field: errorField,
        message: `Row ${rowNumber}: Referenced image "${rawImage}" was not found in the ZIP archive.`,
        quizSlug: String(data.slug || '').trim().toLowerCase(),
        row: rowNumber,
      });
      continue;
    }

    // Validate format extension
    const ext = matchedImage.fileName.slice(matchedImage.fileName.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      imageErrors.push({
        field: errorField,
        message: `Row ${rowNumber}: Referenced image "${rawImage}" has unsupported format "${ext}". Expected JPG, PNG, or WebP.`,
        quizSlug: String(data.slug || '').trim().toLowerCase(),
        row: rowNumber,
      });
      continue;
    }

    // Inspect size
    const blob = await matchedImage.getBlob();
    if (blob.size > MAX_IMAGE_SIZE_BYTES) {
      const sizeKb = Math.round(blob.size / 1024);
      imageErrors.push({
        field: errorField,
        message: `Row ${rowNumber}: Referenced image "${rawImage}" (${sizeKb} KB) exceeds the maximum allowed size of ${MAX_IMAGE_SIZE_KB} KB.`,
        quizSlug: String(data.slug || '').trim().toLowerCase(),
        row: rowNumber,
      });
      continue;
    }

    // Valid and tracked for upload deduplication
    referencedImageKeys.add(matchedImage.path);
  }

  return {
    imageErrors,
    isZip: true,
    referencedImageCount: referencedImageKeys.size,
    rows,
    zipImagesMap,
  };
}
