import JSZip from 'jszip';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuizBulkUploadPage from './QuizBulkUploadPage';
import { generateQuizCsvTemplate } from '../utils/quizCsvParser';

const mockShowNotice = vi.fn();
vi.mock('../hooks/useAppNotice', () => ({
  useAppNotice: () => ({ showNotice: mockShowNotice }),
}));

vi.mock('../services/quizBulkUploadService', () => ({
  checkExistingQuizSlugs: vi.fn(async () => new Set()),
  importQuizBatch: vi.fn(async ({ quizzes }) => ({
    createdQuizIds: quizzes.map((_, i) => `mock-quiz-${i + 1}`),
    successCount: quizzes.length,
  })),
}));

const mockUploadImageToCloudinary = vi.fn(async (_file) => ({
  secureUrl: 'https://res.cloudinary.com/soulsync/image/upload/f_auto,q_auto/v1/soulsync/quiz-images/mock-uploaded.png',
  publicId: 'soulsync/quiz-images/mock-uploaded',
}));

vi.mock('../services/cloudinaryService', () => ({
  getImageApiBaseUrl: () => 'http://localhost:5003',
  uploadImageToCloudinary: (file, folder, viewer) => mockUploadImageToCloudinary(file, folder, viewer),
  validateImageFile: vi.fn(() => ({ valid: true, error: null })),
  warmupImageApi: vi.fn(),
}));

const ADMIN_VIEWER = {
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'ADMIN',
  uid: 'admin_123',
};

const USER_VIEWER = {
  email: 'user@example.com',
  name: 'Standard User',
  role: 'USER',
  uid: 'user_123',
};

describe('QuizBulkUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 403 access required view for unauthorized users', () => {
    render(
      <QuizBulkUploadPage
        onBack={vi.fn()}
        onSaved={vi.fn()}
        viewer={USER_VIEWER}
      />,
    );

    expect(screen.getByText(/quiz bulk upload access required/i)).toBeInTheDocument();
  });

  it('renders hero, template download, and dropzone for authorized admin', () => {
    render(
      <QuizBulkUploadPage
        onBack={vi.fn()}
        onSaved={vi.fn()}
        viewer={ADMIN_VIEWER}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: /bulk upload quizzes/i })).toBeInTheDocument();
    expect(screen.getByText(/step 1 — download csv template/i)).toBeInTheDocument();
    expect(screen.getByText(/step 2 — upload csv file/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upload csv or zip file dropzone/i)).toBeInTheDocument();
  });

  it('displays validation errors when an invalid CSV is uploaded', async () => {
    render(
      <QuizBulkUploadPage
        onBack={vi.fn()}
        onSaved={vi.fn()}
        viewer={ADMIN_VIEWER}
      />,
    );

    const invalidCsv = 'title,slug,description,status,allowRetake,level,category,estimatedMinutes,visualKey,imagePath,imageUrl,imageAlt,expireAt,questionId,questionText,option1,option2,option3,option4,correctIndex,time,referenceSource,referenceChapter,referenceVerse,referenceText\n'
      + 'Focus,focus,Desc,ACTIVE,true,BEGINNER,focus,1,,,,,,q1,Question,A,B,C,D,99,30,,,,';

    const file = new File([invalidCsv], 'invalid.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/upload csv or zip file input/i);

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/validation error/i)).toBeInTheDocument();
      expect(screen.getByText(/correctIndex must be an integer between 0 and 3/i)).toBeInTheDocument();
    });
  });

  it('displays preview and allows importing valid CSV', async () => {
    const onSavedMock = vi.fn();
    render(
      <QuizBulkUploadPage
        onBack={vi.fn()}
        onSaved={onSavedMock}
        viewer={ADMIN_VIEWER}
      />,
    );

    const validCsv = generateQuizCsvTemplate();
    const file = new File([validCsv], 'valid_quizzes.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/upload csv or zip file input/i);

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/import preview/i)).toBeInTheDocument();
      expect(screen.getByText(/concept 1: focus/i)).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /import 1 quiz/i });
    expect(importBtn).toBeInTheDocument();

    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(mockShowNotice).toHaveBeenCalledWith(
        expect.stringMatching(/1 quiz imported successfully/i),
        'success',
      );
      expect(onSavedMock).toHaveBeenCalled();
    });
  });

  it('handles valid ZIP upload, uploads images to Cloudinary and imports quizzes', async () => {
    const onSavedMock = vi.fn();
    render(
      <QuizBulkUploadPage
        onBack={vi.fn()}
        onSaved={onSavedMock}
        viewer={ADMIN_VIEWER}
      />,
    );

    const sampleCsv = `title,slug,description,status,allowRetake,level,category,estimatedMinutes,visualKey,imagePath,imageUrl,imageAlt,expireAt,questionId,questionText,option1,option2,option3,option4,correctIndex,time,referenceSource,referenceChapter,referenceVerse,referenceText
Concept 1: Focus,focus,Learn focus,ACTIVE,true,BEGINNER,focus,1,focus-lake,images/focus.png,,Person meditating,,q1,Question 1,Option A,Option B,Option C,Option D,0,30,Bhagavad Gita,6,35,Detachment`;

    const zip = new JSZip();
    zip.file('quizzes.csv', sampleCsv);
    zip.file('images/focus.png', new Uint8Array(5000)); // 5 KB

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipFile = new File([zipBlob], 'quizzes_with_images.zip', { type: 'application/zip' });

    const input = screen.getByLabelText(/upload csv or zip file input/i);
    fireEvent.change(input, { target: { files: [zipFile] } });

    await waitFor(() => {
      expect(screen.getByText(/import preview/i)).toBeInTheDocument();
      expect(screen.getByText(/quizzes_with_images.zip/i)).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /import 1 quiz/i });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(mockUploadImageToCloudinary).toHaveBeenCalled();
      expect(mockShowNotice).toHaveBeenCalledWith(
        expect.stringMatching(/1 quiz imported successfully/i),
        'success',
      );
      expect(onSavedMock).toHaveBeenCalled();
    });
  });
});
