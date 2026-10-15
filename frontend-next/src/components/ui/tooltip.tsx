'use client';

import * as React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { cn } from '@/lib/utils';

export const TooltipProvider = BaseTooltip.Provider;
export const Tooltip = BaseTooltip.Root;
export const TooltipPortal = BaseTooltip.Portal;
export const TooltipPositioner = BaseTooltip.Positioner;
export const TooltipArrow = BaseTooltip.Arrow;

export interface TooltipTriggerProps
  extends React.ComponentPropsWithoutRef<typeof BaseTooltip.Trigger> {
  asChild?: boolean;
}

export const TooltipTrigger = React.forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  ({ asChild = false, render, children, ...props }, ref) => {
    const effectiveRender =
      render ?? (asChild && React.isValidElement(children) ? children : undefined);
    const content = asChild && React.isValidElement(children) ? undefined : children;

    return (
      <BaseTooltip.Trigger ref={ref} render={effectiveRender} {...props}>
        {content}
      </BaseTooltip.Trigger>
    );
  }
);
TooltipTrigger.displayName = 'TooltipTrigger';

export const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseTooltip.Popup> & {
    side?: 'top' | 'right' | 'bottom' | 'left';
    sideOffset?: number;
    align?: 'start' | 'center' | 'end';
  }
>(({ className, side = 'top', sideOffset = 4, align = 'center', children, ...props }, ref) => (
  <BaseTooltip.Portal>
    <BaseTooltip.Positioner side={side} sideOffset={sideOffset} align={align}>
      <BaseTooltip.Popup
        ref={ref}
        className={cn(
          'z-50 overflow-hidden rounded-md border border-border bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-md transition-all focus:outline-none select-none',
          className
        )}
        {...props}
      >
        {children}
      </BaseTooltip.Popup>
    </BaseTooltip.Positioner>
  </BaseTooltip.Portal>
));
TooltipContent.displayName = 'TooltipContent';
