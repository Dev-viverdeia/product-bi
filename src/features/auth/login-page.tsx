import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { MarcaVia } from '@/components/ui-marca/marca-via'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/use-auth'

const signInSchema = z.object({
  email: z.email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
})

type SignInValues = z.infer<typeof signInSchema>

export function LoginPage() {
  const { signIn } = useAuth()

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSignIn(values: SignInValues) {
    try {
      await signIn(values.email, values.password)
    } catch (error) {
      toast.error('Não foi possível entrar', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      })
    }
  }

  return (
    <div className="page-atmosphere flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* A marca assina; o nome do produto é o título. Nessa ordem: quem
              abre a tela precisa saber de quem é o BI antes de saber qual é. */}
          <MarcaVia peca="lockup" className="text-foreground h-5" />
          <h1 className="text-xl font-semibold">Product BI</h1>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Acessar a plataforma</CardTitle>
            {/* Não há criação de conta aqui, e a tela diz por quê: quem tem
                conta vê o BI inteiro, nomes e e-mails de cliente inclusive, e
                o controle passou a ser quem recebe acesso. Sem esta linha, o
                visitante conclui que a tela está quebrada. */}
            <CardDescription>
              O acesso é concedido pelo time. Entre com o e-mail cadastrado ou
              peça uma conta a quem administra o BI.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...signInForm}>
              <form
                onSubmit={signInForm.handleSubmit(onSignIn)}
                className="space-y-4"
              >
                <FormField
                  control={signInForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="voce@viverdeia.ai"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signInForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={signInForm.formState.isSubmitting}
                >
                  {signInForm.formState.isSubmitting && (
                    <Loader2Icon className="animate-spin" />
                  )}
                  Entrar
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
