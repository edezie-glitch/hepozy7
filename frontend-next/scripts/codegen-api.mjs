import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import openapiTS, { astToString } from 'openapi-typescript';

const currentDir = path.resolve(import.meta.dirname);
const rootDir = path.resolve(currentDir, '..');
const repoRoot = path.resolve(rootDir, '..');
const typesDir = path.resolve(rootDir, 'src', 'types');

if (!fs.existsSync(typesDir)) {
  fs.mkdirSync(typesDir, { recursive: true });
}

async function fetchOpenApiSchema() {
  const url = 'http://localhost:8000/openapi.json';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      console.log(`✓ Fetched live OpenAPI schema from ${url}`);
      return await res.json();
    }
  } catch {
    // Server not running, fallback to python export
  }

  console.log('Backend not reachable at localhost:8000. Generating schema from FastAPI orchestrator via Python...');
  const candidates = [
    path.join(repoRoot, '.venv', 'Scripts', 'python.exe'),
    path.join(repoRoot, '.venv', 'bin', 'python'),
    'python3',
    'python',
  ];

  let pyPath = candidates.find((p) => fs.existsSync(p)) || 'python';
  const pyCode = 'import json, sys; from orchestrator.main import app; sys.stdout.write(json.dumps(app.openapi()))';
  
  try {
    const output = execSync(`"${pyPath}" -c "${pyCode}"`, {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'inherit'],
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(output);
  } catch (err) {
    console.error('Failed to generate schema via Python:', err);
    throw err;
  }
}

async function main() {
  console.log('Generating TypeScript types from OpenAPI schema...');
  const schema = await fetchOpenApiSchema();
  
  // Save raw schema
  const schemaPath = path.join(typesDir, 'openapi.json');
  fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), 'utf-8');
  console.log(`✓ Saved OpenAPI schema to ${path.relative(rootDir, schemaPath)}`);

  // Generate TypeScript AST
  const ast = await openapiTS(schema);
  const typesOutput = astToString(ast);

  const schemaDtsPath = path.join(typesDir, 'schema.d.ts');
  fs.writeFileSync(schemaDtsPath, typesOutput, 'utf-8');
  console.log(`✓ Generated TypeScript definitions in ${path.relative(rootDir, schemaDtsPath)}`);

  // Also maintain api.d.ts re-export for backwards compatibility
  const apiDtsPath = path.join(typesDir, 'api.d.ts');
  fs.writeFileSync(apiDtsPath, "export * from './schema';\n", 'utf-8');

  // Generate convenient type helpers
  const helperContent = `// Auto-generated helper types from OpenAPI specification
import type { components, paths } from './schema';

export type { components, paths };

// Schemas
export type ChatRequest = components['schemas']['ChatRequest'];
export type ChatResponse = components['schemas']['ChatResponse'];
export type AuthResponse = components['schemas']['AuthResponse'];
export type LoginRequest = components['schemas']['LoginRequest'];
export type SignupRequest = components['schemas']['SignupRequest'];
export type SignupResponse = components['schemas']['SignupResponse'];
export type RefreshRequest = components['schemas']['RefreshRequest'];
export type RefreshResponse = components['schemas']['RefreshResponse'];
export type StopRequest = components['schemas']['StopRequest'];
export type EditRequest = components['schemas']['EditRequest'];
export type CrawlRequest = components['schemas']['CrawlRequest'];
export type TitleUpdate = components['schemas']['TitleUpdate'];
`;

  const helperPath = path.join(typesDir, 'api.ts');
  fs.writeFileSync(helperPath, helperContent, 'utf-8');
  console.log(`✓ Generated client type helpers in ${path.relative(rootDir, helperPath)}`);
}

main().catch((err) => {
  console.error('API codegen failed:', err);
  process.exit(1);
});
