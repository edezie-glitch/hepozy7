import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { UserProfileDropdown } from '@/components/workspace/user-profile-dropdown';
import { MessageItem } from '@/components/chat/message-item';
import type { ChatMessageItem } from '@/lib/api/chat';

describe('Ticket 27: UI Primitives & Workspace Focus Token Standardization', () => {
  describe('Badge component focus tokens', () => {
    it('applies focus-visible:ring-ring, focus-visible:ring-offset-0, and ring-offset-background without unanchored ring-offset-2', () => {
      render(<Badge tabIndex={0}>Status</Badge>);
      const badge = screen.getByText('Status');
      expect(badge).toHaveClass('focus-visible:ring-ring');
      expect(badge).toHaveClass('focus-visible:ring-offset-0');
      expect(badge).toHaveClass('ring-offset-background');
      expect(badge).not.toHaveClass('focus:ring-offset-2');
      expect(badge).not.toHaveClass('focus-visible:ring-offset-2');
    });
  });

  describe('Input component focus tokens', () => {
    it('removes focus-visible:ring-offset-1 gap artifact and normalizes to focus-visible:ring-offset-0', () => {
      render(<Input placeholder="Type here..." />);
      const input = screen.getByPlaceholderText('Type here...');
      expect(input).toHaveClass('focus-visible:ring-ring');
      expect(input).toHaveClass('focus-visible:ring-offset-0');
      expect(input).toHaveClass('ring-offset-background');
      expect(input).not.toHaveClass('focus-visible:ring-offset-1');
    });
  });

  describe('UserProfileDropdown trigger focus tokens', () => {
    it('uses standard tokenized focus-visible:ring-ring instead of disparate focus-visible:ring-primary', () => {
      render(<UserProfileDropdown showName={true} />);
      const trigger = screen.getByRole('button', { name: /user profile menu/i });
      expect(trigger).toHaveClass('focus-visible:ring-ring');
      expect(trigger).toHaveClass('focus-visible:ring-offset-0');
      expect(trigger).toHaveClass('ring-offset-background');
      expect(trigger).not.toHaveClass('focus-visible:ring-primary');
    });
  });

  describe('MessageItem action buttons focus tokens', () => {
    it('uses standard 2px focus-visible:ring-2 focus-visible:ring-ring instead of disparate focus-visible:ring-1', () => {
      const mockMsg: ChatMessageItem = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Hello world',
        created_at: new Date().toISOString(),
      };
      render(<MessageItem message={mockMsg} />);
      const copyBtn = screen.getByRole('button', { name: /copy message/i });
      expect(copyBtn).toHaveClass('focus-visible:ring-2');
      expect(copyBtn).toHaveClass('focus-visible:ring-ring');
      expect(copyBtn).toHaveClass('focus-visible:ring-offset-0');
      expect(copyBtn).not.toHaveClass('focus-visible:ring-1');
    });
  });
});
