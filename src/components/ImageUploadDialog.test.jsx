import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageUploadDialog from './ImageUploadDialog';
import { AppNoticeProvider } from '../context/AppNoticeContext';

const mockUploadImageToCloudinary = vi.fn();
vi.mock('../services/cloudinaryService', async () => {
  const actual = await vi.importActual('../services/cloudinaryService');
  return {
    ...actual,
    uploadImageToCloudinary: (...args) => mockUploadImageToCloudinary(...args),
  };
});

const mockViewer = {
  uid: 'admin-123',
  getIdToken: vi.fn().mockResolvedValue('valid-token'),
};

function renderDialog(props = {}) {
  const defaultProps = {
    folder: 'QUIZ',
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    title: 'Upload Image',
    viewer: mockViewer,
    ...props,
  };

  return {
    ...render(
      <AppNoticeProvider>
        <ImageUploadDialog {...defaultProps} />
      </AppNoticeProvider>,
    ),
    props: defaultProps,
  };
}

describe('ImageUploadDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog header, close button, and dropzone text when isOpen is true', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Upload Image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument();
    expect(screen.getByText('Click to browse')).toBeInTheDocument();
    expect(screen.getByText(/or drag & drop your Image/i)).toBeInTheDocument();
    expect(screen.getByText(/Images max 500 KB each \(JPG, PNG, WebP\)/i)).toBeInTheDocument();
  });

  it('rejects files larger than 500 KB and displays error', async () => {
    renderDialog();

    const largeFile = new File([new Uint8Array(550 * 1024)], 'large.png', { type: 'image/png' });
    const input = screen.getByLabelText(/image file input/i);

    fireEvent.change(input, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/image must be 500 kb or smaller/i)).toBeInTheDocument();
    });
    expect(mockUploadImageToCloudinary).not.toHaveBeenCalled();
  });

  it('rejects unsupported file formats and displays error', async () => {
    renderDialog();

    const gifFile = new File([new Uint8Array(100)], 'anim.gif', { type: 'image/gif' });
    const input = screen.getByLabelText(/image file input/i);

    fireEvent.change(input, { target: { files: [gifFile] } });

    await waitFor(() => {
      expect(screen.getByText(/please upload a jpg, png, or webp image/i)).toBeInTheDocument();
    });
    expect(mockUploadImageToCloudinary).not.toHaveBeenCalled();
  });

  it('successfully uploads valid image, calls onSuccess with secure URL and closes', async () => {
    mockUploadImageToCloudinary.mockResolvedValueOnce({
      secureUrl: 'https://res.cloudinary.com/test/image/upload/sample.jpg',
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    renderDialog({ onClose, onSuccess });

    const validFile = new File([new Uint8Array(10 * 1024)], 'photo.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/image file input/i);

    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(mockUploadImageToCloudinary).toHaveBeenCalledWith(validFile, 'QUIZ', mockViewer);
      expect(onSuccess).toHaveBeenCalledWith('https://res.cloudinary.com/test/image/upload/sample.jpg');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('handles drop event with valid image file', async () => {
    mockUploadImageToCloudinary.mockResolvedValueOnce({
      secureUrl: 'https://res.cloudinary.com/test/image/upload/dropped.png',
    });

    const onSuccess = vi.fn();
    renderDialog({ onSuccess });

    const dropzone = screen.getByLabelText(/upload image dropzone/i);
    const validFile = new File([new Uint8Array(20 * 1024)], 'dropped.png', { type: 'image/png' });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [validFile] },
    });

    await waitFor(() => {
      expect(mockUploadImageToCloudinary).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith('https://res.cloudinary.com/test/image/upload/dropped.png');
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderDialog({ onClose });

    await user.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
