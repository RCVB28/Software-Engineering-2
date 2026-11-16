import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api, setToken } from '../../src/services/api';
import { AuthProvider, useAuth } from '../../src/hooks/useAuth';

jest.mock('../../src/services/api', () => ({
  api: { auth: { adminLogin: jest.fn() } },
  getToken: jest.fn(() => null),
  getStoredUser: jest.fn(() => null),
  setToken: jest.fn(),
  setStoredUser: jest.fn()
}));

const adminLogin = api.auth.adminLogin as jest.MockedFunction<typeof api.auth.adminLogin>;

function Probe() {
  const { user, loginAdmin } = useAuth();
  return (
    <div>
      <span data-testid="user">{user?.email ?? 'none'}</span>
      <button type="button" onClick={() => void loginAdmin('mayor@example.com', 'secret')}>
        sign in
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('updates the current user immediately after an admin login', async () => {
    adminLogin.mockResolvedValue({
      accessToken: 'token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: 'admin-1',
        kind: 'ADMIN',
        role: 'HIGH_LEVEL',
        email: 'mayor@example.com',
        displayName: 'Mayor',
        barangayId: null
      }
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(screen.getByTestId('user')).toHaveTextContent('none');
    fireEvent.click(screen.getByRole('button', { name: 'sign in' }));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('mayor@example.com');
    });
    expect(setToken).toHaveBeenCalledWith('token');
  });
});
