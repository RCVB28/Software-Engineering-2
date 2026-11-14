import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Notifications } from '../../src/pages/admin/Notifications';
import { api } from '../../src/services/api';

jest.mock('../../src/services/api', () => ({
  api: {
    notifications: {
      list: jest.fn(),
      acknowledge: jest.fn()
    }
  }
}));

const list = api.notifications.list as jest.MockedFunction<typeof api.notifications.list>;
const acknowledge = api.notifications.acknowledge as jest.MockedFunction<
  typeof api.notifications.acknowledge
>;

const notification = {
  id: 'notification-1',
  alertId: 'alert-1',
  alertCategory: 'FIRE' as const,
  alertContent: 'Fire at the market',
  failureCount: 3,
  completedAt: '2026-01-02T03:04:05.000Z',
  readAt: null,
  createdAt: '2026-01-02T03:04:06.000Z'
};

function page(overrides: Record<string, unknown> = {}) {
  return {
    items: [notification],
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
    unreadCount: 1,
    ...overrides
  };
}

describe('Notifications page', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders history fields and delivery links', async () => {
    list.mockResolvedValue(page());

    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );

    expect(await screen.findByText('Fire at the market')).toBeInTheDocument();
    expect(screen.getByText('3 failed deliveries')).toBeInTheDocument();
    expect(screen.getByText('Fire')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View delivery results' })
    ).toHaveAttribute('href', '/admin/alerts/alert-1/deliveries');
  });

  it('acknowledges a notification and updates the history', async () => {
    list
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce(
        page({
          items: [{ ...notification, readAt: '2026-01-03T00:00:00.000Z' }],
          unreadCount: 0
        })
      );
    acknowledge.mockResolvedValue({ ...notification, readAt: '2026-01-03T00:00:00.000Z' });

    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge' }));

    await waitFor(() => {
      expect(acknowledge).toHaveBeenCalledWith('notification-1');
      expect(screen.getByText('Acknowledged')).toBeInTheDocument();
    });
    expect(screen.getByText('Fire at the market')).toBeInTheDocument();
  });

  it('renders the empty state', async () => {
    list.mockResolvedValue(
      page({ items: [], total: 0, totalPages: 0, unreadCount: 0 })
    );

    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );

    expect(await screen.findByText('No failure notifications.')).toBeInTheDocument();
  });
});
