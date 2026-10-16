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
    expect(screen.getAllByText('Hepozy')[0]).toBeInTheDocument();
    expect(screen.getByText('AI Workspace Assistant')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /intelligence that works with your documents/i,
      })
    ).toBeInTheDocument();

    const cta = screen.getByRole('button', { name: /start conversation/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveClass('bg-primary');

    // Open settings to access theme toggle
    const settingsBtn = screen.getByRole('button', { name: /open settings/i });
    expect(settingsBtn).toBeInTheDocument();
    fireEvent.click(settingsBtn);

    // Find and click the theme toggle
    const toggle = await screen.findByRole('button', { name: /toggle theme/i });
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
