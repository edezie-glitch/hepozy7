'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const redirectTo = `${origin}/auth/callback?next=/reset-password/update`;

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setSubmittedEmail(data.email);
      setIsLoading(false);
    } catch {
      setErrorMessage('Unable to connect to server. Please try again.');
      setIsLoading(false);
    }
  };

  if (submittedEmail) {
    return (
      <div className="w-full max-w-[420px] rounded-2xl bg-card border border-border/60 p-8 shadow-xl text-center">
        <div className="w-14 h-14 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto mb-6">
          <Mail className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-foreground mb-2">
          Check your email
        </h1>

        <p className="text-sm text-muted-foreground mb-1">We sent a recovery link to</p>
        <p className="text-sm font-semibold text-foreground break-all">{submittedEmail}</p>

        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
          Click the link in the email to reset your password. If you don&apos;t see the email, check your spam folder.
        </p>

        <div className="mt-8 space-y-3 text-xs">
          <div>
            <button
              type="button"
              onClick={() => setSubmittedEmail(null)}
              className="text-primary font-medium hover:underline cursor-pointer"
            >
              Try another email
            </button>
          </div>
          <div>
            <Link href="/login" className="text-muted-foreground hover:text-foreground hover:underline">
              Back to log in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] rounded-2xl bg-card border border-border/60 p-8 shadow-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reset password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-5 rounded-lg bg-destructive/15 border border-destructive/25 px-4 py-3 text-xs text-destructive font-medium"
        >
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            error={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-11 text-sm font-semibold mt-2"
          disabled={isLoading}
        >
          {isLoading ? 'Sending recovery link...' : 'Send recovery link'}
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-muted-foreground">
        Remember your password?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to log in
        </Link>
      </div>
    </div>
  );
}
