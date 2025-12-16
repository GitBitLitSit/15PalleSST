"use client"

import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, Mail, Calendar, LogOut, Maximize2, Minimize2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import type { Member } from "@/lib/types"

export default function CustomerProfilePage() {
  const router = useRouter()
  const [member, setMember] = useState<Member | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const memberData = localStorage.getItem("currentMember")
    if (memberData) {
      setMember(JSON.parse(memberData))
    } else {
      // Redirect to login if no member data found
      router.replace("/login")
    }
  }, [router])

  const handleSignOut = () => {
    localStorage.removeItem("currentMember")
    router.push("/")
  }

  if (!member) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <main className="flex-1 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="mb-2 text-3xl font-bold">My Profile</h1>
                <p className="text-muted-foreground">Your membership information</p>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Profile Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Your account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">First Name</p>
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{member.firstName}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Last Name</p>
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{member.lastName}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="break-all">{member.email}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Member Since</p>
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{new Date(member.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Status</p>
                    {member.blocked ? (
                      <Badge variant="destructive">Account Blocked</Badge>
                    ) : member.emailValid ? (
                      <Badge className="bg-green-600 hover:bg-green-700">Active Member</Badge>
                    ) : (
                      <Badge variant="secondary">Pending Verification</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* QR Code */}
              <Card className={isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Your QR Code</CardTitle>
                      <CardDescription>Present this to scan at the club</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="shrink-0"
                    >
                      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent
                  className={isFullscreen ? "flex flex-col items-center justify-center h-[calc(100vh-8rem)]" : ""}
                >
                  <div className={`space-y-6 text-center ${isFullscreen ? "scale-150" : ""}`}>
                    <div className="space-y-2">
                      <p className={`font-bold ${isFullscreen ? "text-4xl" : "text-2xl"}`}>
                        {member.firstName} {member.lastName}
                      </p>
                      <p className={`text-muted-foreground ${isFullscreen ? "text-2xl" : "text-base"}`}>
                        {member.email}
                      </p>
                    </div>

                    <div className="flex justify-center">
                      <div className="rounded-lg border bg-white p-4">
                        <QRCodeSVG value={member.qrUuid} size={isFullscreen ? 256 : 200} level="H" />
                      </div>
                    </div>

                    <div>
                      {member.blocked ? (
                        <Badge variant="destructive" className="text-lg px-4 py-2">
                          ⚠ Account Blocked
                        </Badge>
                      ) : (
                        <Badge className="bg-green-600 hover:bg-green-700 text-lg px-4 py-2">✓ Active Member</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
