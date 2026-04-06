import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import { supabaseConfigured } from '@/lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error: err } = await signIn(email, password)
        if (err) {
          setError(err.message)
          return
        }
        navigate('/app/dashboard', { replace: true })
      } else {
        const { error: err } = await signUp(email, password, fullName)
        if (err) {
          setError(err.message)
          return
        }
        setError('Account created! You can now sign in.')
        setMode('login')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!supabaseConfigured) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
        <p className="text-[var(--color-text-muted)]">Supabase environment variables are missing.</p>
        <Link to="/" className="text-[var(--color-accent)]">
          Back to setup
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[var(--color-surface-2)] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-lg">
        <div className="mb-8 flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-[var(--color-accent)]" />
          <span className="text-xl font-semibold text-[var(--color-text)]">Novox Core Marketing</span>
        </div>
        <h1 className="mb-6 text-lg font-medium text-[var(--color-text)]">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' ? (
            <Input
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          ) : null}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full !text-white">
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 w-full text-left text-sm font-medium text-[var(--color-text)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError(null)
          }}
        >
        </button>
      </div>
    </div>
  )
}
