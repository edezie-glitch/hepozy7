import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Home from '@/app/page';

describe('Home Shell Page', () => {
  it('renders the Hepozy AI workspace heading and description', () => {
    render(<Home />);
    expect(screen.getAllByText('Hepozy')[0]).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /intelligence that works with your documents/i,
      })
    ).toBeInTheDocument();
  });

  it('renders the user profile menu trigger for workspace configuration', () => {
    render(<Home />);
    expect(screen.getAllByLabelText(/user profile menu/i)[0]).toBeInTheDocument();
  });

  it('renders brand primary action button', () => {
    render(<Home />);
    const ctaButton = screen.getByRole('button', { name: /start conversation/i });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveClass('bg-primary');
  });

  it('clicking Start Conversation instantly switches to active chat input', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    render(<Home />);

    const ctaButton = screen.getByRole('button', { name: /start conversation/i });
    await user.click(ctaButton);

    expect(screen.getByPlaceholderText(/ask hepozy assistant/i)).toBeInTheDocument();
  });
});
