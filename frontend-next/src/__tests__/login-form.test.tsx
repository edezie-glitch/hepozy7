import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/auth/login-form';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => mockSearchParams,
}));

const mockSignInWithPassword = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}));

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('renders login form elements properly', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create account/i })).toHaveAttribute(
      'href',
      '/register'
    );
  });

  it('renders "Forgot password?" link pointing to /reset-password', () => {
    render(<LoginForm />);

    const forgotLink = screen.getByRole('link', { name: /forgot password\??/i });
    expect(forgotLink).toBeInTheDocument();
    expect(forgotLink).toHaveAttribute('href', '/reset-password');
  });

  it('displays success banner when redirected from password reset (?reset=success)', () => {
    mockSearchParams = new URLSearchParams({ reset: 'success' });
    render(<LoginForm />);

    expect(
      screen.getByText(/password updated successfully/i)
    ).toBeInTheDocument();
  });

  it('displays error alert when redirected from failed auth callback (?error=auth-callback-failed)', () => {
    mockSearchParams = new URLSearchParams({ error: 'auth-callback-failed' });
    render(<LoginForm />);

    expect(
      screen.getByText(/the password recovery link is invalid or has expired/i)
    ).toBeInTheDocument();
  });

  it('displays validation errors on empty or invalid inputs', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const submitBtn = screen.getByRole('button', { name: /log in/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('displays error alert when Supabase login fails', async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'supersecretpassword123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText(/invalid login credentials/i)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('signs in and redirects to home / on success', async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: { access_token: 'valid-token' } },
      error: null,
    });

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'correctpassword123456');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'correctpassword123456',
      });
      expect(mockPush).toHaveBeenCalledWith('/');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
