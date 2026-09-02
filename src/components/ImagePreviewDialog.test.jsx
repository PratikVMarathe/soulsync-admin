import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImagePreviewDialog from './ImagePreviewDialog';
import { AppNoticeProvider } from '../context/AppNoticeContext';

describe('ImagePreviewDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <AppNoticeProvider>
        <ImagePreviewDialog
          isOpen={false}
          onClose={vi.fn()}
          url="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        />
      </AppNoticeProvider>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders image, url, and copy button when isOpen is true', () => {
    const testUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

    render(
      <AppNoticeProvider>
        <ImagePreviewDialog
          isOpen={true}
          onClose={vi.fn()}
          title="Custom Image Preview"
          url={testUrl}
        />
      </AppNoticeProvider>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Custom Image Preview')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', testUrl);
    expect(screen.getByDisplayValue(testUrl)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <AppNoticeProvider>
        <ImagePreviewDialog
          isOpen={true}
          onClose={handleClose}
          url="https://res.cloudinary.com/demo/image/upload/sample.jpg"
        />
      </AppNoticeProvider>,
    );

    await user.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('copies URL to clipboard and triggers notice when Copy Link is clicked', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    });

    const testUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

    render(
      <AppNoticeProvider>
        <ImagePreviewDialog
          isOpen={true}
          onClose={vi.fn()}
          url={testUrl}
        />
      </AppNoticeProvider>,
    );

    await user.click(screen.getByRole('button', { name: /copy link/i }));
    expect(writeTextMock).toHaveBeenCalledWith(testUrl);
  });
});
