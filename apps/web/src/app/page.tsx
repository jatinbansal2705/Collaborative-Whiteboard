'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  CheckCircle2,
  LogIn,
  LogOut,
  PenLine,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import {
  healthService,
  type HealthStatus,
} from '@/lib/api/services/health-service';
import { loginSchema, type LoginInput } from '@/lib/validators/auth';
import { toast } from '@/stores/toast-store';

function formatUptime(uptimeSeconds: number): string {
  const minutes = Math.floor(uptimeSeconds / 60);
  const seconds = Math.round(uptimeSeconds % 60);
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

export default function HomePage() {
  const { isAuthenticated, user, login, logout } = useAuth();

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function handleHealthCheck(): Promise<void> {
    setCheckingHealth(true);
    setHealthError(null);
    try {
      setHealth(await healthService.check());
      toast.success('API is healthy', 'The backend responded successfully.');
    } catch (error) {
      setHealth(null);
      setHealthError(
        error instanceof Error ? error.message : 'Health check failed.',
      );
      toast.error('Health check failed', 'Is the API running on port 3000?');
    } finally {
      setCheckingHealth(false);
    }
  }

  async function handleLogin(values: LoginInput): Promise<void> {
    try {
      const signedInUser = await login(values);
      toast.success(
        'Signed in',
        `Welcome back, ${signedInUser.name ?? signedInUser.email}.`,
      );
      form.reset();
    } catch (error) {
      toast.error(
        'Sign in failed',
        error instanceof Error ? error.message : 'Unexpected error.',
      );
    }
  }

  async function handleLogout(): Promise<void> {
    await logout();
    toast.info('Signed out', 'Your session has been cleared.');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <PenLine className="size-5" aria-hidden="true" />
            <span className="font-semibold">Whiteboard</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
        <section className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Collaborate in real&nbsp;time.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            A Phase 8 foundation scaffold: Next.js 15, Tailwind, shadcn/ui,
            Zustand stores, and a centralized API client with automatic token
            refresh.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4" aria-hidden="true" />
                API health
              </CardTitle>
              <CardDescription>
                Probes <code>/health</code> through the shared HTTP client.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                onClick={handleHealthCheck}
                disabled={checkingHealth}
              >
                {checkingHealth ? 'Checking…' : 'Check API health'}
              </Button>

              {health ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2
                    className="size-4 text-success"
                    aria-hidden="true"
                  />
                  <span className="font-medium capitalize">
                    {health.service}
                  </span>
                  <span className="text-muted-foreground">
                    v{health.version} · db {health.checks.database.latencyMs}ms
                    · up {formatUptime(health.uptime)}
                  </span>
                </div>
              ) : null}

              {healthError ? (
                <div className="flex items-center gap-2 text-sm">
                  <XCircle
                    className="size-4 text-destructive"
                    aria-hidden="true"
                  />
                  <span className="text-destructive">{healthError}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4" aria-hidden="true" />
                {isAuthenticated ? 'Signed in' : 'Sign in'}
              </CardTitle>
              <CardDescription>
                RHF + Zod login wired to the auth store and API client.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAuthenticated && user ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {user.name ?? user.email}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="size-4" aria-hidden="true" />
                    Sign out
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(handleLogin)}
                    className="space-y-4"
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
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Uses the same policy as the API LoginDto.
                          </FormDescription>
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
                    <Button type="submit" className="w-full">
                      <LogIn className="size-4" aria-hidden="true" />
                      Sign in
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6 text-sm text-muted-foreground">
          <span>Collaborative Whiteboard</span>
          <span>Phase 8 · Frontend foundation</span>
        </div>
      </footer>
    </div>
  );
}
