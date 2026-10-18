'use client';

import * as React from 'react';
import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MessageScrollerContextValue {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  setIsAtBottom: (atBottom: boolean) => void;
  isDetached: boolean;
  userScrolledUp: boolean;
  autoScroll: boolean;
  setAutoScroll: (autoScroll: boolean) => void;
  scrollToBottom: (options?: ScrollBehavior | { instant?: boolean; behavior?: ScrollBehavior }) => void;
  consumePendingInstantAnchor: () => boolean;
  isLoading: boolean;
}

const MessageScrollerContext = React.createContext<MessageScrollerContextValue | null>(null);

export function useMessageScroller(): MessageScrollerContextValue {
  const context = React.useContext(MessageScrollerContext);
  if (!context) {
    throw new Error('useMessageScroller must be used within a MessageScrollerProvider');
  }
  return context;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export interface MessageScrollerProviderProps {
  children: React.ReactNode;
  autoScroll?: boolean;
  anchorKey?: string | null;
  isLoading?: boolean;
  skipInstantAnchor?: boolean;
}

export function MessageScrollerProvider({
  children,
  autoScroll: autoScrollProp = true,
  anchorKey,
  isLoading = false,
  skipInstantAnchor = false,
}: MessageScrollerProviderProps) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const [autoScroll, setAutoScroll] = React.useState(autoScrollProp);
  const pendingInstantAnchorRef = React.useRef(!skipInstantAnchor);
  const prevAnchorKeyRef = React.useRef(anchorKey);

  const isDetached = !isAtBottom;
  const userScrolledUp = isDetached;

  // When anchorKey (e.g. conversationId) changes, reset detached state and schedule instant anchor
  if (anchorKey !== prevAnchorKeyRef.current) {
    prevAnchorKeyRef.current = anchorKey;
    pendingInstantAnchorRef.current = !skipInstantAnchor;
    setIsAtBottom(true);
  }

  const consumePendingInstantAnchor = React.useCallback(() => {
    if (pendingInstantAnchorRef.current) {
      pendingInstantAnchorRef.current = false;
      return true;
    }
    return false;
  }, []);

  const scrollToBottom = React.useCallback(
    (options?: ScrollBehavior | { instant?: boolean; behavior?: ScrollBehavior }) => {
      let behavior: ScrollBehavior = 'smooth';
      if (typeof options === 'string') {
        behavior = options;
      } else if (options && typeof options === 'object') {
        if (options.behavior) {
          behavior = options.behavior;
        } else if (options.instant) {
          behavior = 'instant';
        }
      }

      if (behavior === 'instant' && viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView?.({
        behavior,
      });

      setIsAtBottom(true);
    },
    []
  );

  const contextValue = React.useMemo<MessageScrollerContextValue>(
    () => ({
      viewportRef,
      messagesEndRef,
      isAtBottom,
      setIsAtBottom,
      isDetached,
      userScrolledUp,
      autoScroll,
      setAutoScroll,
      scrollToBottom,
      consumePendingInstantAnchor,
      isLoading,
    }),
    [
      isAtBottom,
      isDetached,
      userScrolledUp,
      autoScroll,
      scrollToBottom,
      consumePendingInstantAnchor,
      isLoading,
    ]
  );

  return (
    <MessageScrollerContext.Provider value={contextValue}>
      {children}
    </MessageScrollerContext.Provider>
  );
}

export interface MessageScrollerProps
  extends React.ComponentPropsWithoutRef<typeof BaseScrollArea.Root> {
  className?: string;
}

export const MessageScroller = React.forwardRef<HTMLDivElement, MessageScrollerProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <BaseScrollArea.Root
        ref={ref}
        className={cn('relative flex flex-col min-h-0 flex-1 overflow-hidden', className)}
        {...props}
      >
        {children}
        <BaseScrollArea.Scrollbar
          orientation="vertical"
          className="flex select-none touch-none p-0.5 transition-colors duration-150 ease-out hover:bg-black/5 data-[orientation=vertical]:w-2.5 z-10"
        >
          <BaseScrollArea.Thumb className="relative flex-1 rounded-full bg-border" />
        </BaseScrollArea.Scrollbar>
      </BaseScrollArea.Root>
    );
  }
);
MessageScroller.displayName = 'MessageScroller';

export interface MessageScrollerViewportProps
  extends React.ComponentPropsWithoutRef<typeof BaseScrollArea.Viewport> {
  className?: string;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

export const MessageScrollerViewport = React.forwardRef<
  HTMLDivElement,
  MessageScrollerViewportProps
>(({ className, onScroll, children, ...props }, ref) => {
  const { viewportRef, setIsAtBottom } = useMessageScroller();

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    const atBottom = distanceFromBottom <= 40;

    setIsAtBottom(atBottom);
    onScroll?.(e);
  };

  const setMergedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref, viewportRef]
  );

  return (
    <BaseScrollArea.Viewport
      ref={setMergedRef}
      onScroll={handleScroll}
      className={cn('h-full overflow-y-auto [overflow-anchor:auto]', className)}
      {...props}
    >
      {children}
    </BaseScrollArea.Viewport>
  );
});
MessageScrollerViewport.displayName = 'MessageScrollerViewport';

export interface MessageScrollerContentProps
  extends React.ComponentPropsWithoutRef<typeof BaseScrollArea.Content> {
  className?: string;
}

export const MessageScrollerContent = React.forwardRef<
  HTMLDivElement,
  MessageScrollerContentProps
>(({ className, children, ...props }, ref) => {
  const {
    messagesEndRef,
    consumePendingInstantAnchor,
    scrollToBottom,
    autoScroll,
    isDetached,
    isLoading,
  } = useMessageScroller();

  const prevChildrenCountRef = React.useRef(React.Children.count(children));

  useIsomorphicLayoutEffect(() => {
    if (isLoading) return;

    const currentCount = React.Children.count(children);
    if (consumePendingInstantAnchor()) {
      scrollToBottom('instant');
    } else if (autoScroll && !isDetached && prevChildrenCountRef.current !== currentCount) {
      scrollToBottom('smooth');
    }
    prevChildrenCountRef.current = currentCount;
  });

  return (
    <BaseScrollArea.Content ref={ref} className={cn('relative', className)} {...props}>
      {children}
      <div
        ref={messagesEndRef}
        aria-hidden="true"
        className="h-0 w-0 pointer-events-none"
        data-testid="message-stream-scroll-anchor"
      />
    </BaseScrollArea.Content>
  );
});
MessageScrollerContent.displayName = 'MessageScrollerContent';

export interface MessageScrollerItemProps
  extends React.HTMLAttributes<HTMLDivElement> {
  messageId?: string;
  scrollAnchor?: boolean;
}

export const MessageScrollerItem = React.forwardRef<
  HTMLDivElement,
  MessageScrollerItemProps
>(({ messageId, scrollAnchor, className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-message-id={messageId}
      data-scroll-anchor={scrollAnchor ? 'true' : undefined}
      className={cn('w-full', className)}
      {...props}
    >
      {children}
    </div>
  );
});
MessageScrollerItem.displayName = 'MessageScrollerItem';

export interface MessageScrollerButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  containerClassName?: string;
  alignToColumn?: boolean;
  columnClassName?: string;
}

const BASE_SCROLL_BUTTON_CLASS =
  'flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-md backdrop-blur-xs transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring animate-in fade-in zoom-in-95 cursor-pointer';

export const MessageScrollerButton = React.forwardRef<
  HTMLButtonElement,
  MessageScrollerButtonProps
>(
  (
    {
      className,
      containerClassName,
      children,
      onClick,
      alignToColumn = false,
      columnClassName = 'max-w-4xl lg:max-w-5xl',
      ...props
    },
    ref
  ) => {
    const { isDetached, scrollToBottom } = useMessageScroller();

    if (!isDetached) {
      return null;
    }

    const button = (
      <button
        ref={ref}
        type="button"
        data-testid="scroll-to-bottom-button"
        aria-label="Scroll to bottom"
        title="Scroll to bottom"
        className={cn(
          BASE_SCROLL_BUTTON_CLASS,
          alignToColumn ? 'pointer-events-auto' : 'absolute bottom-4 right-6 z-20',
          className
        )}
        onClick={(e) => {
          onClick?.(e);
          scrollToBottom('smooth');
        }}
        {...props}
      >
        {children ?? <ArrowDown className="h-4 w-4" />}
      </button>
    );

    if (alignToColumn) {
      return (
        <div
          data-testid="scroll-to-bottom-container"
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-4 z-20 px-4 sm:px-6',
            containerClassName
          )}
        >
          <div className={cn('mx-auto flex w-full justify-end', columnClassName)}>
            {button}
          </div>
        </div>
      );
    }

    return button;
  }
);
MessageScrollerButton.displayName = 'MessageScrollerButton';
