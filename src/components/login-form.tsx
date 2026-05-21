"use client"

import { useActionState } from "react"

import { login } from "@/actions/authActions"
import { cn } from "@/lib/utils"
import type { LoginFormState } from "@/types/auth"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const INITIAL_STATE: LoginFormState = {}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [state, action, pending] = useActionState(login, INITIAL_STATE)

  return (
    <form
      action={action}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-black tracking-tight text-[#FFE66D]">
            Payroll Coretax
          </h1>
        </div>

        <Field>
          <FieldLabel
            htmlFor="email"
            className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/55"
          >
            Email
          </FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="user@company.com"
            required
            className="h-12 rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 px-4 font-semibold text-[#F7FFF7] placeholder:text-[#6CA6C1]/55 hover:border-[#6CA6C1] focus-visible:ring-2 focus-visible:ring-[#6CA6C1]/25"
          />
        </Field>

        <Field>
          <FieldLabel
            htmlFor="password"
            className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/55"
          >
            Password
          </FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Masukkan password"
            required
            className="h-12 rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 px-4 font-semibold text-[#F7FFF7] placeholder:text-[#6CA6C1]/55 hover:border-[#6CA6C1] focus-visible:ring-2 focus-visible:ring-[#6CA6C1]/25"
          />
        </Field>

        {state.error && (
          <div className="rounded-2xl border border-[#FFE66D]/40 bg-[#FFE66D]/10 px-4 py-3 text-sm font-semibold text-[#FFE66D]">
            {state.error}
          </div>
        )}

        <Field>
          <Button
            type="submit"
            disabled={pending}
            className="h-12 rounded-xl bg-[#FFE66D] text-sm font-black text-[#343434] hover:bg-[#F7FFF7] focus-visible:ring-[#FFE66D]/30 disabled:cursor-not-allowed disabled:bg-[#343434]/70 disabled:text-[#F7FFF7]/40"
          >
            {pending ? "Memproses..." : "Masuk"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
