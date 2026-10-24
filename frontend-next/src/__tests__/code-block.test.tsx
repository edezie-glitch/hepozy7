import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeBlock } from '@/components/chat/code-block';

describe('CodeBlock Component', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders language header label and syntax-highlighted code', () => {
    const code = 'def calculate_total(a, b):\n    return a + b';
    const { container } = render(<CodeBlock code={code} language="python" />);

    expect(screen.getByText('python')).toBeInTheDocument();
    // Syntax highlighting produces prism token spans
    const keywords = container.querySelectorAll('.token.keyword');
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords[0].textContent).toBe('def');
  });

  it('falls back to "code" label when language is omitted or plain', () => {
    const code = 'plain text content';
    render(<CodeBlock code={code} />);

    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('plain text content')).toBeInTheDocument();
  });

  it('copies code text to clipboard and updates button text on click', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const code = 'const greeting = "Hello, world!";';
    render(<CodeBlock code={code} language="typescript" />);

    const copyBtn = screen.getByRole('button', { name: /copy code/i });
    expect(copyBtn).toHaveTextContent(/copy/i);

    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(code);
    expect(copyBtn).toHaveTextContent(/copied/i);
  });

  it('resets copied status back to Copy after 1500ms timeout', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CodeBlock code="const a = 1;" language="typescript" />);

    const copyBtn = screen.getByRole('button', { name: /copy code/i });
    await act(async () => {
      copyBtn.click();
    });

    expect(copyBtn).toHaveTextContent(/copied/i);

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(copyBtn).toHaveTextContent(/copy/i);
  });
});
