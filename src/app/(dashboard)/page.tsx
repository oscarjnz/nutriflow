import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/get-user';

export default async function DashboardHomePage() {
  const user = await requireUser();
  const greetingName =
    (user.user_metadata?.['full_name'] as string | undefined) ?? user.email ?? 'amigo';

  return (
    <main className="space-y-6 p-5">
      <header className="space-y-1">
        <p className="text-[var(--color-muted-foreground)] text-sm">Hola,</p>
        <h1 className="text-2xl font-semibold tracking-tight">{greetingName}</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Resumen del dia</CardTitle>
        </CardHeader>
        <CardContent className="text-[var(--color-muted-foreground)] text-sm">
          El dashboard de macros entra en el Sprint 1. Por ahora la sesion esta lista, el menu
          inferior funciona y la cuenta esta vinculada a Supabase.
        </CardContent>
      </Card>
    </main>
  );
}
