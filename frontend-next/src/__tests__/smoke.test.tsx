import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Home from '@/app/page';
import { ThemeProvider } from '@/components/theme-provider';

describe('Application End-to-End Smoke Test', () => {
  it('compiles, renders complete home shell, and toggles theme cleanly without crashing', async () => {
    document.documentElement.className = '';

    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
      >
        <Home />
      </ThemeProvider>
    );

    // Verify shell renders brand name, heading, and primary CTA
    expect(screen.getByText('Hepozy')).toBeInTheDocument();
    expect(screen.getByText('AI Workspace Assistant')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /intelligence that works with your documents/i,
      })
    ).toBeInTheDocument();

    const cta = screen.getByRole('button', { name: /start conversation/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveClass('bg-primary');

    // Find and click the theme toggle
    const toggle = screen.getByRole('button', { name: /toggle theme/i });
    expect(toggle).toBeInTheDocument();

    // Toggle to dark theme
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    // Toggle back to light theme
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});
