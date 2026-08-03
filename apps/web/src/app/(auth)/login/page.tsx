'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { GoogleButton } from '@/components/auth/google-button';
import { Separator } from '@/components/ui/separator';
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
import { getSafeRedirectPath } from '@/lib/auth-guard';
import { loginSchema, type LoginInput } from '@/lib/validators/auth';
import { toast } from '@/stores/toast-store';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function handleSubmit(values: LoginInput): Promise<void> {
    setPending(true);
    setFormError(null);
    try {
      const user = await login(values);
      toast.success('Signed in', `Welcome back, ${user.name ?? user.email}.`);
      const next = searchParams.get('next');
      router.replace(getSafeRedirectPath(next));
    } catch (error) {
      if (hasApiErrorCode(error, 'EMAIL_NOT_VERIFIED')) {
        const query = new URLSearchParams({ email: values.email });
        router.replace(`/verify-email?${query.toString()}`);
        toast.info(
          'Verify your email',
          'Check your inbox for the verification link before signing in.',
        );
        return;
      }
      setFormError(getErrorMessage(error, 'Invalid email or password.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      description="Welcome back — sign in to reach your boards."
      footer={
        <>
          New to Whiteboard?{' '}
          <Link
            href="/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton />

      <div className="flex items-center gap-3" aria-hidden="true">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
          noValidate
        >
          {formError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>{formError}</span>
            </div>
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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            <LogIn className="size-4" aria-hidden="true" />
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
