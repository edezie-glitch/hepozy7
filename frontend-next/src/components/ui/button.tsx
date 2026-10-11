import * as React from 'react';
import { Button as BaseButton } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'>,
    VariantProps<typeof buttonVariants> {
  className?: string;
  /**
   * Base UI render prop to render a custom element or component
   */
  render?: BaseButton.Props['render'];
  /**
   * Compatibility prop: if true, renders children as the root element using Base UI render prop
   */
  asChild?: boolean;
  /**
   * Whether the element behaves as a native button (defaults to false when rendering an anchor or non-button element)
   */
  nativeButton?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, render, asChild = false, nativeButton, children, ...props }, ref) => {
    const effectiveRender = render ?? (asChild && React.isValidElement(children) ? children : undefined);
    const content = asChild && React.isValidElement(children) ? undefined : children;

    const isNonButton =
      React.isValidElement(effectiveRender) &&
      typeof effectiveRender.type === 'string' &&
      effectiveRender.type !== 'button';

    const effectiveNativeButton = nativeButton ?? (isNonButton ? false : undefined);

    return (
      <BaseButton
        className={cn(buttonVariants({ variant, size, className }))}
        render={effectiveRender}
        nativeButton={effectiveNativeButton}
        ref={ref}
        {...props}
      >
        {content}
      </BaseButton>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
