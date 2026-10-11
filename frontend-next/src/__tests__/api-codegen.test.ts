import { describe, it, expectTypeOf } from 'vitest';
import type { ChatRequest, ChatResponse, AuthResponse } from '@/types/api';

describe('OpenAPI TypeScript Codegen Types', () => {
  it('has correctly typed ChatRequest shape', () => {
    expectTypeOf<ChatRequest>().toHaveProperty('message');
    expectTypeOf<ChatRequest['message']>().toEqualTypeOf<string>();
  });

  it('has correctly typed ChatResponse shape', () => {
    expectTypeOf<ChatResponse>().toHaveProperty('reply');
    expectTypeOf<ChatResponse>().toHaveProperty('conversation_id');
    expectTypeOf<ChatResponse['reply']>().toEqualTypeOf<string>();
    expectTypeOf<ChatResponse['conversation_id']>().toEqualTypeOf<string>();
  });

  it('has correctly typed AuthResponse shape', () => {
    expectTypeOf<AuthResponse>().toHaveProperty('token');
    expectTypeOf<AuthResponse>().toHaveProperty('username');
    expectTypeOf<AuthResponse>().toHaveProperty('user_id');
    expectTypeOf<AuthResponse['token']>().toEqualTypeOf<string>();
  });
});
