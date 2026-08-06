import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url('VITE_SUPABASE_URL precisa ser uma URL válida'),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY é obrigatória'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')

  throw new Error(
    `Variáveis de ambiente inválidas. Copie .env.example para .env.local e preencha:\n${issues}`,
  )
}

export const env = parsed.data
