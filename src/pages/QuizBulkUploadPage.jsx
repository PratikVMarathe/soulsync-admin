import { useState } from 'react';
import AdminIcon from '../components/AdminIcon';
import AppStatusView from '../components/AppStatusView';
import QuizBulkUploadErrors from '../components/quiz/QuizBulkUploadErrors';
import QuizBulkUploadPreview from '../components/quiz/QuizBulkUploadPreview';
import QuizCsvDropzone from '../components/quiz/QuizCsvDropzone';
import { USER_ROLES } from '../constants/auth';
import { UPLOAD_FOLDERS } from '../constants/upload';
import { useAppNotice } from '../hooks/useAppNotice';
import { uploadImageToCloudinary } from '../services/cloudinaryService';
import {
  checkExistingQuizSlugs,
  importQuizBatch,
} from '../services/quizBulkUploadService';
import {
  downloadQuizCsvTemplate,
  parseQuizCsv,
} from '../utils/quizCsvParser';
import { validateAndGroupQuizRows } from '../utils/quizCsvValidator';
import { normalizeZipImagePath, parseQuizZip } from '../utils/quizZipParser';

async function readTextFromFile(file) {
  if (typeof file?.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file content.'));
    reader.readAsText(file);
  });
}

export default function QuizBulkUploadPage({ onBack, onSaved, viewer }) {
  const { showNotice } = useAppNotice();
  const isQuizAdmin = [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(viewer?.role);

  const [fileInfo, setFileInfo] = useState(null);
  const [zipImagesMap, setZipImagesMap] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [validationResult, setValidationResult] = useState(null);

  if (!isQuizAdmin) {
    return (
      <AppStatusView
        state={{
          message: 'Only Admin and Super Admin accounts can perform Quiz Bulk Upload.',
          statusCode: 403,
          title: 'Quiz Bulk Upload Access Required',
        }}
      />
    );
  }

  const handleReset = () => {
    setFileInfo(null);
    setZipImagesMap(null);
    setValidationResult(null);
    setImportProgress(null);
    setIsParsing(false);
    setIsImporting(false);
  };

  const handleFileSelect = async (file, errorType) => {
    if (errorType === 'INVALID_TYPE') {
      showNotice('Please select a valid CSV (.csv) or ZIP (.zip) file.', 'error');
      return;
    }

    if (!file) return;

    setIsParsing(true);
    setValidationResult(null);
    setZipImagesMap(null);

    const isZip = file.name.toLowerCase().endsWith('.zip');

    try {
      let rows = [];
      let zipMap = null;
      let zipImageErrors = [];
      let imageCount = 0;

      if (isZip) {
        const parsedZip = await parseQuizZip(file);
        rows = parsedZip.rows;
        zipMap = parsedZip.zipImagesMap;
        zipImageErrors = parsedZip.imageErrors || [];
        imageCount = parsedZip.referencedImageCount || 0;
        setZipImagesMap(zipMap);
      } else {
        const csvText = await readTextFromFile(file);
        const parsed = parseQuizCsv(csvText);
        rows = parsed.rows;
      }

      // Extract unique slugs to check against Firestore
      const rawSlugs = Array.from(new Set(
        rows.map((r) => String(r.data?.slug || '').trim().toLowerCase()).filter(Boolean),
      ));

      let existingSlugs = new Set();
      try {
        existingSlugs = await checkExistingQuizSlugs(rawSlugs, viewer);
      } catch (dbError) {
        console.error('Failed to check existing slugs in Firestore:', dbError);
      }

      const result = validateAndGroupQuizRows(rows, existingSlugs);

      if (zipImageErrors.length > 0) {
        result.errors = [...result.errors, ...zipImageErrors];
        result.isValid = false;
      }

      setFileInfo({
        imageCount,
        name: file.name,
        quizCount: result.quizCount,
        rowCount: rows.length,
        size: file.size,
      });

      setValidationResult(result);
    } catch (err) {
      console.error('Bulk Upload Parsing Error:', err);
      setFileInfo({
        imageCount: 0,
        name: file.name,
        quizCount: 0,
        rowCount: 0,
        size: file.size,
      });
      setValidationResult({
        errors: [{ field: 'file', message: err.message || 'Failed to parse file.', quizSlug: '', row: 1 }],
        isValid: false,
        quizCount: 0,
        quizzes: [],
        totalQuestionsCount: 0,
      });
      showNotice(err.message || 'Failed to parse file.', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!validationResult || !validationResult.isValid || validationResult.quizzes.length === 0) {
      return;
    }

    setIsImporting(true);
    setImportProgress({
      percentage: 0,
      processedCount: 0,
      totalCount: validationResult.quizzes.length,
    });

    try {
      let quizzesToImport = validationResult.quizzes;

      // If ZIP images are present, upload unique images to Cloudinary first
      if (zipImagesMap && zipImagesMap.size > 0) {
        const uniqueImageRefs = new Map(); // path -> imageInfo

        validationResult.quizzes.forEach((quiz) => {
          const rawImage = String(quiz.imagePath || quiz.imageUrl || '').trim();
          if (rawImage && !/^https?:\/\//i.test(rawImage)) {
            const normalized = normalizeZipImagePath(rawImage);
            const fileName = rawImage.split(/[/|\\]/).pop().toLowerCase();
            const matched = zipImagesMap.get(normalized) || zipImagesMap.get(fileName);
            if (matched && !uniqueImageRefs.has(matched.path)) {
              uniqueImageRefs.set(matched.path, matched);
            }
          }
        });

        const cloudinaryUrlMap = new Map();
        const totalImages = uniqueImageRefs.size;
        let uploadedImageCount = 0;

        for (const [imagePath, imageInfo] of uniqueImageRefs.entries()) {
          const blob = await imageInfo.getBlob();
          const fileObj = new File([blob], imageInfo.fileName, { type: blob.type });

          const uploadResult = await uploadImageToCloudinary(fileObj, UPLOAD_FOLDERS.QUIZ, viewer);
          const secureUrl = uploadResult.secureUrl;

          cloudinaryUrlMap.set(imagePath, secureUrl);
          cloudinaryUrlMap.set(normalizeZipImagePath(imagePath), secureUrl);
          cloudinaryUrlMap.set(imageInfo.fileName.toLowerCase(), secureUrl);

          uploadedImageCount += 1;
          setImportProgress({
            percentage: Math.round((uploadedImageCount / Math.max(1, totalImages)) * 40),
            processedCount: 0,
            totalCount: validationResult.quizzes.length,
          });
        }

        // Map resolved Cloudinary URLs into quizzes and strip import-only imagePath
        quizzesToImport = validationResult.quizzes.map((quiz) => {
          const { imagePath: _unusedPath, ...cleanQuiz } = quiz;
          const rawImage = String(quiz.imagePath || quiz.imageUrl || '').trim();

          if (!rawImage) {
            return { ...cleanQuiz, imageUrl: '' };
          }

          if (/^https?:\/\//i.test(rawImage)) {
            return { ...cleanQuiz, imageUrl: rawImage };
          }

          const normalized = normalizeZipImagePath(rawImage);
          const fileName = rawImage.split(/[/|\\]/).pop().toLowerCase();
          const secureUrl = cloudinaryUrlMap.get(normalized)
            || cloudinaryUrlMap.get(fileName)
            || cloudinaryUrlMap.get(rawImage);

          return {
            ...cleanQuiz,
            imageUrl: secureUrl || '',
          };
        });
      } else {
        // Ensure imagePath is omitted even when importing plain CSV without ZIP
        quizzesToImport = validationResult.quizzes.map(({ imagePath: _unusedPath, ...cleanQuiz }) => cleanQuiz);
      }

      const result = await importQuizBatch({
        onProgress: (prog) => {
          setImportProgress({
            percentage: 40 + Math.round(prog.percentage * 0.6),
            processedCount: prog.processedCount,
            totalCount: prog.totalCount,
          });
        },
        quizzes: quizzesToImport,
        viewer,
      });

      showNotice(
        `${result.successCount} ${result.successCount === 1 ? 'quiz' : 'quizzes'} imported successfully.`,
        'success',
      );

      if (typeof onSaved === 'function') {
        onSaved();
      } else if (typeof onBack === 'function') {
        onBack();
      }
    } catch (err) {
      console.error('Import Failed:', err);
      showNotice(
        err.publicMessage || err.message || 'Quiz import failed. No quizzes were created.',
        'error',
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="admin-profile-page">
      <div className="admin-profile-container">
        {/* Page Hero */}
        <header className="admin-page-hero">
          <div className="admin-page-hero-copy">
            <button
              aria-label="Back to Quiz Management"
              className="ghost-cta is-compact admin-back-link"
              disabled={isImporting}
              onClick={onBack}
              type="button"
            >
              <AdminIcon name="arrowLeft" size={16} />
              <span>Back to Quiz Management</span>
            </button>

            <div className="admin-page-hero-title-row">
              <h1>Bulk Upload Quizzes</h1>
              <span className="admin-badge is-accent">CSV Ingestion</span>
            </div>
            <p>
              Upload multiple SoulSync concept quizzes and scripture-grounded questions simultaneously using a standardized CSV file.
            </p>
          </div>
        </header>

        {/* Step 1: Download Template */}
        <section className="admin-panel admin-bulk-upload-step-card">
          <header className="admin-panel-header">
            <div>
              <h2>Step 1 — Download CSV Template</h2>
              <p>Download the standardized CSV template, fill in one question per row, then upload it below.</p>
            </div>
            <button
              className="primary-cta is-compact"
              disabled={isImporting}
              onClick={downloadQuizCsvTemplate}
              type="button"
            >
              <AdminIcon name="downloadCloud" size={16} />
              <span>Download Template (.csv)</span>
            </button>
          </header>

          <div className="admin-bulk-summary-container">
            <div className="admin-bulk-columns-summary">
              <div className="admin-bulk-column-category">
                <strong>Quiz Metadata</strong>
                <p>title, slug, description, status, allowRetake, level, category, estimatedMinutes, visualKey, imagePath, imageUrl, imageAlt, expireAt</p>
              </div>
              <div className="admin-bulk-column-category">
                <strong>Question Data</strong>
                <p>questionId, questionText, option1, option2, option3, option4, correctIndex (0-3), time (seconds)</p>
              </div>
              <div className="admin-bulk-column-category">
                <strong>Scripture Reference</strong>
                <p>referenceSource, referenceChapter, referenceVerse, referenceText</p>
              </div>
            </div>
            <p className="admin-bulk-column-note">
              Note: Only <strong>title</strong> and <strong>slug</strong> are required fields for each quiz.
            </p>
            <p className="admin-bulk-column-note">
              <strong>imagePath</strong> is an import-only relative path inside an uploaded ZIP package (e.g. <code>images/focus.png</code>). Uploaded images are sent directly to Cloudinary and saved to <code>imageUrl</code>.
            </p>
            <p className="admin-bulk-column-note">
              <strong>expireAt</strong> is optional (format: <code>YYYY-MM-DDTHH:mm:ss</code>, e.g. <code>2026-12-31T23:59:59</code>).
            </p>
          </div>
        </section>

        {/* Step 2: Upload CSV */}
        <section className="admin-panel admin-bulk-upload-step-card">
          <header className="admin-panel-header">
            <div>
              <h2>Step 2 — Upload CSV File</h2>
              <p>Select or drag and drop your completed CSV file to run automated validation.</p>
            </div>
          </header>

          <QuizCsvDropzone
            fileInfo={fileInfo}
            isLoading={isParsing || isImporting}
            onFileSelect={handleFileSelect}
            onReset={handleReset}
          />
        </section>

        {/* Step 3: Errors or Preview */}
        {validationResult && !validationResult.isValid ? (
          <QuizBulkUploadErrors errors={validationResult.errors} />
        ) : null}

        {validationResult && validationResult.isValid ? (
          <QuizBulkUploadPreview
            importProgress={importProgress}
            isImporting={isImporting}
            onCancel={handleReset}
            onImport={handleImport}
            quizzes={validationResult.quizzes}
            totalQuestionsCount={validationResult.totalQuestionsCount}
          />
        ) : null}
      </div>
    </div>
  );
}
