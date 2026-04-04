import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
} from 'date-fns'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import type { Client, TaskRow } from '@/types/db'
import { Card } from '@/components/ui/Card'

export function Calendar() {
  const [month, setMonth] = useState(() => new Date())
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [filterClient, setFilterClient] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [taskPlatforms, setTaskPlatforms] = useState<{ task_id: string; platform?: string }[]>([])

  const load = useCallback(async () => {
    if (!supabaseConfigured) return
    const { data: t } = await supabase.from('tasks').select('*')
    setTasks((t as TaskRow[]) ?? [])
    const { data: c } = await supabase.from('clients').select('*')
    setClients((c as Client[]) ?? [])
    const { data: tp } = await supabase
      .from('task_platforms')
      .select('task_id, client_platforms(platform)')
    setTaskPlatforms(
      (tp as { task_id: string; client_platforms?: { platform?: string } }[])?.map((r) => ({
        task_id: r.task_id,
        platform: r.client_platforms?.platform,
      })) ?? [],
    )
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredTasks = useMemo(() => {
    let list = tasks
    if (filterClient) list = list.filter((t) => t.client_id === filterClient)
    if (filterPlatform) {
      const ids = new Set(taskPlatforms.filter((x) => x.platform === filterPlatform).map((x) => x.task_id))
      list = list.filter((t) => ids.has(t.id))
    }
    return list
  }, [tasks, filterClient, filterPlatform, taskPlatforms])

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })

  function tasksOnDay(d: Date) {
    return filteredTasks.filter((t) => {
      const deadline = t.deadline ? isSameDay(parseISO(t.deadline), d) : false
      const publish = t.publish_date ? isSameDay(parseISO(t.publish_date), d) : false
      return deadline || publish
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Calendar</h1>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
          >
            <option value="">All platforms</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="linkedin">LinkedIn</option>
            <option value="gmb">GMB</option>
            <option value="website">Website</option>
          </select>
          <button
            type="button"
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1))}
          >
            Next
          </button>
        </div>
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">
        {format(month, 'MMMM yyyy')} — showing tasks on deadline or publish date
      </p>
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-[var(--color-text-muted)]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const inMonth = isSameMonth(d, month)
          const dayTasks = tasksOnDay(d)
          return (
            <Card key={d.toISOString()} padding className={`min-h-[100px] !p-2 ${!inMonth ? 'opacity-40' : ''}`}>
              <div className="text-xs font-semibold text-[var(--color-text)]">{format(d, 'd')}</div>
              <div className="mt-1 space-y-1">
                {dayTasks.map((t) => (
                  <Link
                    key={t.id}
                    to={`/app/tasks/${t.id}`}
                    className="block truncate rounded bg-[var(--color-surface-2)] px-1 py-0.5 text-[10px] text-[var(--color-text)] hover:text-[var(--color-accent)]"
                    title={t.title}
                  >
                    {t.title}
                  </Link>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
