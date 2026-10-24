import { RegisterForm } from '@/components/auth/register-form';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata = {
  title: 'Hepozy — Create account',
  description: 'Create a new Hepozy AI workspace account.',
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <header className="absolute top-0 right-0 p-4 z-10">
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <RegisterForm />
      </main>
    </div>
  );
}
