import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Home from '@/app/page';

describe('Home Shell Page', () => {
  it('renders the Hepozy AI workspace heading and description', () => {
    render(<Home />);
    expect(screen.getByText('Hepozy')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /intelligence that works with your documents/i,
      })
    ).toBeInTheDocument();
  });

  it('renders the theme toggle button in the header', () => {
    render(<Home />);
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });

  it('renders brand primary action button', () => {
    render(<Home />);
    const ctaButton = screen.getByRole('button', { name: /start conversation/i });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveClass('bg-primary');
  });
});
