import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata = {
  title: 'Hepozy — Update password',
  description: 'Update your Hepozy account password.',
};

export default function UpdatePasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <header className="absolute top-0 right-0 p-4 z-10">
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <UpdatePasswordForm />
      </main>
    </div>
  );
}
