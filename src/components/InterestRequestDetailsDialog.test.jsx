import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InterestRequestDetailsDialog from './InterestRequestDetailsDialog';

const mockRequest = {
  id: 'req-1',
  satsangCentralId: 'opp-1',
  opportunityTitle: 'Bhagavad Gita Wisdom Class',
  category: 'CLASS',
  name: 'Radha Sharma',
  email: 'radha@example.com',
  phoneNumber: '9123456780',
  age: 22,
  passion: 'STUDENT',
  institutionName: 'COEP Tech',
  mode: 'ONLINE',
  language: 'HINDI',
  preferredDay: 'SUNDAY',
  description: 'Excited to attend Gita sessions.',
  status: 'NEW',
  requestedAt: { seconds: 1700000000 },
};

describe('InterestRequestDetailsDialog', () => {
  it('renders all user submitted details correctly', () => {
    render(
      <InterestRequestDetailsDialog
        isOpen={true}
        onClose={vi.fn()}
        request={mockRequest}
      />,
    );

    expect(screen.getByText('User Interest Details')).toBeInTheDocument();
    expect(screen.getByText('Bhagavad Gita Wisdom Class')).toBeInTheDocument();
    expect(screen.getByText('Radha Sharma')).toBeInTheDocument();
    expect(screen.getByText('22 years')).toBeInTheDocument();
    expect(screen.getByText('radha@example.com')).toBeInTheDocument();
    expect(screen.getByText('9123456780')).toBeInTheDocument();
    expect(screen.getByText('Student')).toBeInTheDocument();
    expect(screen.getByText('COEP Tech')).toBeInTheDocument();
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
    expect(screen.getByText('HINDI')).toBeInTheDocument();
    expect(screen.getByText('SUNDAY')).toBeInTheDocument();
    expect(screen.getByText('"Excited to attend Gita sessions."')).toBeInTheDocument();
  });

  it('calls onStatusChange when status is updated', async () => {
    const onStatusChange = vi.fn();
    const user = userEvent.setup();

    render(
      <InterestRequestDetailsDialog
        isOpen={true}
        onClose={vi.fn()}
        onStatusChange={onStatusChange}
        request={mockRequest}
      />,
    );

    const select = screen.getByRole('combobox', { name: /update interest status/i });
    await user.selectOptions(select, 'CONTACTED');

    expect(onStatusChange).toHaveBeenCalledWith(mockRequest, 'CONTACTED');
  });

  it('calls onClose when close button is clicked or Escape key pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <InterestRequestDetailsDialog
        isOpen={true}
        onClose={onClose}
        request={mockRequest}
      />,
    );

    const closeBtn = screen.getByRole('button', { name: /^close$/i });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
