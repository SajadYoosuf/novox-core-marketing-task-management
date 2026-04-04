import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types/db'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  initialized: boolean
  setSession: (session: Session | null) => void
  fetchProfile: (userId: string) => Promise<void>
  init: () => void
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  canManageClients: () => boolean
  isElevated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
    })
  },

  fetchProfile: async (userId) => {
    if (!supabaseConfigured) {
      set({ profile: null })
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error(error)
      set({ profile: null })
      return
    }
    set({ profile: data as Profile })
  },

  init: () => {
    const saved = localStorage.getItem('ag_user_profile')
    if (saved) {
      try {
        const profile = JSON.parse(saved)
        set({ profile, user: { id: profile.id, email: profile.email } as any })
      } catch (e) {
        localStorage.removeItem('ag_user_profile')
      }
    }
  },

  signIn: async (email, password) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase is not configured') }
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        console.error('Sign-in error:', error)
        return { error: error as Error }
      }

      if (data.user) {
        await get().fetchProfile(data.user.id)
        return { error: null }
      }
      return { error: new Error('Invalid email or password.') }
    } catch (err) {
      console.error('Unexpected sign-in error:', err)
      return { error: err as Error }
    }
  },

  signUp: async (email, password, fullName) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase is not configured') }
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })

      if (error) {
        console.error('Sign-up error:', error)
        return { error: error as Error }
      }

      if (data.user) {
        return { error: null }
      }
      return { error: new Error('Failed to create account.') }
    } catch (err) {
      console.error('Unexpected sign-up error:', err)
      return { error: err as Error }
    }
  },

  signOut: async () => {
    localStorage.removeItem('ag_user_profile')
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null })
  },

  refreshProfile: async () => {
    const uid = get().user?.id
    if (uid) await get().fetchProfile(uid)
  },

  canManageClients: () => {
    const r = get().profile?.role
    return r === 'admin' || r === 'marketing_head' || r === 'designer_head'
  },

  isElevated: () => {
    const r = get().profile?.role
    return r === 'admin' || r === 'marketing_head' || r === 'designer_head'
  },
}))

export function roleOrder(role: UserRole): number {
  const order: UserRole[] = ['admin', 'marketing_head', 'designer_head', 'designer', 'marketing_executive']
  return order.indexOf(role)
}
