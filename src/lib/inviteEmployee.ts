import { supabase, supabaseConfigured } from '@/lib/supabase'
import type { UserRole } from '@/types/db'

export async function inviteEmployee(params: {
  email: string
  password: string
  fullName: string
  role: UserRole
}): Promise<{ error: string | null }> {
  if (!supabaseConfigured) return { error: 'Supabase is not configured.' }

  // 1. Check if user already exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', params.email.trim().toLowerCase())
    .maybeSingle()

  if (existing) {
    return { error: 'A team member with this email already exists.' }
  }

  // 2. Insert into profiles with the password (instant)
  // Note: We use a random UUID since we aren't using Supabase Auth for this specific record yet.
  // When the user later signs in, our custom auth will check this table.
  const { error } = await supabase.from('profiles').insert({
    id: crypto.randomUUID(),
    email: params.email.trim().toLowerCase(),
    password: params.password,
    full_name: params.fullName.trim(),
    role: params.role,
  })

  if (error) return { error: error.message }
  return { error: null }
}
