import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

describe('Tooltip Primitive', () => {
  it('renders trigger element and displays tooltip content on hover/focus', async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<button type="button">Hover me</button>} />
          <TooltipContent side="right">Tooltip information</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    const trigger = screen.getByRole('button', { name: 'Hover me' });
    expect(trigger).toBeInTheDocument();

    // Hover trigger
    await user.hover(trigger);
    expect(await screen.findByText('Tooltip information')).toBeInTheDocument();

    // Unhover trigger
    await user.unhover(trigger);
  });

  it('supports asChild pattern for trigger element', async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button">AsChild Button</button>
          </TooltipTrigger>
          <TooltipContent side="top">AsChild tooltip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    const trigger = screen.getByRole('button', { name: 'AsChild Button' });
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);
    expect(await screen.findByText('AsChild tooltip')).toBeInTheDocument();
  });
});
