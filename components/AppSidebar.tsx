import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Coffee, Home, Menu } from "lucide-react";
import Link from "next/link";

const menus = [
  { title: "Home", href: "/", Icon: Home },
  { title: "Menu", href: "/menu", Icon: Coffee },
  { title: "Orders", href: "/orders", Icon: Menu }, // Assuming you want to use the Menu icon for orders as well
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {menus.map(({ title, href, Icon }) => (
              <SidebarMenuItem key={href}>
                <Link href={href}>
                  <SidebarMenuButton>
                    <Icon className="mr-2 h-4 w-4" />
                    {title}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
