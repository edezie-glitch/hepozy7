import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import UpdatePasswordPage from '@/app/reset-password/update/page';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
    },
  }),
}));

describe('UpdatePasswordForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders update password form elements properly', () => {
    render(<UpdatePasswordForm />);

    expect(screen.getByRole('heading', { name: /set new password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password|confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
  });

  it('renders form with method="POST" to prevent credential leakage in URL', () => {
    render(<UpdatePasswordForm />);
    const form = screen.getByRole('button', { name: /update password/i }).closest('form');
    expect(form).toHaveAttribute('method', 'POST');
  });

  it('enforces 20-character minimum password rule', async () => {
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    const passwordInput = screen.getByLabelText(/^new password/i);
    const confirmInput = screen.getByLabelText(/confirm new password|confirm password/i);
    const submitBtn = screen.getByRole('button', { name: /update password/i });

    // Too short password
    await user.type(passwordInput, 'shortpassword123');
    await user.type(confirmInput, 'shortpassword123');
    await user.click(submitBtn);

    expect(
      await screen.findByText(/password must be at least 20 characters/i)
    ).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('enforces matching confirmation validation', async () => {
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    const passwordInput = screen.getByLabelText(/^new password/i);
    const confirmInput = screen.getByLabelText(/confirm new password|confirm password/i);
    const submitBtn = screen.getByRole('button', { name: /update password/i });

    await user.type(passwordInput, 'this is a very long valid password sentence 123');
    await user.type(confirmInput, 'this is a completely different password sentence 456');
    await user.click(submitBtn);

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('submits valid password, calls supabase.auth.updateUser, and redirects to /login?reset=success', async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    mockSignOut.mockResolvedValue({ error: null });

    render(<UpdatePasswordForm />);

    const passwordInput = screen.getByLabelText(/^new password/i);
    const confirmInput = screen.getByLabelText(/confirm new password|confirm password/i);
    const submitBtn = screen.getByRole('button', { name: /update password/i });

    const newPassword = 'this is a very long valid password sentence 123';
    await user.type(passwordInput, newPassword);
    await user.type(confirmInput, newPassword);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: newPassword });
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/login?reset=success');
    });
  });

  it('displays error alert when supabase.auth.updateUser fails', async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockResolvedValue({
      data: null,
      error: { message: 'Auth session missing or recovery token expired' },
    });

    render(<UpdatePasswordForm />);

    const passwordInput = screen.getByLabelText(/^new password/i);
    const confirmInput = screen.getByLabelText(/confirm new password|confirm password/i);
    const submitBtn = screen.getByRole('button', { name: /update password/i });

    const newPassword = 'this is a very long valid password sentence 123';
    await user.type(passwordInput, newPassword);
    await user.type(confirmInput, newPassword);
    await user.click(submitBtn);

    expect(
      await screen.findByText(/auth session missing or recovery token expired/i)
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('handles unexpected network exceptions gracefully', async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockRejectedValue(new Error('Network failure'));

    render(<UpdatePasswordForm />);

    const passwordInput = screen.getByLabelText(/^new password/i);
    const confirmInput = screen.getByLabelText(/confirm new password|confirm password/i);
    const submitBtn = screen.getByRole('button', { name: /update password/i });

    const newPassword = 'this is a very long valid password sentence 123';
    await user.type(passwordInput, newPassword);
    await user.type(confirmInput, newPassword);
    await user.click(submitBtn);

    expect(
      await screen.findByText(/unable to connect to server\. please try again\./i)
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('renders UpdatePasswordPage wrapper with theme toggle and card layout', () => {
    render(<UpdatePasswordPage />);
    expect(screen.getByRole('heading', { name: /set new password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
  });
});
