"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import type { CurrentUserProfile } from "@/types/auth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  CalculatorIcon,
  FileCode2Icon,
  LayoutDashboardIcon,
  ShieldCheckIcon,
  WalletCardsIcon,
} from "lucide-react"

const baseData = {
  teams: [
    {
      name: "Taxeling",
      logo: (
        <CalculatorIcon
        />
      ),
      plan: "Internal Payroll",
    },
    // {
    //   name: "PPh 21 / 26",
    //   logo: (
    //     <CalculatorIcon
    //     />
    //   ),
    //   plan: "Tax Engine",
    // },
    // {
    //   name: "BPMP Coretax",
    //   logo: (
    //     <FileCode2Icon
    //     />
    //   ),
    //   plan: "XML Export",
    // },
  ],
  navMain: [
    {
      title: "Payroll",
      url: "/bulk",
      icon: (
        <CalculatorIcon
        />
      ),
      isActive: true,
      items: [
        {
          title: "Bulk Payroll",
          url: "/bulk",
        },
        {
          title: "Histori Periode",
          url: "/history",
        },
      ],
    },
  ],
}

export function AppSidebar({
  currentUser,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  currentUser: CurrentUserProfile
}) {
  const navMain =
    currentUser.role === "master"
      ? [
          ...baseData.navMain,
          {
            title: "Administration",
            url: "/users",
            icon: (
              <ShieldCheckIcon
              />
            ),
            items: [
              {
                title: "User Management",
                url: "/users",
              },
            ],
          },
        ]
      : baseData.navMain

  return (
    <Sidebar
      collapsible="icon"
      className="border-[#6CA6C1]/20"
      {...props}
    >
      <SidebarHeader>
        <TeamSwitcher teams={baseData.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: currentUser.fullName,
            email: currentUser.email,
            role: currentUser.role,
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
