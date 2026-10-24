import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Hepozy — Page Not Found',
  description: 'The page you requested could not be found.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight mb-2">404 - Page Not Found</h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/">
        <Button variant="default">Return to Home</Button>
      </Link>
    </div>
  );
}
