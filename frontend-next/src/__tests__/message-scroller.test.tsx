import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
} from '@/components/ui/message-scroller';

describe('Base UI MessageScroller Primitive', () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView =
      scrollIntoViewMock as unknown as typeof window.HTMLElement.prototype.scrollIntoView;
  });

  it('renders compound scroller tree with correct semantics and data-testids', () => {
    render(
      <MessageScrollerProvider autoScroll>
        <MessageScroller data-testid="scroller-root">
          <MessageScrollerViewport data-testid="message-stream-scroll-viewport" className="overflow-y-auto">
            <MessageScrollerContent data-testid="message-stream-container">
              <MessageScrollerItem messageId="msg-1">
                <div>Message 1</div>
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    );

    expect(screen.getByTestId('scroller-root')).toBeInTheDocument();
    expect(screen.getByTestId('message-stream-scroll-viewport')).toHaveClass('overflow-y-auto');
    const container = screen.getByTestId('message-stream-container');
    expect(container).toHaveTextContent('Message 1');
    expect(container).toHaveStyle({ minWidth: '0px' });
    expect(container.firstElementChild).toHaveClass('min-w-0');
  });

  it('applies instant scroll on initial history load and smooth scroll on subsequent additions', () => {
    function TestChat() {
      const [messages, setMessages] = React.useState<string[]>(['Initial 1', 'Initial 2']);
      return (
        <div>
          <button onClick={() => setMessages((prev) => [...prev, 'New message'])}>Add</button>
          <MessageScrollerProvider autoScroll>
            <MessageScroller>
              <MessageScrollerViewport data-testid="message-stream-scroll-viewport">
                <MessageScrollerContent data-testid="message-stream-container">
                  {messages.map((m, idx) => (
                    <MessageScrollerItem key={idx} messageId={`msg-${idx}`}>
                      <div>{m}</div>
                    </MessageScrollerItem>
                  ))}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        </div>
      );
    }

    render(<TestChat />);

    // Initial mount anchors instantly
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'instant' })
    );

    scrollIntoViewMock.mockClear();

    // Adding message triggers smooth scroll
    fireEvent.click(screen.getByText('Add'));

    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' })
    );
  });

  it('detaches auto-scroll when user scrolls up and displays floating MessageScrollerButton', async () => {
    const user = userEvent.setup();

    function TestChat() {
      const [messages, setMessages] = React.useState<string[]>(['Message 1', 'Message 2']);
      return (
        <div>
          <button onClick={() => setMessages((prev) => [...prev, `Streaming ${prev.length}`])}>
            Append
          </button>
          <MessageScrollerProvider autoScroll>
            <MessageScroller>
              <MessageScrollerViewport data-testid="message-stream-scroll-viewport">
                <MessageScrollerContent data-testid="message-stream-container">
                  {messages.map((m, idx) => (
                    <MessageScrollerItem key={idx} messageId={`msg-${idx}`}>
                      <div>{m}</div>
                    </MessageScrollerItem>
                  ))}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton data-testid="scroll-to-bottom-button" />
            </MessageScroller>
          </MessageScrollerProvider>
        </div>
      );
    }

    render(<TestChat />);

    const viewport = screen.getByTestId('message-stream-scroll-viewport');

    // Initially button is hidden because user is at bottom
    expect(screen.queryByTestId('scroll-to-bottom-button')).not.toBeInTheDocument();

    // Simulate user scrolling up
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 200, writable: true });

    act(() => {
      fireEvent.scroll(viewport);
    });

    // Floating button appears
    const scrollBottomBtn = await screen.findByTestId('scroll-to-bottom-button');
    expect(scrollBottomBtn).toBeInTheDocument();

    scrollIntoViewMock.mockClear();

    // When new streaming tokens or messages arrive while detached, auto-scroll does NOT fight user input
    fireEvent.click(screen.getByText('Append'));
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    // Clicking "Scroll to bottom" smoothly re-anchors to the live edge
    await user.click(scrollBottomBtn);
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' })
    );

    // Button disappears once re-anchored
    expect(screen.queryByTestId('scroll-to-bottom-button')).not.toBeInTheDocument();
  });

  it('Ticket 24 (#32): renders MessageScrollerButton anchored within a centered column container when alignToColumn is enabled', async () => {
    render(
      <MessageScrollerProvider autoScroll>
        <MessageScroller data-testid="scroller-root">
          <MessageScrollerViewport data-testid="message-stream-scroll-viewport">
            <MessageScrollerContent data-testid="message-stream-container">
              <MessageScrollerItem messageId="msg-1">
                <div>Message 1</div>
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton alignToColumn data-testid="scroll-to-bottom-button" />
        </MessageScroller>
      </MessageScrollerProvider>
    );

    const viewport = screen.getByTestId('message-stream-scroll-viewport');
    expect(screen.queryByTestId('scroll-to-bottom-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scroll-to-bottom-container')).not.toBeInTheDocument();

    // Detach by scrolling up
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 200, writable: true });

    act(() => {
      fireEvent.scroll(viewport);
    });

    const container = await screen.findByTestId('scroll-to-bottom-container');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('pointer-events-none');
    expect(container).toHaveClass('absolute');
    expect(container).toHaveClass('inset-x-0');
    expect(container).toHaveClass('bottom-4');
    expect(container).toHaveClass('px-4', 'sm:px-6');

    const innerColumn = container.firstElementChild as HTMLElement;
    expect(innerColumn).toBeInTheDocument();
    expect(innerColumn).toHaveClass('mx-auto', 'max-w-4xl', 'w-full', 'justify-end');

    const button = screen.getByTestId('scroll-to-bottom-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('pointer-events-auto');
    expect(innerColumn).toContainElement(button);
  });
});

