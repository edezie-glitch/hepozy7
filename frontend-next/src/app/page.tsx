import { WorkspaceShell } from '@/components/workspace/workspace-shell';
import { QueryProvider } from '@/components/query-provider';

export default function Home() {
  return (
    <QueryProvider>
      <WorkspaceShell />
    </QueryProvider>
  );
}
