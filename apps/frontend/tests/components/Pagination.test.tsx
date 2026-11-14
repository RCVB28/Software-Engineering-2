import { fireEvent, render, screen } from '@testing-library/react';
import { Pagination } from '../../src/components/Pagination';

describe('Pagination', () => {
  it('renders the visible range and disables boundary controls', () => {
    const { rerender } = render(
      <Pagination page={2} pageSize={10} total={25} totalPages={3} onPageChange={jest.fn()} />
    );
    expect(screen.getByText('Showing 11-20 of 25')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    rerender(
      <Pagination page={1} pageSize={10} total={25} totalPages={3} onPageChange={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    rerender(
      <Pagination page={3} pageSize={10} total={25} totalPages={3} onPageChange={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('notifies page changes and explains page adjustment', () => {
    const onPageChange = jest.fn();
    render(
      <Pagination
        page={2}
        pageSize={10}
        total={25}
        totalPages={3}
        onPageChange={onPageChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1);

    render(
      <Pagination
        page={99}
        pageSize={10}
        total={25}
        totalPages={3}
        pageAdjusted
        onPageChange={jest.fn()}
      />
    );
    expect(screen.getByText('Requested page adjusted to page 3.')).toBeInTheDocument();
  });

  it('renders an empty state', () => {
    render(
      <Pagination page={1} pageSize={10} total={0} totalPages={1} onPageChange={jest.fn()} />
    );
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
