import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MandalaUpdatesPage from './MandalaUpdatesPage';

const mockFetchSatsangOpportunities = vi.fn();
const mockFetchInterestRequests = vi.fn();
const mockDeleteSatsangOpportunity = vi.fn();
const mockDeleteInterestRequest = vi.fn();
const mockUpdateInterestRequestStatus = vi.fn();

vi.mock('../services/mandalaAdminService', () => ({
  CATEGORY_LABELS: {
    CLASS: 'Class',
    EVENT: 'Event',
    FESTIVAL: 'Festival',
  },
  INTEREST_REQUEST_STATUSES: {
    NEW: 'NEW',
    CONTACTED: 'CONTACTED',
    FOLLOW_UP: 'FOLLOW_UP',
    CONNECTED: 'CONNECTED',
    CLOSED: 'CLOSED',
  },
  SATSANG_CATEGORIES: {
    CLASS: 'CLASS',
    EVENT: 'EVENT',
    FESTIVAL: 'FESTIVAL',
  },
  SATSANG_STATUSES: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
  },
  fetchSatsangOpportunities: (...args) => mockFetchSatsangOpportunities(...args),
  fetchInterestRequests: (...args) => mockFetchInterestRequests(...args),
  deleteSatsangOpportunity: (...args) => mockDeleteSatsangOpportunity(...args),
  deleteInterestRequest: (...args) => mockDeleteInterestRequest(...args),
  updateInterestRequestStatus: (...args) => mockUpdateInterestRequestStatus(...args),
}));

const mockViewer = {
  uid: 'admin-123',
  email: 'admin@soulsync.dev',
  role: 'ADMIN',
};

const mockInterestRequests = [
  {
    id: 'req-1',
    userId: 'user-1',
    satsangCentralId: 'opp-gita-1',
    opportunityTitle: 'Bhagavad Gita Class',
    category: 'CLASS',
    name: 'Pratik Marathe',
    email: 'pratik@example.com',
    phoneNumber: '9876543210',
    age: 25,
    passion: 'STUDENT',
    institutionName: 'Pune University',
    mode: 'ONLINE',
    language: 'ENGLISH',
    preferredDay: 'SATURDAY',
    description: 'Looking forward to learning Gita verses',
    status: 'NEW',
    requestedAt: { seconds: 1700000000 },
  },
];

describe('MandalaUpdatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSatsangOpportunities.mockResolvedValue([]);
    mockFetchInterestRequests.mockResolvedValue(mockInterestRequests);
  });

  it('renders Interested Users tab and clicking View opens user interest details dialog', async () => {
    const onEditOpportunity = vi.fn();
    const user = userEvent.setup();

    render(
      <MandalaUpdatesPage
        onCreateOpportunity={vi.fn()}
        onEditOpportunity={onEditOpportunity}
        viewer={mockViewer}
      />,
    );

    // Switch to Interested Users tab
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /interested users/i })).toBeInTheDocument();
    });

    const tabBtn = screen.getByRole('tab', { name: /interested users/i });
    await user.click(tabBtn);

    await waitFor(() => {
      expect(screen.getByText('Pratik Marathe')).toBeInTheDocument();
      expect(screen.getByText(/25 yrs/i)).toBeInTheDocument();
      expect(screen.getByText(/STUDENT: Pune University/i)).toBeInTheDocument();
    });

    // View button is present
    const viewBtn = screen.getByRole('button', { name: /^view$/i });
    expect(viewBtn).toBeInTheDocument();

    // Clicking View button opens User Interest Details modal
    await user.click(viewBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('User Interest Details')).toBeInTheDocument();
    expect(within(dialog).getByText('pratik@example.com')).toBeInTheDocument();
    expect(within(dialog).getByText('9876543210')).toBeInTheDocument();
    expect(within(dialog).getByText('Pune University')).toBeInTheDocument();
    expect(within(dialog).getByText(/Looking forward to learning Gita verses/i)).toBeInTheDocument();

    // Close modal
    const closeBtn = within(dialog).getByRole('button', { name: /close dialog/i });
    await user.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
