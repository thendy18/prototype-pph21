"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type BreadcrumbEntry = {
  label: string
  href?: string
}

function getBreadcrumbEntries(pathname: string): BreadcrumbEntry[] {
  if (pathname === "/users") {
    return [
      { label: "Payroll Coretax", href: "/bulk" },
      { label: "Administration", href: "/users" },
      { label: "User Management" },
    ]
  }

  if (pathname === "/history") {
    return [
      { label: "Payroll Coretax", href: "/bulk" },
      { label: "Payroll", href: "/bulk" },
      { label: "Histori Periode" },
    ]
  }

  if (pathname.startsWith("/history/")) {
    return [
      { label: "Payroll Coretax", href: "/bulk" },
      { label: "Payroll", href: "/bulk" },
      { label: "Histori Periode", href: "/history" },
      { label: "Detail Histori" },
    ]
  }

  if (pathname === "/dashboard") {
    return [
      { label: "Payroll Coretax", href: "/bulk" },
      { label: "Payroll", href: "/bulk" },
      { label: "Dashboard" },
    ]
  }

  if (pathname.startsWith("/dashboard/")) {
    return [
      { label: "Payroll Coretax", href: "/bulk" },
      { label: "Payroll", href: "/bulk" },
      { label: "Detail Karyawan" },
    ]
  }

  if (pathname === "/bulk" || pathname === "/") {
    return [
      { label: "Payroll Coretax", href: "/bulk" },
      { label: "Payroll", href: "/bulk" },
      { label: "Bulk Payroll" },
    ]
  }

  return [
    { label: "Payroll Coretax", href: "/bulk" },
    { label: "Workspace" },
  ]
}

export function AppBreadcrumb() {
  const pathname = usePathname()
  const entries = getBreadcrumbEntries(pathname)

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-[#F7FFF7]/60">
        {entries.map((entry, index) => {
          const isLast = index === entries.length - 1

          return (
            <div key={`${entry.label}-${index}`} className="contents">
              <BreadcrumbItem
                className={index === 0 ? "hidden md:block" : undefined}
              >
                {isLast || !entry.href ? (
                  <BreadcrumbPage className="font-semibold text-[#F7FFF7]">
                    {entry.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="hover:text-[#FFE66D]">
                    <Link href={entry.href}>{entry.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator className="hidden text-[#6CA6C1]/70 md:block" />
              )}
            </div>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
