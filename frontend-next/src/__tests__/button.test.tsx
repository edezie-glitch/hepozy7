import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { Button } from '@/components/ui/button';

describe('Button component', () => {
  it('renders a native button with default variant and size', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button.tagName.toLowerCase()).toBe('button');
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveClass('h-9');
  });

  it('renders correctly with different variants', () => {
    const { rerender } = render(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole('button', { name: /destructive/i })).toHaveClass('bg-destructive');

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button', { name: /outline/i })).toHaveClass('border-border');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button', { name: /secondary/i })).toHaveClass('bg-secondary');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button', { name: /ghost/i })).toHaveClass('hover:bg-accent');

    rerender(<Button variant="link">Link</Button>);
    expect(screen.getByRole('button', { name: /link/i })).toHaveClass('underline-offset-4');
  });

  it('handles user click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit</Button>);

    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('supports Base UI render prop polymorphism with accessible button semantics', () => {
    render(
      <Button render={<a href="/test-link">Anchor Button</a>} variant="outline" />
    );
    const element = screen.getByRole('button', { name: /anchor button/i });
    expect(element).toBeInTheDocument();
    expect(element.tagName.toLowerCase()).toBe('a');
    expect(element).toHaveAttribute('href', '/test-link');
    expect(element).toHaveClass('border-border');
  });

  it('supports asChild compatibility for existing shadcn code', () => {
    render(
      <Button asChild variant="secondary">
        <a href="/as-child-link">AsChild Link</a>
      </Button>
    );
    const element = screen.getByRole('button', { name: /aschild link/i });
    expect(element).toBeInTheDocument();
    expect(element.tagName.toLowerCase()).toBe('a');
    expect(element).toHaveAttribute('href', '/as-child-link');
    expect(element).toHaveClass('bg-secondary');
  });
});
