import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config';

describe('next.config.ts rewrites', () => {
  it('proxies /api/:path* to FastAPI backend at http://localhost:8000/:path*', async () => {
    expect(nextConfig.rewrites).toBeDefined();
    if (typeof nextConfig.rewrites === 'function') {
      const rewrites = await nextConfig.rewrites();
      const apiRewrite = Array.isArray(rewrites)
        ? rewrites.find((r) => r.source === '/api/:path*')
        : rewrites.beforeFiles?.find((r) => r.source === '/api/:path*') ||
          rewrites.afterFiles?.find((r) => r.source === '/api/:path*');

      expect(apiRewrite).toBeDefined();
      expect(apiRewrite?.destination).toBe('http://localhost:8000/:path*');
    }
  });
});
