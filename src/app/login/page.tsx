import { GalleryVerticalEnd } from "lucide-react"
import { redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { getCurrentUserProfile } from "@/lib/auth"

type LoginPageProps = {
  searchParams: Promise<{
    reason?: string | string[]
  }>
}

function firstValue(value: string | string[] | undefined): string | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] : value
}

function readReasonMessage(reason: string | null): string | null {
  if (reason === "signin") {
    return "Silakan login untuk mengakses aplikasi."
  }

  if (reason === "inactive") {
    return "Akun Anda sedang nonaktif atau tidak memiliki akses aplikasi."
  }

  return null
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const currentUser = await getCurrentUserProfile()
  if (currentUser) {
    redirect("/bulk")
  }

  const params = await searchParams
  const reasonMessage = readReasonMessage(firstValue(params.reason))

  return (
    <main className="grid min-h-svh bg-[#343434] font-mono text-[#F7FFF7] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="flex flex-col gap-8 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <div className="flex items-center gap-3 font-black text-[#F7FFF7]">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#FFE66D] text-[#343434] shadow-lg shadow-black/20">
              <GalleryVerticalEnd className="size-5" />
            </div>
            <div>
              <div className="text-sm leading-none">Taxeling</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#6CA6C1]">
                Internal Payroll
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061] p-6 shadow-2xl shadow-black/30 md:p-8">
            {reasonMessage && (
              <div className="mb-5 rounded-2xl border border-[#FFE66D]/40 bg-[#FFE66D]/10 px-4 py-3 text-sm font-semibold text-[#FFE66D]">
                {reasonMessage}
              </div>
            )}
            <LoginForm />
          </div>
        </div>
      </section>

      <section className="relative hidden overflow-hidden border-l border-[#6CA6C1]/20 bg-[#2F3061] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,230,109,0.28),transparent_28%),radial-gradient(circle_at_82%_35%,rgba(108,166,193,0.26),transparent_30%),linear-gradient(135deg,rgba(47,48,97,1),rgba(52,52,52,1))]" />
        <div className="absolute -right-24 top-20 h-72 w-72 rounded-full border border-[#FFE66D]/30 bg-[#FFE66D]/10 blur-sm" />
        <div className="absolute -bottom-28 left-16 h-80 w-80 rounded-full border border-[#6CA6C1]/30 bg-[#6CA6C1]/10 blur-sm" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="w-fit rounded-full border border-[#6CA6C1]/30 bg-[#343434]/45 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#6CA6C1]">
            PPh 21 / 26 Workspace
          </div>

          <div className="max-w-xl">
            <h2 className="text-5xl font-black leading-tight tracking-tight text-[#F7FFF7]">
              Payroll aman, akses terkontrol, export siap Coretax.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#F7FFF7]/68">
              Login internal untuk mengelola payroll, BPJS, PPh 21/26, user
              role, slip gaji PDF, dan XML BPMP dalam satu workspace.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {["Auth", "Payroll", "BPMP"].map((label) => (
              <div
                key={label}
                className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/55 p-4"
              >
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFE66D]">
                  Module
                </div>
                <div className="mt-2 text-sm font-black text-[#F7FFF7]">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
