'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(20, 'Password must be at least 20 characters (a short sentence works well)'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;

export function UpdatePasswordForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: UpdatePasswordFormData) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      await supabase.auth.signOut();
      router.push('/login?reset=success');
    } catch {
      setErrorMessage('Unable to connect to server. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] rounded-2xl bg-card border border-border/60 p-8 shadow-xl">
      <div className="mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-4">
          <KeyRound className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Set new password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Please enter and confirm your new password below.
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

      <form method="POST" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 20 characters"
            autoComplete="new-password"
            error={!!errors.password}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Repeat your new password"
            autoComplete="new-password"
            error={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-11 text-sm font-semibold mt-2"
          disabled={isLoading}
        >
          {isLoading ? 'Updating password...' : 'Update password'}
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-muted-foreground">
        Remember your old password?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to log in
        </Link>
      </div>
    </div>
  );
}
