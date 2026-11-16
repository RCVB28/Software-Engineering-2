import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../src/components/StatusBadge';

describe('StatusBadge', () => {
  it('humanizes status labels', () => {
    render(<StatusBadge status="ACKNOWLEDGED" />);
    expect(screen.getByText('Acknowledged')).toBeInTheDocument();
  });

  it('renders an alert style for critical statuses', () => {
    render(<StatusBadge status="CRITICAL" />);
    const badge = screen.getByText('Critical');
    expect(badge.className).toContain('bg-rose-600');
  });

  it('falls back gracefully for unknown statuses', () => {
    render(<StatusBadge status="UNKNOWN_STATE" />);
    expect(screen.getByText('Unknown State')).toBeInTheDocument();
  });
});
