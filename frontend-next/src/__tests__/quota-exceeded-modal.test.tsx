import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QuotaExceededModal } from '@/components/chat/quota-exceeded-modal';

describe('QuotaExceededModal Component', () => {
  it('renders modal with human-readable reset countdown when open', () => {
    // 2 hours in the future
    const futureReset = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    render(
      <QuotaExceededModal
        open={true}
        onOpenChange={vi.fn()}
        quotaResetAt={futureReset}
      />
    );

    expect(screen.getByRole('heading', { name: /message quota exceeded/i })).toBeInTheDocument();
    expect(screen.getByText(/you can send again in 2 hours/i)).toBeInTheDocument();
  });

  it('renders fallback countdown notice when quotaResetAt is missing or invalid', () => {
    render(
      <QuotaExceededModal
        open={true}
        onOpenChange={vi.fn()}
        quotaResetAt={null}
      />
    );

    expect(screen.getByRole('heading', { name: /message quota exceeded/i })).toBeInTheDocument();
    expect(screen.getByText(/quota will reset shortly/i)).toBeInTheDocument();
  });

  it('does not render modal content when open is false', () => {
    render(
      <QuotaExceededModal
        open={false}
        onOpenChange={vi.fn()}
        quotaResetAt={null}
      />
    );

    expect(screen.queryByRole('heading', { name: /message quota exceeded/i })).not.toBeInTheDocument();
  });

  it('calls onOpenChange(false) when close button is clicked', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <QuotaExceededModal
        open={true}
        onOpenChange={handleOpenChange}
        quotaResetAt={null}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /close quota notification/i });
    await user.click(closeBtn);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when clicking the Understood button', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <QuotaExceededModal
        open={true}
        onOpenChange={handleOpenChange}
        quotaResetAt={null}
      />
    );

    const understoodBtn = screen.getByRole('button', { name: /understood/i });
    await user.click(understoodBtn);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <QuotaExceededModal
        open={true}
        onOpenChange={handleOpenChange}
        quotaResetAt={null}
      />
    );

    await user.keyboard('{Escape}');

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when clicking the background backdrop', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <QuotaExceededModal
        open={true}
        onOpenChange={handleOpenChange}
        quotaResetAt={null}
      />
    );

    const backdrop = screen.getByTestId('quota-dialog-backdrop');
    await user.click(backdrop);

    await waitFor(() => {
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
