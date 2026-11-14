import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ResidentAlertHistory } from '../../src/pages/subscriber/AlertHistory';
import { api } from '../../src/services/api';

jest.mock('../../src/services/api', () => ({
  api: {
    residents: {
      alertHistory: jest.fn()
    }
  }
}));

const history = api.residents.alertHistory as jest.MockedFunction<
  typeof api.residents.alertHistory
>;

function page(overrides: Record<string, unknown> = {}) {
  return {
    items: [],
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
    pageAdjusted: false,
    ...overrides
  };
}

describe('ResidentAlertHistory', () => {
  beforeEach(() => {
    history.mockReset();
  });

  it('renders message, send time, category, and outcome labels', async () => {
    history.mockResolvedValueOnce(
      page({
        total: 4,
        totalPages: 1,
        items: [
          {
            alertId: 'alert-1',
            category: 'FIRE',
            content: 'Evacuate the east wing',
            sentAt: '2026-02-01T08:30:00.000Z',
            outcome: 'SUCCESS'
          },
          {
            alertId: 'alert-2',
            category: 'FLOOD',
            content: 'Move to higher ground',
            sentAt: '2026-02-02T09:00:00.000Z',
            outcome: 'FAILURE'
          },
          {
            alertId: 'alert-3',
            category: 'MEDICAL',
            content: 'Clinic is open',
            sentAt: '2026-02-03T10:00:00.000Z',
            outcome: 'PARTIAL'
          },
          {
            alertId: 'alert-4',
            category: 'SECURITY_THREAT',
            content: 'Lock your doors',
            sentAt: '2026-02-04T11:00:00.000Z',
            outcome: 'PENDING'
          }
        ]
      })
    );

    render(<ResidentAlertHistory />);

    expect(await screen.findByText('Evacuate the east wing')).toBeInTheDocument();
    expect(screen.getByText('Fire')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Partially delivered')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getAllByText(/Sent .*2026/)).toHaveLength(4);
  });

  it('pages to the next requested page', async () => {
    history.mockResolvedValueOnce(
      page({
        total: 12,
        totalPages: 2,
        items: [
          {
            alertId: 'alert-1',
            category: 'FIRE',
            content: 'First page alert',
            sentAt: '2026-02-01T08:30:00.000Z',
            outcome: 'SUCCESS'
          }
        ]
      })
    );
    history.mockResolvedValueOnce(
      page({
        page: 2,
        total: 12,
        totalPages: 2,
        items: [
          {
            alertId: 'alert-11',
            category: 'FLOOD',
            content: 'Second page alert',
            sentAt: '2026-02-11T08:30:00.000Z',
            outcome: 'PENDING'
          }
        ]
      })
    );

    render(<ResidentAlertHistory />);
    expect(await screen.findByText('First page alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Second page alert')).toBeInTheDocument();
    await waitFor(() => expect(history).toHaveBeenLastCalledWith(2));
  });

  it('shows an empty state when the resident has no alerts', async () => {
    history.mockResolvedValueOnce(page());

    render(<ResidentAlertHistory />);

    expect(await screen.findByText('No alert history yet.')).toBeInTheDocument();
    expect(history).toHaveBeenCalledWith(1);
  });
});
