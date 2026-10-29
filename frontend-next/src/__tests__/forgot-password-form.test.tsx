import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import ResetPasswordPage from '@/app/reset-password/page';

const mockResetPasswordForEmail = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  }),
}));

describe('ForgotPasswordForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders reset password form elements properly', () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send recovery link/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to log in|log in/i })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  it('renders form with method="POST" to prevent credential leakage in URL', () => {
    render(<ForgotPasswordForm />);
    const form = screen.getByRole('button', { name: /send recovery link/i }).closest('form');
    expect(form).toHaveAttribute('method', 'POST');
  });

  it('displays validation errors on empty or invalid email inputs', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    const submitBtn = screen.getByRole('button', { name: /send recovery link/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'notanemail');
    await user.click(submitBtn);

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('calls supabase.auth.resetPasswordForEmail with correct redirect URL and shows confirmation instructions', async () => {
    const user = userEvent.setup();
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send recovery link/i }));

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
        redirectTo: expect.stringMatching(/\/auth\/callback\?next=\/reset-password\/update$/),
      });
    });

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(/user@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to log in|log in/i })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  it('displays error alert when resetPasswordForEmail fails or rate limits', async () => {
    const user = userEvent.setup();
    mockResetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: 'For security purposes, you can only request this once every 60 seconds' },
    });

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'ratelimit@example.com');
    await user.click(screen.getByRole('button', { name: /send recovery link/i }));

    expect(
      await screen.findByText(
        /for security purposes, you can only request this once every 60 seconds/i
      )
    ).toBeInTheDocument();
  });

  it('handles unexpected connection errors gracefully', async () => {
    const user = userEvent.setup();
    mockResetPasswordForEmail.mockRejectedValue(new Error('Network error'));

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send recovery link/i }));

    expect(
      await screen.findByText(/unable to connect to server\. please try again\./i)
    ).toBeInTheDocument();
  });

  it('renders ResetPasswordPage wrapper with theme toggle and card layout', () => {
    render(<ResetPasswordPage />);
    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
