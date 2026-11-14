import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AlertHistory } from '../../src/pages/admin/AlertHistory';
import { api } from '../../src/services/api';

jest.mock('../../src/services/api', () => ({
  api: {
    alerts: {
      history: jest.fn()
    }
  }
}));

const history = api.alerts.history as jest.MockedFunction<typeof api.alerts.history>;

const draft = {
  id: 'alert-draft',
  content: 'Flood warning',
  category: 'FLOOD' as const,
  status: 'DRAFT' as const,
  targets: [{ barangayId: 'barangay-a', residentRole: null }],
  createdAt: '2026-01-05T00:00:00.000Z',
  confirmedAt: null,
  failureCount: 0
};

const completed = {
  id: 'alert-completed',
  content: 'Fire alarm',
  category: 'FIRE' as const,
  status: 'COMPLETED' as const,
  targets: [{ barangayId: 'barangay-b', residentRole: null }],
  createdAt: '2026-01-10T00:00:00.000Z',
  confirmedAt: '2026-01-10T00:01:00.000Z',
  failureCount: 2
};

function page(overrides: Record<string, unknown> = {}) {
  return {
    items: [completed, draft],
    page: 1,
    pageSize: 10,
    total: 2,
    totalPages: 1,
    pageAdjusted: false,
    availableBarangays: [
      { id: 'barangay-a', name: 'Barangay A' },
      { id: 'barangay-b', name: 'Barangay B' }
    ],
    ...overrides
  };
}

describe('Alert history page', () => {
  afterEach(() => jest.clearAllMocks());

  it('applies combined filters and keeps them active across page changes', async () => {
    history
      .mockResolvedValueOnce(page({ total: 25, totalPages: 3 }))
      .mockResolvedValueOnce(page({ total: 25, totalPages: 3 }))
      .mockResolvedValueOnce(page({ page: 2, total: 25, totalPages: 3 }));

    render(
      <MemoryRouter>
        <AlertHistory />
      </MemoryRouter>
    );

    expect(await screen.findByText('Fire alarm')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'COMPLETED' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'FIRE' } });
    fireEvent.change(screen.getByLabelText('Barangay'), { target: { value: 'barangay-b' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-31' } });
    fireEvent.change(screen.getByLabelText('Search message'), { target: { value: 'fire' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      expect(history).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 10,
        status: 'COMPLETED',
        category: 'FIRE',
        barangayId: 'barangay-b',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T23:59:59.999Z',
        q: 'fire'
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(history).toHaveBeenLastCalledWith({
        page: 2,
        pageSize: 10,
        status: 'COMPLETED',
        category: 'FIRE',
        barangayId: 'barangay-b',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T23:59:59.999Z',
        q: 'fire'
      });
    });
  });

  it('shows total and empty states and can reset filters', async () => {
    history
      .mockResolvedValueOnce(page({ items: [], total: 0, totalPages: 0 }))
      .mockResolvedValueOnce(page());

    render(
      <MemoryRouter>
        <AlertHistory />
      </MemoryRouter>
    );

    expect(await screen.findByText('No alerts match these filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));

    expect(await screen.findByText('Fire alarm')).toBeInTheDocument();
    expect(history).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
  });

  it('links drafts to the editor and completed alerts to delivery results', async () => {
    history.mockResolvedValue(page());

    render(
      <MemoryRouter>
        <AlertHistory />
      </MemoryRouter>
    );

    const draftLink = await screen.findByRole('link', { name: 'Flood warning' });
    expect(draftLink).toHaveAttribute('href', '/admin/alerts/alert-draft');
    const completedLink = screen.getByRole('link', { name: 'Fire alarm' });
    expect(completedLink).toHaveAttribute('href', '/admin/alerts/alert-completed/deliveries');
    expect(screen.getByText('2 failed')).toBeInTheDocument();
  });
});
