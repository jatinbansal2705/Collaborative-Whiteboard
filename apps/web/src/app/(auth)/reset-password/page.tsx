'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, ShieldCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { getErrorMessage } from '@/lib/api/errors';
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from '@/lib/validators/auth';
import { toast } from '@/stores/toast-store';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { resetPassword } = useAuth();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  async function handleSubmit(values: ResetPasswordInput): Promise<void> {
    setPending(true);
    setFormError(null);
    try {
      await resetPassword(values);
      setSuccess(true);
      toast.success(
        'Password updated',
        'You can now sign in with your new password.',
      );
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  if (token.length === 0) {
    return (
      <AuthShell
        title="Reset link required"
        description="This page needs the reset link from your email to continue."
        footer={
          <>
            Link expired?{' '}
            <Link
              href="/forgot-password"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Request a new one
            </Link>
          </>
        }
      >
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center"
        >
          <TriangleAlert
            className="size-10 text-destructive"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            Open the password reset link from your email, or request a new link
            below.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell
        title="Password reset"
        description="Your password has been updated successfully."
        footer={
          <>
            Back to{' '}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              sign in
            </Link>
          </>
        }
      >
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <ShieldCheck className="size-10 text-success" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Use your new password to sign in.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      description="Choose a strong password for your account."
      footer={
        <>
          Remembered your password?{' '}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
          noValidate
        >
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="8+ characters with a letter and a number"
                    autoComplete="new-password"
                    autoFocus
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={pending}>
            <KeyRound className="size-4" aria-hidden="true" />
            {pending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
