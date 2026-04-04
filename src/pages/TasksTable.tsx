import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { StatusBadge } from '@/components/ui/Badge'
import type { TaskRow } from '@/types/db'
import { format } from 'date-fns'

export function TasksTable() {
  const [tasks, setTasks] = useState<(TaskRow & { clients?: { name?: string } | null })[]>([])

  const load = useCallback(async () => {
    if (!supabaseConfigured) return
    const { data } = await supabase.from('tasks').select('*, clients(name)').order('deadline', { ascending: true, nullsFirst: false })
    setTasks((data as typeof tasks) ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Task table</h1>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <tr>
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Client</th>
              <th className="p-3 font-medium">Priority</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="p-3">
                  <Link className="font-medium text-[var(--color-accent)] hover:underline" to={`/app/tasks/${t.id}`}>
                    {t.title}
                  </Link>
                </td>
                <td className="p-3 text-[var(--color-text-muted)]">{t.clients?.name ?? '—'}</td>
                <td className="p-3 capitalize">{t.priority}</td>
                <td className="p-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="p-3 text-[var(--color-text-muted)]">
                  {t.deadline ? format(new Date(t.deadline), 'MMM d, yyyy HH:mm') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
