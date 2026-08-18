import { useState } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/use-auth'

const signInSchema = z.object({
  email: z.email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
})

const signUpSchema = signInSchema.extend({
  fullName: z.string().min(2, 'Informe seu nome'),
})

type SignInValues = z.infer<typeof signInSchema>
type SignUpValues = z.infer<typeof signUpSchema>

export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [tab, setTab] = useState('signin')

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '' },
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

  async function onSignUp(values: SignUpValues) {
    try {
      await signUp(values.email, values.password, values.fullName)
      toast.success('Conta criada', {
        description: 'Confirme o e-mail se a verificação estiver ativa.',
      })
      setTab('signin')
      signUpForm.reset()
    } catch (error) {
      toast.error('Não foi possível criar a conta', {
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
            <CardDescription>
              Entre com seu e-mail corporativo para continuar.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="pt-4">
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
              </TabsContent>

              <TabsContent value="signup" className="pt-4">
                <Form {...signUpForm}>
                  <form
                    onSubmit={signUpForm.handleSubmit(onSignUp)}
                    className="space-y-4"
                  >
                    <FormField
                      control={signUpForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome completo</FormLabel>
                          <FormControl>
                            <Input autoComplete="name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signUpForm.control}
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
                      control={signUpForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              autoComplete="new-password"
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
                      disabled={signUpForm.formState.isSubmitting}
                    >
                      {signUpForm.formState.isSubmitting && (
                        <Loader2Icon className="animate-spin" />
                      )}
                      Criar conta
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
