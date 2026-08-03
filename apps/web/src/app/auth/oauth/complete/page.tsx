'use client';

import { Loader2, LogIn, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { getErrorMessage } from '@/lib/api/errors';
import { toast } from '@/stores/toast-store';

type OAuthState = 'exchanging' | 'error';

/**
 * Terminal step of the Google OAuth flow (ADR-0011). The API callback redirects
 * here with a single-use handoff code; the code is exchanged for a real token
 * pair and the user lands on the dashboard.
 */
function OAuthCompleteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code') ?? '';
  const { signInWithGoogle, clearSession } = useAuth();

  const [state, setState] = useState<OAuthState>(
    code.length > 0 ? 'exchanging' : 'error',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shouldExchange = useMemo(
    () => code.length > 0 && state === 'exchanging',
    [code, state],
  );

  useEffect(() => {
    if (!shouldExchange) {
      return;
    }
    let cancelled = false;
    void signInWithGoogle(code)
      .then((user) => {
        if (cancelled) {
          return;
        }
        toast.success('Signed in', `Welcome, ${user.name ?? user.email}.`);
        router.replace('/');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        clearSession();
        setState('error');
        setErrorMessage(getErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [shouldExchange, code, signInWithGoogle, clearSession, router]);

  if (state === 'exchanging') {
    return (
      <AuthShell title="Completing sign in" description="Please wait a moment.">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <Loader2
            className="size-10 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            Securely exchanging your Google sign-in…
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Sign in failed"
      description={
        errorMessage ??
        'We could not complete the Google sign-in. Please try again.'
      }
      footer={
        <>
          Prefer email?{' '}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in with your password
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
          If this keeps happening, try signing in with your email and password.
        </p>
      </div>
      <Button asChild className="w-full">
        <Link href="/login">
          <LogIn className="size-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </Button>
    </AuthShell>
  );
}

export default function OAuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <OAuthCompleteForm />
    </Suspense>
  );
}
