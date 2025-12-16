"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Menu, LogOut } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userType, setUserType] = useState<"customer" | "owner" | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    const memberData = localStorage.getItem("currentMember")

    if (token) {
      setIsLoggedIn(true)
      setUserType("owner")
    } else if (memberData) {
      setIsLoggedIn(true)
      setUserType("customer")
    } else {
      setIsLoggedIn(false)
      setUserType(null)
    }
  }, [pathname])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("currentMember")
    setIsLoggedIn(false)
    setUserType(null)
    router.push("/")
  }

  const getNavItems = () => {
    const baseItems = [
      { href: "/", label: "Home" },
      { href: "/opening-times", label: "Opening Times" },
      { href: "/contact", label: "Contact" },
    ]

    if (!isLoggedIn) {
      return [...baseItems, { href: "/login", label: "Login" }]
    }

    if (userType === "customer") {
      return [...baseItems, { href: "/customer/profile", label: "My Profile" }]
    }

    if (userType === "owner") {
      return [...baseItems, { href: "/owner/dashboard", label: "Dashboard" }]
    }

    return baseItems
  }

  const navItems = getNavItems()

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="15 Palle Logo" width={50} height={50} className="h-12 w-auto" />
            <span className="text-xl font-bold text-primary">15 Palle</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  pathname === item.href ? "text-primary" : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
            {isLoggedIn && (
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="border-t border-border py-4 md:hidden">
            <div className="flex flex-col gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary",
                    pathname === item.href ? "text-primary" : "text-muted-foreground",
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {isLoggedIn && (
                <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 justify-start">
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
