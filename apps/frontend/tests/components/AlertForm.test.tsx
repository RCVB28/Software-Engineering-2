import { fireEvent, render, screen } from '@testing-library/react';
import { AlertForm } from '../../src/components/AlertForm';

const barangays = [
  { id: 'barangay-a', name: 'Barangay A' },
  { id: 'barangay-b', name: 'Barangay B' }
];

describe('AlertForm', () => {
  it('prefills an existing draft', () => {
    render(
      <AlertForm
        barangays={barangays}
        initialValue={{
          content: 'Saved draft message',
          category: 'FIRE',
          targets: [{ barangayId: 'barangay-b', residentRole: 'RESIDENT' }]
        }}
        submitLabel="Update draft"
        onSubmit={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Message')).toHaveValue('Saved draft message');
    expect(screen.getByLabelText('Category')).toHaveValue('FIRE');
    expect(screen.getByLabelText('Target 1 barangay')).toHaveValue('barangay-b');
    expect(screen.getByLabelText('Target 1 role')).toHaveValue('RESIDENT');
  });

  it('blocks submission for empty content or targets', () => {
    const onSubmit = jest.fn();
    render(
      <AlertForm
        barangays={barangays}
        initialValue={{ content: '   ', category: 'FLOOD', targets: [] }}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.getByText('Enter an alert message.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Valid message' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.getByText('Add at least one target.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('emits the normalized save payload', () => {
    const onSubmit = jest.fn();
    render(
      <AlertForm
        barangays={barangays}
        initialValue={{
          content: '  Floodwater rising  ',
          category: 'FLOOD',
          targets: [{ barangayId: 'barangay-a', residentRole: null }]
        }}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(onSubmit).toHaveBeenCalledWith({
      content: 'Floodwater rising',
      category: 'FLOOD',
      targets: [{ barangayId: 'barangay-a', residentRole: null }]
    });
  });

  it('renders read-only content for a non-draft alert', () => {
    render(
      <AlertForm
        barangays={barangays}
        initialValue={{
          content: 'Already sent',
          category: 'FIRE',
          targets: [{ barangayId: 'barangay-a', residentRole: null }]
        }}
        readOnly
        onSubmit={jest.fn()}
      />
    );

    expect(screen.getByText('Already sent')).toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
  });
});
