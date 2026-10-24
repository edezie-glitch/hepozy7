'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ThemeToggleProps = React.ComponentPropsWithoutRef<typeof Button>;

const emptySubscribe = () => () => {};

export const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ className, variant = 'outline', size = 'icon', ...props }, ref) => {
    const { theme, resolvedTheme, setTheme } = useTheme();
    const isMounted = React.useSyncExternalStore(
      emptySubscribe,
      () => true,
      () => false
    );

    const currentTheme = isMounted ? (resolvedTheme || theme) : 'light';

    const { onClick: propsOnClick, ...restProps } = props;

    const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
      propsOnClick?.(e);
      setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    };

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        aria-label="Toggle theme"
        className={cn('relative cursor-pointer', className)}
        {...restProps}
        onClick={toggleTheme}
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }
);
ThemeToggle.displayName = 'ThemeToggle';
