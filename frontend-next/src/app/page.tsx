import { WorkspaceShell } from '@/components/workspace/workspace-shell';
import { QueryProvider } from '@/components/query-provider';

export default function Home({
  defaultCollapsed = false,
}: {
  defaultCollapsed?: boolean;
} = {}) {
  return (
    <QueryProvider>
      <WorkspaceShell defaultCollapsed={defaultCollapsed} />
    </QueryProvider>
  );
}
