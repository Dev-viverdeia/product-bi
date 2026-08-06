# Product BI

Plataforma de BI da Viver de IA. Base em Vite + React + TypeScript com Supabase.

## Stack

| Camada | Escolha |
| --- | --- |
| Build | Vite 8 |
| UI | React 19, TypeScript, Tailwind CSS v4, shadcn/ui (new-york) |
| Rotas | React Router (`react-router`) |
| Dados | TanStack Query |
| Backend | Supabase (Postgres 17, Auth, RLS) |
| Gráficos | Recharts (via `@/components/ui/chart`) |
| Formulários | React Hook Form + Zod |

## Rodando local

```bash
npm install
cp .env.example .env.local   # preencha VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

As variáveis são validadas com Zod em [src/lib/env.ts](src/lib/env.ts) — se faltar alguma, o app falha no boot com a mensagem do que está faltando.

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento em http://localhost:5173 |
| `npm run build` | type-check + build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | apenas type-check |
| `npm run db:types` | regenera `src/types/database.types.ts` (requer Supabase CLI logada) |

## Supabase

- Projeto: `product-bi` — ref `xkxxmekeofdoigrrbaoe`, região `sa-east-1`, org `viverdeia`
- Painel: https://supabase.com/dashboard/project/xkxxmekeofdoigrrbaoe

### Schema atual

`public.profiles` — 1:1 com `auth.users`, criada automaticamente no signup pelo trigger `on_auth_user_created`.

| Coluna | Tipo |
| --- | --- |
| `id` | `uuid` PK → `auth.users(id)` on delete cascade |
| `email` | `text` |
| `full_name` | `text` |
| `avatar_url` | `text` |
| `role` | `user_role` (`admin` \| `member`), default `member` |
| `created_at` / `updated_at` | `timestamptz` |

RLS ligada:

- `select` — qualquer usuário autenticado lê todos os perfis
- `update` — política única: dono do registro ou admin
- `delete` — só admin
- trigger `profiles_prevent_role_escalation` impede que um `member` mude o próprio `role`

Funções auxiliares (`is_admin`, `handle_new_user`, `set_updated_at`, `prevent_role_escalation`) ficam no schema `private`, fora da API REST — use `private.is_admin()` nas policies das próximas tabelas.

### Migrations

O SQL aplicado está versionado em [supabase/migrations](supabase/migrations). Migrations novas foram aplicadas via MCP; para usar a CLI:

```bash
npx supabase link --project-ref xkxxmekeofdoigrrbaoe
```

### Confirmação de e-mail

O projeto está com **confirmação de e-mail obrigatória** (padrão do Supabase). Um usuário recém-criado só consegue entrar após confirmar. Para desligar em desenvolvimento: Dashboard → Authentication → Sign In / Providers → Email → *Confirm email*.

## Estrutura

```
src/
  app/          providers (Query, tema, auth, toaster) e router
  components/
    layout/     shell autenticado — sidebar, header, registro de navegação
    ui/         shadcn/ui (gerado por CLI, fora do lint)
  features/
    auth/       contexto, provider, rotas guardadas, tela de login
  hooks/        hooks compartilhados
  lib/          env validado, client Supabase, utils
  pages/        páginas de rota
  types/        types gerados do banco
```

### Kit de gráficos

`src/components/charts/` — componentes de dataviz do produto, no padrão do Viver de IA DS e validados por script de contraste/daltonismo (skill dataviz):

| Componente | Uso |
| --- | --- |
| `ChartCard` | moldura de todo gráfico: título, estados loading/erro/vazio/refetch |
| `KpiCard` / `KpiGrid` | stat tiles com count-up, delta e sparkline; entrada escalonada |
| `TimeSeriesChart` | linha/área, máx. 2 séries (por tipo); 2ª tracejada + legenda |
| `CategoryBarChart` | colunas/barras horizontais, base no zero, valor na ponta |
| `DonutChart` | composição, máx. 5 fatias (agrega "Outros"), total no centro |
| `ChartReveal` | entrada animada via motion (não usar animação nativa do Recharts) |

Formatadores pt-BR em [src/lib/format.ts](src/lib/format.ts). Showcase vivo em `/design`.

### Onde encaixar um módulo novo

1. Página em `src/pages/` (ou `src/features/<modulo>/` se tiver estado próprio)
2. Rota em [src/app/router.tsx](src/app/router.tsx), dentro de `<ProtectedRoute>` → `<AppLayout>`
3. Item de menu em [src/components/layout/nav-items.ts](src/components/layout/nav-items.ts)
4. Migration no Supabase e `npm run db:types` para atualizar os types
