"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { getMembers, createMember, resetQrCode } from "@/lib/api"
import { useRealtimeCheckIns } from "@/hooks/use-realtime"
import type { Member, CheckInEvent } from "@/lib/types"
import {
  LogOut,
  Users,
  Download,
  Upload,
  Eye,
  RotateCcw,
  Printer,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function OwnerDashboard() {
  const router = useRouter()
  const { toast } = useToast()

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
    }
  }, [router])

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [blockedFilter, setBlockedFilter] = useState<"all" | "blocked" | "active">("all")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Members state
  const [membersData, setMembersData] = useState<Member[]>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [stats, setStats] = useState({ total: 0, blocked: 0, active: 0 })
  const [isLoading, setIsLoading] = useState(false)

  // Dialog states
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)

  // Create member form
  const [newMemberForm, setNewMemberForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
  })

  // --- WEBSOCKET FIX START ---
  const [recentCheckIns, setRecentCheckIns] = useState<CheckInEvent[]>([])

  // We wrap this in useCallback to prevent infinite connection loops
  const handleNewCheckIn = useCallback((event: CheckInEvent) => {
    console.log("[v0] New check-in received:", event)
    
    // Use functional update to safely add to list
    setRecentCheckIns((prev) => [event, ...prev.slice(0, 9)])

    toast({
      title: event.warning ? "⚠️ Passback Warning" : "✓ New Check-in",
      description: `${event.member.firstName} ${event.member.lastName} checked in`,
      variant: event.warning ? "destructive" : "default",
    })
  }, [toast])

  // Pass the stable callback to your hook
  const { isConnected, error: wsError } = useRealtimeCheckIns(handleNewCheckIn)
  // --- WEBSOCKET FIX END ---

  // Load members on change
  useEffect(() => {
    loadMembers()
  }, [searchQuery, blockedFilter, currentPage])

  const loadMembers = async () => {
    setIsLoading(true)
    try {
      const blocked = blockedFilter === "blocked" ? true : blockedFilter === "active" ? false : undefined

      const result = await getMembers(currentPage, searchQuery, blocked || false, pageSize.toString())

      console.log("[v0] Loaded members:", result)

      setMembersData(result.data || [])
      setTotalMembers(result.total || 0)
      setTotalPages(result.totalPages || 1)

      // Calculate stats (ideally the API returns this, but calculating client side works for small datasets)
      // Note: If you have pagination, this stats count is only for the *current page* or requires a separate API call.
      // For now we trust the result.total if available.
      setStats({
        total: result.pagination?.total || result.total || 0,
        blocked: 0, // Placeholder if API doesn't return count
        active: 0,  // Placeholder
      })
    } catch (error) {
      console.error("[v0] Failed to load members:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load members",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = () => {
    localStorage.removeItem("token")
    router.push("/")
  }

  const handleCreateMember = async () => {
    if (!newMemberForm.firstName || !newMemberForm.lastName || !newMemberForm.email) {
      toast({
        title: "Validation error",
        description: "All fields are required",
        variant: "destructive",
      })
      return
    }

    try {
      await createMember({
        firstName: newMemberForm.firstName,
        lastName: newMemberForm.lastName,
        email: newMemberForm.email,
      })

      toast({
        title: "Member created",
        description: "New member has been added successfully.",
      })

      setCreateDialogOpen(false)
      setNewMemberForm({ firstName: "", lastName: "", email: "" })
      setCurrentPage(1)
      loadMembers()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create member",
        variant: "destructive",
      })
    }
  }

  const handleResetQrCode = async (memberId: string) => {
    try {
      await resetQrCode(memberId)
      toast({
        title: "QR Code reset",
        description: "Member QR code has been regenerated.",
      })
      loadMembers()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset QR code",
        variant: "destructive",
      })
    }
  }

  const handleExportCSV = () => {
    try {
      const headers = ["firstName", "lastName", "email", "blocked", "emailValid", "createdAt"]
      const rows = membersData.map((m) => [m.firstName, m.lastName, m.email, m.blocked, m.emailValid, m.createdAt])

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

      const blob = new Blob([csv], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `members-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: "Export complete",
        description: "Members data has been exported to CSV.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export CSV",
        variant: "destructive",
      })
    }
  }

  const handleImportCSV = async () => {
    if (!csvFile) {
      toast({
        title: "Error",
        description: "Please select a CSV file",
        variant: "destructive",
      })
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        const lines = content.trim().split("\n")
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())

        let imported = 0
        const errors: string[] = []

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
            const row: Record<string, string> = {}

            headers.forEach((header, index) => {
              row[header] = values[index] || ""
            })

            if (!row.firstname || !row.lastname || !row.email) {
              errors.push(`Row ${i + 1}: Missing required fields`)
              continue
            }

            await createMember({
              firstName: row.firstname,
              lastName: row.lastname,
              email: row.email,
            })

            imported++
          } catch (error) {
            errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`)
          }
        }

        toast({
          title: "Import complete",
          description: `Imported ${imported} members${errors.length > 0 ? `. ${errors.length} errors occurred.` : "."}`,
        })

        setImportDialogOpen(false)
        setCsvFile(null)
        setCurrentPage(1)
        loadMembers()
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to import CSV",
          variant: "destructive",
        })
      }
    }
    reader.readAsText(csvFile)
  }

  const handleViewMember = (member: Member) => {
    setSelectedMember(member)
    setDetailsDrawerOpen(true)
  }

  const handlePrintQR = (member: Member) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    // Using a public API for QR generation for print view, but you could use your backend too
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(member.qrUuid)}`

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${member.firstName} ${member.lastName}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              background: white;
            }
            .container {
              text-align: center;
              max-width: 400px;
            }
            .logo {
              margin-bottom: 20px;
            }
            .logo img {
              width: 150px;
              height: auto;
            }
            h1 {
              color: #2f699f;
              margin: 0 0 10px 0;
              font-size: 24px;
            }
            .subtitle {
              color: #666;
              margin: 0 0 30px 0;
              font-size: 14px;
            }
            .qr-code {
              margin: 30px 0;
              padding: 20px;
              background: white;
              border: 2px solid #2f699f;
              border-radius: 12px;
              display: inline-block;
            }
            .qr-code img {
              display: block;
              width: 300px;
              height: 300px;
            }
            .member-info {
              margin-top: 30px;
              padding: 20px;
              background: #f5f5f5;
              border-radius: 8px;
              text-align: left;
            }
            .info-row {
              margin: 10px 0;
              font-size: 14px;
            }
            .info-label {
              font-weight: 600;
              color: #2f699f;
              display: inline-block;
              width: 100px;
            }
            .info-value {
              color: #333;
            }
            @media print {
              body {
                padding: 0;
              }
              .container {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              </div>
            <h1>15 Palle</h1>
            <p class="subtitle">Associazione Sportiva</p>
            
            <div class="qr-code">
              <img src="${qrCodeUrl}" alt="QR Code" />
            </div>
            
            <div class="member-info">
              <div class="info-row">
                <span class="info-label">Name:</span>
                <span class="info-value">${member.firstName} ${member.lastName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Email:</span>
                <span class="info-value">${member.email}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Member ID:</span>
                <span class="info-value">${member._id}</span>
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <main className="flex-1 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold">Owner Dashboard</h1>
              <p className="text-muted-foreground">Manage club members</p>
              {wsError && <p className="text-sm text-destructive mt-1">WebSocket: {wsError}</p>}
              {isConnected && <p className="text-sm text-green-600 mt-1">✓ Real-time updates connected</p>}
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stats.total}</div>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <Users className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                {/* Fallback to simple calculation if API doesn't return breakdown */}
                <div className="text-2xl font-bold text-green-600">{membersData.filter(m => !m.blocked).length}</div>
              </CardContent>
            </Card>

            <Card className="border-red-200 sm:col-span-2 lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blocked</CardTitle>
                <Users className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                 {/* Fallback to simple calculation if API doesn't return breakdown */}
                <div className="text-2xl font-bold text-red-600">{membersData.filter(m => m.blocked).length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="members" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="checkins">
                Recent Check-ins
                {recentCheckIns.length > 0 && (
                  <Badge className="ml-2 bg-primary text-primary-foreground">{recentCheckIns.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Members Management</CardTitle>
                      <CardDescription>View and manage all club members</CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button onClick={() => setCreateDialogOpen(true)} size="sm">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add Member
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportCSV}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Import
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Filters */}
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="search">Search</Label>
                        <Input
                          id="search"
                          placeholder="Search by name or email..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value)
                            setCurrentPage(1)
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <select
                          id="status"
                          value={blockedFilter}
                          onChange={(e) => {
                            setBlockedFilter(e.target.value as "all" | "blocked" | "active")
                            setCurrentPage(1)
                          }}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="all">All Members</option>
                          <option value="active">Active</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">Loading members...</div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="hidden sm:table-cell">Email</TableHead>
                            <TableHead className="hidden md:table-cell">Created</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {membersData.map((member) => (
                            <TableRow key={member._id}>
                              <TableCell className="font-medium">
                                {member.firstName} {member.lastName}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">{member.email}</TableCell>
                              <TableCell className="hidden md:table-cell">
                                {new Date(member.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {member.blocked ? (
                                  <Badge variant="destructive">Blocked</Badge>
                                ) : member.emailValid ? (
                                  <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
                                ) : (
                                  <Badge variant="secondary">Pending</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleViewMember(member)}
                                    title="View details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handlePrintQR(member)}
                                    title="Print QR code"
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleResetQrCode(member._id)}
                                    title="Reset QR code"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {membersData.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                No members found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages} ({totalMembers} total members)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="checkins" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Check-ins</CardTitle>
                  <CardDescription>Real-time check-ins via WebSocket</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentCheckIns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No recent check-ins</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Check-ins will appear here in real-time when members scan their QR codes
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentCheckIns.map((checkIn, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between rounded-lg border p-4 ${
                            checkIn.warning ? "border-red-300 bg-red-50" : "border-border bg-background"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                checkIn.warning ? "bg-red-600" : "bg-primary"
                              } text-white`}
                            >
                              {checkIn.warning ? "⚠" : "✓"}
                            </div>
                            <div>
                              <p className="font-semibold">
                                {checkIn.member.firstName} {checkIn.member.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">{checkIn.member.email}</p>
                              {checkIn.warning && (
                                <p className="text-sm text-red-600 font-medium mt-1">{checkIn.warning}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              {new Date(checkIn.timestamp).toLocaleTimeString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(checkIn.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />

      {/* Create Member Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Member</DialogTitle>
            <DialogDescription>Add a new member to the club</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-firstName">First Name</Label>
              <Input
                id="new-firstName"
                value={newMemberForm.firstName}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, firstName: e.target.value })}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-lastName">Last Name</Label>
              <Input
                id="new-lastName"
                value={newMemberForm.lastName}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, lastName: e.target.value })}
                placeholder="Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newMemberForm.email}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                placeholder="john.doe@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateMember}>Create Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Members from CSV</DialogTitle>
            <DialogDescription>Upload a CSV file with columns: firstName, lastName, email</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportCSV} disabled={!csvFile}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Details Drawer */}
      <Sheet open={detailsDrawerOpen} onOpenChange={setDetailsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-6">
          <SheetHeader>
            <SheetTitle>Member Details</SheetTitle>
            <SheetDescription>View and manage member information</SheetDescription>
          </SheetHeader>
          {selectedMember && (
            <div className="mt-6 space-y-6">
              <div className="space-y-4">
                <Card className="px-4 py-3">
                  <h3 className="mb-3 text-sm font-semibold">Personal Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">
                        {selectedMember.firstName} {selectedMember.lastName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium">{selectedMember.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Member ID:</span>
                      <span className="font-mono text-xs">{selectedMember._id}</span>
                    </div>
                  </div>
                </Card>

                <Card className="px-4 py-3">
                  <h3 className="mb-3 text-sm font-semibold">Account Status</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status:</span>
                      {selectedMember.blocked ? (
                        <Badge variant="destructive">Blocked</Badge>
                      ) : selectedMember.emailValid ? (
                        <Badge className="bg-green-600">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email Verified:</span>
                      <span className="font-medium">{selectedMember.emailValid ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created:</span>
                      <span className="font-medium">{new Date(selectedMember.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Card>

                <Card className="px-4 py-3">
                  <h3 className="mb-3 text-sm font-semibold">QR Code</h3>
                  <div className="flex justify-center py-4">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedMember.qrUuid)}`}
                      alt="Member QR Code"
                      className="rounded-lg border-2 border-primary"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    QR UUID: {selectedMember.qrUuid.substring(0, 8)}...
                  </p>
                </Card>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={() => handlePrintQR(selectedMember)} className="w-full">
                  <Printer className="mr-2 h-4 w-4" />
                  Print QR Code
                </Button>
                <Button variant="outline" onClick={() => handleResetQrCode(selectedMember._id)} className="w-full">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset QR Code
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}