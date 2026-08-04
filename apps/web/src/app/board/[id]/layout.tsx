import { RequireAuth } from '@/components/auth/route-guard';

export default function BoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireAuth>{children}</RequireAuth>;
}
