'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
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
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@/lib/validators/auth';

function ForgotPasswordForm() {
  const { forgotPassword } = useAuth();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function handleSubmit(values: ForgotPasswordInput): Promise<void> {
    setPending(true);
    setFormError(null);
    try {
      await forgotPassword(values);
      setSent(true);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        description="If that email is registered, we have sent a password reset link."
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
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <MailCheck
            className="size-10 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            The reset link expires shortly, so open it soon.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your account email and we will send a reset link."
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={pending}>
            <Send className="size-4" aria-hidden="true" />
            {pending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
