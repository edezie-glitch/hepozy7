import { LoginForm } from '@/components/auth/login-form';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata = {
  title: 'Hepozy — Log in',
  description: 'Log in to your Hepozy AI workspace account.',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <header className="absolute top-0 right-0 p-4 z-10">
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <LoginForm />
      </main>
    </div>
  );
}
