import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config';

describe('next.config.ts rewrites', () => {
  it('proxies /api/:path* and /files/:path* to FastAPI backend at http://localhost:8000', async () => {
    expect(nextConfig.rewrites).toBeDefined();
    if (typeof nextConfig.rewrites === 'function') {
      const rewrites = await nextConfig.rewrites();
      const list = Array.isArray(rewrites)
        ? rewrites
        : [...(rewrites.beforeFiles || []), ...(rewrites.afterFiles || [])];

      const apiRewrite = list.find((r) => r.source === '/api/:path*');
      expect(apiRewrite).toBeDefined();
      expect(apiRewrite?.destination).toBe('http://localhost:8000/:path*');

      const filesRewrite = list.find((r) => r.source === '/files/:path*');
      expect(filesRewrite).toBeDefined();
      expect(filesRewrite?.destination).toBe('http://localhost:8000/files/:path*');
    }
  });
});
