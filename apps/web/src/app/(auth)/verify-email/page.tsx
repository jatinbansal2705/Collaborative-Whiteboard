'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircle2,
  Loader2,
  MailCheck,
  Send,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
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
import { getErrorMessage, hasApiErrorCode } from '@/lib/api/errors';
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@/lib/validators/auth';

type VerifyState = 'verifying' | 'success' | 'error' | 'idle';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const initialEmail = searchParams.get('email') ?? '';

  const { verifyEmail, resendVerification } = useAuth();

  const [state, setState] = useState<VerifyState>(
    token.length > 0 ? 'verifying' : 'idle',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendPending, setResendPending] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: initialEmail },
  });

  const shouldVerify = useMemo(
    () => token.length > 0 && state === 'verifying',
    [token, state],
  );

  useEffect(() => {
    if (!shouldVerify) {
      return;
    }
    let cancelled = false;
    void verifyEmail(token)
      .then(() => {
        if (!cancelled) {
          setState('success');
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (hasApiErrorCode(error, 'EMAIL_ALREADY_VERIFIED')) {
          setState('success');
          return;
        }
        setState('error');
        setErrorMessage(getErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [shouldVerify, token, verifyEmail]);

  async function handleResend(values: ForgotPasswordInput): Promise<void> {
    setResendPending(true);
    setResendDone(false);
    try {
      await resendVerification(values.email);
      setResendDone(true);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setResendPending(false);
    }
  }

  if (state === 'verifying') {
    return (
      <AuthShell
        title="Verifying your email"
        description="Please wait a moment."
      >
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <Loader2
            className="size-10 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            Confirming your email address…
          </p>
        </div>
      </AuthShell>
    );
  }

  if (state === 'success') {
    return (
      <AuthShell
        title="Email verified"
        description="Your email address has been confirmed."
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
          <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            You can now sign in to your account.
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
      title={
        state === 'error' ? 'Could not verify your email' : 'Verify your email'
      }
      description={
        state === 'error'
          ? (errorMessage ?? 'The verification link is invalid or has expired.')
          : 'Enter your email to receive a fresh verification link.'
      }
      footer={
        <>
          Already verified?{' '}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {state === 'error' ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>The link may have expired. Request a new one below.</span>
        </div>
      ) : null}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleResend)}
          className="space-y-4"
          noValidate
        >
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

          <Button type="submit" className="w-full" disabled={resendPending}>
            <Send className="size-4" aria-hidden="true" />
            {resendPending ? 'Sending…' : 'Resend verification email'}
          </Button>

          {resendDone ? (
            <p
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
              role="status"
            >
              <MailCheck className="size-4" aria-hidden="true" />
              If the email is registered and unverified, a link is on its way.
            </p>
          ) : null}
        </form>
      </Form>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
