import type { ReactNode } from "react";
import {
  LayoutDashboardIcon,
  HistoryIcon,
  BarChart3Icon,
  SettingsIcon,
  HelpCircleIcon,
  ActivityIcon,
  PlusCircleIcon,
} from "lucide-react";

export type SidebarNavItem = {
  title: string;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  label?: string;
  items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
  {
    items: [
      {
        title: "New Analysis",
        path: "/dashboard",
        icon: <PlusCircleIcon />,
        isActive: true,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        title: "Dashboard",
        path: "/dashboard",
        icon: <LayoutDashboardIcon />,
      },
      {
        title: "History",
        path: "/history",
        icon: <HistoryIcon />,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        title: "Analytics",
        path: "/dashboard",
        icon: <BarChart3Icon />,
      },
      {
        title: "Settings",
        path: "/settings",
        icon: <SettingsIcon />,
      },
    ],
  },
];

export const footerNavLinks: SidebarNavItem[] = [
  {
    title: "Help Center",
    path: "#/help",
    icon: <HelpCircleIcon />,
  },
  {
    title: "System Status",
    path: "#/status",
    icon: <ActivityIcon />,
  },
];

export const navLinks: SidebarNavItem[] = [
  ...navGroups.flatMap((group) =>
    group.items.flatMap((item) =>
      item.subItems?.length ? [item, ...item.subItems] : [item]
    )
  ),
  ...footerNavLinks,
];
