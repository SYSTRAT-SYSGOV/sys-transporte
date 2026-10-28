import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bus,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, Card, ErrorBanner, Input, Label } from "@sysgov/ui";

const schema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe a senha"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  if (user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await login(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível autenticar",
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gov-page text-gov-text-primary">
      <header className="border-b border-gov-border bg-card shadow-sm">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gov-blue text-white shadow-sm">
              <Bus className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide">
                <span className="text-gov-blue">SYS</span>
                <span className="text-success">TRAT</span>
                <span className="ml-2 font-semibold normal-case text-gov-text-primary">
                  Transporte Escolar
                </span>
              </p>
              <p className="text-[11px] text-gov-text-muted">
                Padrão Digital de Governo • UIKIT GOVBR V3
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-xs text-gov-text-secondary sm:flex">
            <ShieldCheck className="size-4 text-success" aria-hidden />
            <span className="font-mono">
              Acesso seguro • eMAG / WCAG 2.1 AA
            </span>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Card className="gap-0 border-gov-border p-6 shadow-md sm:p-8">
            <div className="text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gov-primary-light text-gov-primary">
                <Bus className="size-6" aria-hidden />
              </span>
              <h1 className="mt-4 text-2xl font-bold tracking-tight">
                Acesso ao painel
              </h1>
              <p className="mt-1 text-xs text-gov-text-secondary">
                Informe suas credenciais institucionais para acessar o
                transporte escolar.
              </p>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              <ErrorBanner message={error} />

              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-[11px] font-bold uppercase tracking-wider text-gov-text-secondary"
                >
                  E-mail institucional
                </Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gov-text-muted"
                    aria-hidden
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="nome@instituicao.gov.br"
                    className="pl-9"
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p
                    id="email-error"
                    className="text-xs font-medium text-destructive"
                  >
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-[11px] font-bold uppercase tracking-wider text-gov-text-secondary"
                >
                  Senha de acesso
                </Label>
                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gov-text-muted"
                    aria-hidden
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pr-10 pl-9"
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                    {...register("password")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconSm"
                    className="absolute top-1/2 right-0.5 -translate-y-1/2 text-gov-text-muted hover:bg-transparent hover:text-gov-blue-dark"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                {errors.password && (
                  <p
                    id="password-error"
                    className="text-xs font-medium text-destructive"
                  >
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Entrando…
                  </>
                ) : (
                  <>
                    Entrar no painel
                    <ArrowRight />
                  </>
                )}
              </Button>

              <p className="text-center text-[11px] text-gov-text-muted">
                Após 5 tentativas inválidas, a conta fica bloqueada por 15
                minutos.
              </p>
            </form>
          </Card>

          <p className="mt-5 text-center text-[11px] text-gov-text-muted">
            Acesso restrito a operadores autorizados. Operações registradas na
            trilha de auditoria.
          </p>
        </div>
      </main>

      <footer className="border-t border-gov-border bg-card px-4 py-3 text-center text-[11px] text-gov-text-muted">
        <span className="font-semibold text-gov-text-secondary">
          Padrão Digital de Governo • UIKIT GOVBR V3
        </span>
        <span className="mt-0.5 block font-mono">
          SYSTRAT • Transporte Escolar • {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}
