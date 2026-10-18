import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageStreamSkeleton } from '@/components/chat/message-stream-skeleton';

describe('MessageStreamSkeleton Component', () => {
  it('renders accessible status attributes and screen-reader announcement', () => {
    render(<MessageStreamSkeleton />);

    const statusContainer = screen.getByRole('status');
    expect(statusContainer).toBeInTheDocument();
    expect(statusContainer).toHaveAttribute('aria-busy', 'true');
    expect(statusContainer).toHaveAttribute('data-testid', 'message-stream-skeleton');
    expect(screen.getByText('Loading conversation history...')).toBeInTheDocument();
    expect(screen.getByText('Loading conversation history...')).toHaveClass('sr-only');
  });

  it('renders alternating user and assistant message skeleton rows', () => {
    render(<MessageStreamSkeleton />);

    const userSkeletons = screen.getAllByTestId('user-message-skeleton');
    const assistantSkeletons = screen.getAllByTestId('assistant-message-skeleton');

    expect(userSkeletons.length).toBeGreaterThanOrEqual(2);
    expect(assistantSkeletons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders assistant skeletons with avatar placeholder and multiline shimmer bars', () => {
    render(<MessageStreamSkeleton />);

    const avatars = screen.getAllByTestId('skeleton-avatar');
    expect(avatars.length).toBeGreaterThanOrEqual(2);
    avatars.forEach((avatar) => {
      expect(avatar.className).toMatch(/animate-pulse/);
      expect(avatar.className).toMatch(/rounded-full/);
    });

    const shimmerBars = screen.getAllByTestId('skeleton-shimmer-bar');
    expect(shimmerBars.length).toBeGreaterThanOrEqual(4);
    shimmerBars.forEach((bar) => {
      expect(bar.className).toMatch(/animate-pulse/);
    });
  });

  it('renders user skeletons aligned to the right with rounded corners', () => {
    render(<MessageStreamSkeleton />);

    const userSkeletons = screen.getAllByTestId('user-message-skeleton');
    userSkeletons.forEach((userRow) => {
      expect(userRow.className).toMatch(/items-end/);
      const bubble = userRow.querySelector('[data-testid="skeleton-user-bubble"]');
      expect(bubble).toBeInTheDocument();
      expect(bubble?.className).toMatch(/rounded-2xl/);
      expect(bubble?.className).toMatch(/animate-pulse/);
    });
  });

  it('renders timestamp placeholder indicators for both user and assistant skeletons', () => {
    render(<MessageStreamSkeleton />);

    const timestampPlaceholders = screen.getAllByTestId('skeleton-timestamp');
    expect(timestampPlaceholders.length).toBeGreaterThanOrEqual(4);
    timestampPlaceholders.forEach((ts) => {
      expect(ts.className).toMatch(/animate-pulse/);
    });
  });

  it('Ticket 24 (#32): enforces uniform max-width column bounds matching live message stream', () => {
    render(<MessageStreamSkeleton />);

    const skeleton = screen.getByTestId('message-stream-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('w-full');
    expect(skeleton).toHaveClass('max-w-3xl');
    expect(skeleton).toHaveClass('mx-auto');
  });
});

