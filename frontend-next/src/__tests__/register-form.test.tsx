import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '@/components/auth/register-form';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockSignUp = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
  }),
}));

describe('RegisterForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders registration form fields properly', () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
  });

  it('enforces validation for password length >= 20 and matching passwords', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
    await user.type(screen.getByLabelText(/username/i), 'newuser');
    await user.type(screen.getByLabelText(/^password$/i), 'shortpass');
    await user.type(screen.getByLabelText(/confirm password/i), 'mismatchpass');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText(/password must be at least 20 characters/i)
    ).toBeInTheDocument();
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('signs up via Supabase and redirects to /verifypend on success', async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'new-user-123' } },
      error: null,
    });

    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
    await user.type(screen.getByLabelText(/username/i), 'newuser123');
    await user.type(
      screen.getByLabelText(/^password$/i),
      'super-secure-long-password-exceeding-twenty-chars'
    );
    await user.type(
      screen.getByLabelText(/confirm password/i),
      'super-secure-long-password-exceeding-twenty-chars'
    );
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'super-secure-long-password-exceeding-twenty-chars',
        options: {
          data: {
            username: 'newuser123',
          },
        },
      });
      expect(mockPush).toHaveBeenCalledWith('/verifypend');
    });
  });
});
