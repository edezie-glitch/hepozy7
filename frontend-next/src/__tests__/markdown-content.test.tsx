import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownContent } from '@/components/chat/markdown-content';

describe('MarkdownContent Component', () => {
  it('renders headings (h1, h2, h3) with appropriate hierarchy and content', () => {
    const md = '# Title One\n## Title Two\n### Title Three';
    render(<MarkdownContent content={md} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title One');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Title Two');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Title Three');
  });

  it('renders unordered and ordered lists cleanly', () => {
    const md = '- First bullet\n- Second bullet\n\n1. Numbered one\n2. Numbered two';
    render(<MarkdownContent content={md} />);

    expect(screen.getByText('First bullet')).toBeInTheDocument();
    expect(screen.getByText('Second bullet')).toBeInTheDocument();
    expect(screen.getByText('Numbered one')).toBeInTheDocument();
    expect(screen.getByText('Numbered two')).toBeInTheDocument();
  });

  it('renders blockquotes, bold, italic, and inline code formatting', () => {
    const md = '> Notable insight\n\nThis is **bold**, *italic*, and `const foo = "bar"` inline code.';
    render(<MarkdownContent content={md} />);

    const blockquote = screen.getByText('Notable insight').closest('blockquote');
    expect(blockquote).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('italic')).toBeInTheDocument();
    expect(screen.getByText('const foo = "bar"')).toBeInTheDocument();
  });

  it('renders GitHub-flavored markdown tables with clean borders in a horizontal scroll container', () => {
    const tableMd = `
| Name | Role | Status |
| :--- | :--- | :--- |
| Alex | Dev  | Active |
| Sara | PM   | Active |
`;
    const { container } = render(<MarkdownContent content={tableMd} />);

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Sara')).toBeInTheDocument();

    // Verify table container has overflow-x-auto for mobile responsiveness
    const scrollContainer = container.querySelector('.table-container, .overflow-x-auto');
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer).toContainElement(table);
  });

  it('renders fenced code blocks with language indicator and copy button', () => {
    const codeMd = '```python\ndef greet():\n    return "hi"\n```';
    render(<MarkdownContent content={codeMd} />);

    expect(screen.getByText('python')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
    expect(screen.getByText('greet')).toBeInTheDocument();
  });

  it('renders links securely with target="_blank" and rel="noopener noreferrer"', () => {
    const linkMd = '[Hepozy](https://github.com/edezie-glitch/hepozy7)';
    render(<MarkdownContent content={linkMd} />);

    const link = screen.getByRole('link', { name: 'Hepozy' });
    expect(link).toHaveAttribute('href', 'https://github.com/edezie-glitch/hepozy7');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders GFM strikethrough and task lists', () => {
    const gfmText = '~~strikethrough~~\n\n- [x] Completed task\n- [ ] Pending task';
    const { container } = render(<MarkdownContent content={gfmText} />);

    expect(container.querySelector('del')).toHaveTextContent('strikethrough');
    expect(screen.getByText('Completed task')).toBeInTheDocument();
    expect(screen.getByText('Pending task')).toBeInTheDocument();
  });

  it('renders unlabelled fenced code block with fallback code label', () => {
    const rawCode = '```\nlet z = 99;\n```';
    render(<MarkdownContent content={rawCode} />);

    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('let z = 99;')).toBeInTheDocument();
  });
});
