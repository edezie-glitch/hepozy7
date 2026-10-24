import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as fs from 'fs';
import * as path from 'path';

describe('Design Tokens System (DESIGN.md alignment)', () => {
  const globalsCssPath = path.resolve(__dirname, '../app/globals.css');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf-8');

  describe('CSS Custom Properties & Palette Tokens', () => {
    it('defines primary brand color matching DESIGN.md oklch(0.65 0.186 44)', () => {
      expect(globalsCss).toContain('oklch(0.65 0.186 44)');
    });

    it('defines primitive palettes (zinc, bamboo, orange, green, red, blue)', () => {
      expect(globalsCss).toContain('--color-zinc-50');
      expect(globalsCss).toContain('--color-zinc-950');
      expect(globalsCss).toContain('--color-bamboo-500');
      expect(globalsCss).toContain('--color-bamboo-600');
      expect(globalsCss).toContain('--color-orange-500');
      expect(globalsCss).toContain('--color-green-500');
      expect(globalsCss).toContain('--color-red-500');
      expect(globalsCss).toContain('--color-blue-500');
    });

    it('defines semantic surface tokens for light and dark modes', () => {
      expect(globalsCss).toContain('--surface-canvas');
      expect(globalsCss).toContain('--surface-default');
      expect(globalsCss).toContain('--surface-subtle');
      expect(globalsCss).toContain('--surface-subtlest');
      expect(globalsCss).toContain('--surface-selected');
    });

    it('defines semantic border tokens with color-mix and bamboo accents', () => {
      expect(globalsCss).toContain('--border-default');
      expect(globalsCss).toContain('--border-subtle');
      expect(globalsCss).toContain('--border-selected');
      expect(globalsCss).toContain('--border-focus');
    });

    it('defines action tokens for primary and secondary interactions', () => {
      expect(globalsCss).toContain('--action-primary-background');
      expect(globalsCss).toContain('--action-primary-hovered');
      expect(globalsCss).toContain('--action-primary-pressed');
      expect(globalsCss).toContain('--action-primary-text');
      expect(globalsCss).toContain('--action-secondary-background');
      expect(globalsCss).toContain('--action-secondary-hovered');
      expect(globalsCss).toContain('--action-secondary-border');
    });

    it('defines elevation shadows (shadow-1 through shadow-6)', () => {
      expect(globalsCss).toContain('--shadow-1');
      expect(globalsCss).toContain('--shadow-2');
      expect(globalsCss).toContain('--shadow-3');
      expect(globalsCss).toContain('--shadow-4');
      expect(globalsCss).toContain('--shadow-5');
      expect(globalsCss).toContain('--shadow-6');
    });

    it('defines typography utility classes matching DESIGN.md scale', () => {
      expect(globalsCss).toContain('display-large');
      expect(globalsCss).toContain('display-medium');
      expect(globalsCss).toContain('display-small');
      expect(globalsCss).toContain('heading-large');
      expect(globalsCss).toContain('heading-medium');
      expect(globalsCss).toContain('heading-small');
      expect(globalsCss).toContain('text-medium');
      expect(globalsCss).toContain('text-small');
      expect(globalsCss).toContain('text-label');
    });

    it('defines radius tokens matching DESIGN.md (radius-2 through radius-32)', () => {
      expect(globalsCss).toContain('--radius-radius-2');
      expect(globalsCss).toContain('--radius-radius-6');
      expect(globalsCss).toContain('--radius-radius-12');
      expect(globalsCss).toContain('--radius-radius-16');
      expect(globalsCss).toContain('--radius-radius-24');
    });
  });

  describe('Component Token Implementation', () => {
    it('Button adheres to DESIGN.md specs: height 2.25rem (h-9), radius 0.75rem (rounded-xl), px-4, text-sm font-medium', () => {
      render(<Button>Token Button</Button>);
      const btn = screen.getByRole('button', { name: /token button/i });
      expect(btn).toHaveClass('h-9');
      expect(btn).toHaveClass('px-4');
      expect(btn).toHaveClass('rounded-xl');
      expect(btn).toHaveClass('bg-primary');
      expect(btn).toHaveClass('text-primary-foreground');
    });

    it('Input adheres to DESIGN.md specs: height 2.25rem (h-9), radius 0.75rem (rounded-xl), px-3, outline border', () => {
      render(<Input placeholder="Type here" aria-label="token-input" />);
      const input = screen.getByLabelText('token-input');
      expect(input).toHaveClass('h-9');
      expect(input).toHaveClass('px-3');
      expect(input).toHaveClass('rounded-xl');
      expect(input).toHaveClass('border');
    });

    it('Label renders with text-sm font-medium label style', () => {
      render(<Label htmlFor="test-input">Test Label</Label>);
      const label = screen.getByText('Test Label');
      expect(label).toHaveClass('text-sm');
      expect(label).toHaveClass('font-medium');
    });

    it('Card adheres to DESIGN.md specs: radius 1rem (rounded-2xl), padding 1.5rem (p-6), and shadow-2', () => {
      render(
        <Card data-testid="card-element">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
          <CardContent>Card Content</CardContent>
        </Card>
      );
      const card = screen.getByTestId('card-element');
      expect(card).toHaveClass('rounded-2xl');
      expect(card).toHaveClass('p-6');
      expect(card).toHaveClass('shadow-2');
      expect(card).toHaveClass('bg-card');
      expect(card).toHaveClass('text-card-foreground');
    });

    it('Card supports brand variants (brand-1, brand-2, brand-3)', () => {
      const { rerender } = render(
        <Card variant="brand-1" data-testid="brand-card">Brand 1</Card>
      );
      let card = screen.getByTestId('brand-card');
      expect(card).toHaveClass('bg-[var(--brand-1-background)]');
      expect(card).toHaveClass('text-[var(--brand-1-text)]');

      rerender(<Card variant="brand-2" data-testid="brand-card">Brand 2</Card>);
      card = screen.getByTestId('brand-card');
      expect(card).toHaveClass('bg-[var(--brand-2-background)]');

      rerender(<Card variant="brand-3" data-testid="brand-card">Brand 3</Card>);
      card = screen.getByTestId('brand-card');
      expect(card).toHaveClass('bg-[var(--brand-3-background)]');
    });

    it('Badge adheres to DESIGN.md specs: radius 0.375rem (rounded-md / radius-6)', () => {
      render(<Badge>New Feature</Badge>);
      const badge = screen.getByText('New Feature');
      expect(badge).toHaveClass('rounded-md');
    });
  });
});
