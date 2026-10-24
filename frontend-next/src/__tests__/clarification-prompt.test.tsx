import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ClarificationPrompt } from '@/components/chat/clarification-prompt';

describe('ClarificationPrompt Component', () => {
  const defaultReplies = ['PDF Document', 'Word Document', 'Excel Spreadsheet'];

  it('renders suggested reply pills', () => {
    render(
      <ClarificationPrompt
        suggestedReplies={defaultReplies}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId('clarification-prompt')).toBeInTheDocument();
    defaultReplies.forEach((reply) => {
      expect(screen.getByRole('button', { name: reply })).toBeInTheDocument();
    });
  });

  it('submits selected reply when clicking a suggested reply pill', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <ClarificationPrompt
        suggestedReplies={defaultReplies}
        onSubmit={handleSubmit}
      />
    );

    const pill = screen.getByRole('button', { name: 'PDF Document' });
    await user.click(pill);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith('PDF Document');
  });

  it('submits freeform text when pressing Enter', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <ClarificationPrompt
        suggestedReplies={defaultReplies}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByTestId('clarification-freeform-input');
    await user.type(input, 'CSV format please{enter}');

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith('CSV format please');
  });

  it('submits freeform text when clicking send button', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <ClarificationPrompt
        suggestedReplies={defaultReplies}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByTestId('clarification-freeform-input');
    await user.type(input, 'Plain text export');

    const submitBtn = screen.getByTestId('clarification-freeform-submit');
    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith('Plain text export');
  });

  it('does not submit when freeform input contains only whitespace', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <ClarificationPrompt
        suggestedReplies={defaultReplies}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByTestId('clarification-freeform-input');
    await user.type(input, '   {enter}');

    const submitBtn = screen.getByTestId('clarification-freeform-submit');
    await user.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('calls onDismiss when close button is clicked', async () => {
    const user = userEvent.setup();
    const handleDismiss = vi.fn();

    render(
      <ClarificationPrompt
        suggestedReplies={defaultReplies}
        onSubmit={vi.fn()}
        onDismiss={handleDismiss}
      />
    );

    const dismissBtn = screen.getByRole('button', { name: /dismiss clarification prompt/i });
    await user.click(dismissBtn);

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('disables pills and inputs when disabled prop is true', async () => {
    render(
      <ClarificationPrompt
        suggestedReplies={defaultReplies}
        onSubmit={vi.fn()}
        disabled={true}
      />
    );

    const pill = screen.getByRole('button', { name: 'PDF Document' });
    expect(pill).toBeDisabled();

    const input = screen.getByTestId('clarification-freeform-input');
    expect(input).toBeDisabled();

    const submitBtn = screen.getByTestId('clarification-freeform-submit');
    expect(submitBtn).toBeDisabled();
  });
});
