"use client";

import { CartButton } from "@/components/CartButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { Coffee, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const NAV = [{ href: "/menu", label: "เมนู" }] as const;

export const SiteHeader = () => {
  const pathname = usePathname();
  const router = useRouter();

  const { mutateAsync } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Logout failed");
      }
    },
  });

  const handleLogout = async () => {
    try {
      await mutateAsync();
      router.push("/login");
    } catch (error) {
      toast.error("Logout failed. Please try again.");
      console.error("Logout error:", error);
    }
  };

  // Hide chrome on auth pages so login/register read as focused screens.
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-md">
            <Coffee className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">My Coffee</span>
        </Link>

        <nav className="ml-2 flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <CartButton />
          <Button variant="outline" size="icon">
            <LogOut />
          </Button>
        </div>
      </div>
    </header>
  );
};
