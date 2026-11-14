import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationBell } from '../../src/components/NotificationBell';
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
  alertCategory: 'FLOOD' as const,
  alertContent: 'Evacuate immediately',
  failureCount: 2,
  completedAt: '2026-01-02T03:04:05.000Z',
  readAt: null,
  createdAt: '2026-01-02T03:04:06.000Z'
};

describe('NotificationBell', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows unread count and opens the notification list', async () => {
    list.mockResolvedValue({
      items: [notification],
      page: 1,
      pageSize: 5,
      total: 1,
      totalPages: 1,
      unreadCount: 1
    });

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('1 unread')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('Evacuate immediately')).toBeInTheDocument();
    expect(screen.getByText('2 failed deliveries')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Evacuate immediately' })).toHaveAttribute(
      'href',
      '/admin/alerts/alert-1/deliveries'
    );
  });

  it('acknowledges a notification and shows the zero-unread state', async () => {
    const unreadPage = {
      items: [notification],
      page: 1,
      pageSize: 5,
      total: 1,
      totalPages: 1,
      unreadCount: 1
    };
    list.mockResolvedValue(unreadPage);
    acknowledge.mockImplementation(async () => {
      list.mockResolvedValue({
        ...unreadPage,
        items: [{ ...notification, readAt: '2026-01-03T00:00:00.000Z' }],
        unreadCount: 0
      });
      return { ...notification, readAt: '2026-01-03T00:00:00.000Z' };
    });

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('1 unread')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge' }));

    await waitFor(() => {
      expect(acknowledge).toHaveBeenCalledWith('notification-1');
      expect(screen.getByText('No unread notifications')).toBeInTheDocument();
    });
    expect(screen.queryByText('1 unread')).not.toBeInTheDocument();
  });
});
