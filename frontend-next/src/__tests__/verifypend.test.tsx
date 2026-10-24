import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VerifyPendingPage from '@/app/verifypend/page';

describe('VerifyPendingPage Component', () => {
  it('renders instructions and guidance for email verification', () => {
    render(<VerifyPendingPage />);

    expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument();
    expect(
      screen.getByText(/click the link to verify your account, then come back and log in/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to log in/i })).toHaveAttribute(
      'href',
      '/login'
    );
    expect(screen.getByRole('link', { name: /sign up again/i })).toHaveAttribute(
      'href',
      '/register'
    );
  });
});
