"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { logout } from "@/actions/authActions"
import { usePayrollStore } from "@/store/usePayrollStore"
import { ChevronsUpDownIcon, LogOutIcon, ShieldCheckIcon, UserCircleIcon } from "lucide-react"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    role: "master" | "staff"
  }
}) {
  const { isMobile } = useSidebar()
  const resetStore = usePayrollStore((state) => state.resetStore)
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "PC"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFE66D] text-xs font-black text-[#343434]">
                {initials}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs uppercase tracking-[0.16em] text-sidebar-foreground/60">{user.role}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg border-[#6CA6C1]/30 bg-[#343434] text-[#F7FFF7]"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFE66D] text-xs font-black text-[#343434]">
                  {initials}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-[#F7FFF7]/60">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#6CA6C1]/20" />
            <DropdownMenuItem className="gap-2 focus:bg-[#2F3061] focus:text-[#FFE66D]">
              <UserCircleIcon />
              {user.role === "master" ? "Master User" : "Staff User"}
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 focus:bg-[#2F3061] focus:text-[#FFE66D]">
              <ShieldCheckIcon />
              Internal Payroll Access
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#6CA6C1]/20" />
            <form action={logout}>
              <DropdownMenuItem
                asChild
                className="gap-2 focus:bg-[#2F3061] focus:text-[#FFE66D]"
              >
                <button
                  type="submit"
                  onClick={() => resetStore()}
                  className="flex w-full items-center gap-2"
                >
                  <LogOutIcon />
                  Log out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
