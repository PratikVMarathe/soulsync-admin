import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppNoticeProvider } from '../context/AppNoticeContext';
import MandalaOpportunityEditorPage from './MandalaOpportunityEditorPage';

const mockCreateSatsangOpportunity = vi.fn();
const mockUpdateSatsangOpportunity = vi.fn();
const mockFetchSatsangOpportunities = vi.fn();

vi.mock('../services/mandalaAdminService', () => ({
  SATSANG_CATEGORIES: {
    CLASS: 'CLASS',
    EVENT: 'EVENT',
    FESTIVAL: 'FESTIVAL',
  },
  SATSANG_STATUSES: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
  },
  createSatsangOpportunity: (...args) => mockCreateSatsangOpportunity(...args),
  updateSatsangOpportunity: (...args) => mockUpdateSatsangOpportunity(...args),
  fetchSatsangOpportunities: (...args) => mockFetchSatsangOpportunities(...args),
}));

vi.mock('../services/cloudinaryService', () => ({
  uploadAdminImage: vi.fn(),
  validateImageFile: vi.fn(),
}));

const mockViewer = {
  uid: 'admin-123',
  email: 'admin@soulsync.dev',
  role: 'ADMIN',
};

function renderEditor(props = {}) {
  const defaultProps = {
    onBack: vi.fn(),
    onSaved: vi.fn(),
    viewer: mockViewer,
    ...props,
  };

  return render(
    <AppNoticeProvider>
      <MandalaOpportunityEditorPage {...defaultProps} />
    </AppNoticeProvider>,
  );
}

describe('MandalaOpportunityEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Class Configuration in Basic Information when category is CLASS', async () => {
    renderEditor();

    // Default category is CLASS
    expect(screen.getByRole('heading', { name: 'Class Configuration' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Available Modes/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Available Languages/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Available Day/i })).toBeInTheDocument();

    // Checkboxes for modes (Online, Offline)
    expect(screen.getByLabelText('Online')).toBeInTheDocument();
    expect(screen.getByLabelText('Offline')).toBeInTheDocument();
  });

  it('hides Class Configuration when category is switched to EVENT or FESTIVAL', async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(screen.getByRole('heading', { name: 'Class Configuration' })).toBeInTheDocument();

    const categorySelect = screen.getByLabelText(/^Category/i);
    await user.selectOptions(categorySelect, 'EVENT');

    expect(screen.queryByRole('heading', { name: 'Class Configuration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Available Modes/i })).not.toBeInTheDocument();

    await user.selectOptions(categorySelect, 'FESTIVAL');
    expect(screen.queryByRole('heading', { name: 'Class Configuration' })).not.toBeInTheDocument();
  });

  it('submits CLASS opportunity with classDetails payload', async () => {
    mockCreateSatsangOpportunity.mockResolvedValueOnce('opp-new-1');
    const onSaved = vi.fn();
    const user = userEvent.setup();

    renderEditor({ onSaved });

    const titleInput = screen.getByLabelText(/opportunity title/i);
    await user.type(titleInput, 'Bhagavad Gita Wisdom');

    const saveBtn = screen.getByRole('button', { name: /save & go back/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockCreateSatsangOpportunity).toHaveBeenCalledWith(
        mockViewer,
        expect.objectContaining({
          title: 'Bhagavad Gita Wisdom',
          category: 'CLASS',
          classDetails: expect.objectContaining({
            availableModes: ['ONLINE', 'OFFLINE'],
            availableLanguages: ['ENGLISH', 'HINDI'],
            availableDays: ['SATURDAY', 'SUNDAY'],
          }),
        }),
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('validates that available modes, languages, and days cannot be empty for CLASS', async () => {
    const user = userEvent.setup();
    renderEditor();

    const titleInput = screen.getByLabelText(/opportunity title/i);
    await user.type(titleInput, 'Gita Study Circle');

    // Uncheck modes
    await user.click(screen.getByLabelText('Online'));
    await user.click(screen.getByLabelText('Offline'));

    const saveBtn = screen.getByRole('button', { name: /save & go back/i });
    await user.click(saveBtn);

    expect(screen.getByText('At least one Available Mode is required.')).toBeInTheDocument();
    expect(mockCreateSatsangOpportunity).not.toHaveBeenCalled();
  });
});
