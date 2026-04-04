export function Setup() {
  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Configure Supabase</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        Copy <code className="rounded bg-[var(--color-surface-2)] px-1">.env.example</code> to{' '}
        <code className="rounded bg-[var(--color-surface-2)] px-1">.env</code> and set{' '}
        <code className="rounded bg-[var(--color-surface-2)] px-1">VITE_SUPABASE_URL</code> and{' '}
        <code className="rounded bg-[var(--color-surface-2)] px-1">VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY</code>{' '}
        (or <code className="rounded bg-[var(--color-surface-2)] px-1">VITE_SUPABASE_ANON_KEY</code>).
        Run <code className="rounded bg-[var(--color-surface-2)] px-1">supabase/ensure_profiles.sql</code> then the
        full file <code className="rounded bg-[var(--color-surface-2)] px-1">supabase/migrations/20260404000000_initial_schema.sql</code>{' '}
        in the Supabase SQL Editor. If you see{' '}
        <em>Could not find the table &apos;public.profiles&apos; in the schema cache</em>, run{' '}
        <code className="rounded bg-[var(--color-surface-2)] px-1">ensure_profiles.sql</code>, then in{' '}
        <strong>Project Settings → API</strong> choose <strong>Reload schema</strong>. Create users under Authentication
        and set <code className="rounded bg-[var(--color-surface-2)] px-1">role</code> to <strong>admin</strong> in{' '}
        <code className="rounded bg-[var(--color-surface-2)] px-1">profiles</code> for your account.
      </p>
    </div>
  )
}
