"use client"

import { useEffect, useState, useCallback, useRef } from "react"
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
import { getMembers, createMember, resetQrCode, getCheckIns, updateMember } from "@/lib/api"
import { useRealtimeCheckIns } from "@/hooks/use-realtime"
import type { Member, CheckInEvent } from "@/lib/types"
import {
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
  Pencil,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"

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

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState("members")

  // --- MEMBERS STATE ---
  const [searchQuery, setSearchQuery] = useState("")
  const [blockedFilter, setBlockedFilter] = useState<"all" | "blocked" | "active">("all")
  const [membersPage, setMembersPage] = useState(1)
  const [membersData, setMembersData] = useState<Member[]>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [totalMembersPages, setTotalMembersPages] = useState(0)
  const [isMembersLoading, setIsMembersLoading] = useState(false)
  const membersPageSize = 20

  // --- CHECK-INS STATE ---
  const [checkInsData, setCheckInsData] = useState<CheckInEvent[]>([])
  const [checkInsPage, setCheckInsPage] = useState(1)
  const [totalCheckIns, setTotalCheckIns] = useState(0)
  const [totalCheckInsPages, setTotalCheckInsPages] = useState(0)
  const [isCheckInsLoading, setIsCheckInsLoading] = useState(false)
  const [unreadCheckInsCount, setUnreadCheckInsCount] = useState(0)
  const checkInsPageSize = 20

  // --- REFS ---
  const activeTabRef = useRef(activeTab)
  const checkInsPageRef = useRef(checkInsPage)

  useEffect(() => { activeTabRef.current = activeTab }, [activeTab])
  useEffect(() => { checkInsPageRef.current = checkInsPage }, [checkInsPage])

  // --- DIALOGS & FORMS ---
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false)
  
  // Create State
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newMemberForm, setNewMemberForm] = useState({ 
    firstName: "", 
    lastName: "", 
    email: "", 
    sendEmail: false 
  })
  const [createError, setCreateError] = useState<string | null>(null)
  
  // Import State
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  
  // Edit State
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editMemberForm, setEditMemberForm] = useState({ 
    id: "", 
    firstName: "", 
    lastName: "", 
    email: "", 
    blocked: false 
  })

  const [stats, setStats] = useState({ total: 0, blocked: 0, active: 0 })

  // --- NEU: CLEANUP EFFECT ---
  // Dieser Effect feuert immer, wenn der Dialog geschlossen wird (createDialogOpen wird false).
  // Er setzt das Formular UND die Fehlermeldung zurück.
  useEffect(() => {
    if (!createDialogOpen) {
      setCreateError(null)
      setNewMemberForm({ firstName: "", lastName: "", email: "", sendEmail: false })
    }
  }, [createDialogOpen])

  // --- WEBSOCKET HANDLER ---
  const handleNewCheckIn = useCallback((event: CheckInEvent) => {
    setCheckInsData((prev) => {
      if (checkInsPageRef.current === 1) {
        const newList = [event, ...prev]
        if (newList.length > checkInsPageSize) return newList.slice(0, checkInsPageSize)
        return newList
      }
      return prev
    })

    if (activeTabRef.current !== "checkins") {
      setUnreadCheckInsCount((prev) => prev + 1)
      toast({
        title: event.warning ? "⚠️ Passback Warning" : "✓ New Check-in",
        description: `${event.member.firstName} ${event.member.lastName} checked in`,
        variant: event.warning ? "destructive" : "default",
      })
    }
  }, [toast])

  const { isConnected, error: wsError } = useRealtimeCheckIns(handleNewCheckIn)

  // --- LOAD MEMBERS ---
  const loadMembers = async () => {
    setIsMembersLoading(true)
    try {
      const blocked = blockedFilter === "blocked" ? true : blockedFilter === "active" ? false : undefined
      const result = await getMembers(membersPage, searchQuery, blocked || false, membersPageSize.toString())

      setMembersData(result.data || [])
      setTotalMembers(result.pagination?.total || 0)
      setTotalMembersPages(result.pagination?.totalPages || 1)
      setStats({
        total: result.pagination?.total || 0,
        blocked: 0, 
        active: 0,
      })
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load members", variant: "destructive" })
    } finally {
      setIsMembersLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "members") {
      loadMembers()
    }
  }, [searchQuery, blockedFilter, membersPage, activeTab])

  // --- LOAD CHECK-INS ---
  const loadCheckIns = async () => {
    setIsCheckInsLoading(true)
    try {
      const result = await getCheckIns(checkInsPage, checkInsPageSize)
      setCheckInsData(result.data || [])
      setTotalCheckIns(result.pagination?.total || 0)
      setTotalCheckInsPages(result.pagination?.totalPages || 1)
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load check-ins", variant: "destructive" })
    } finally {
      setIsCheckInsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "checkins") {
      setUnreadCheckInsCount(0)
      loadCheckIns()
    }
  }, [checkInsPage, activeTab])


  // --- ACTION HANDLERS ---
  const handleSignOut = () => {
    localStorage.removeItem("token")
    router.push("/")
  }

  const handleCreateMember = async () => {
    setCreateError(null)

    if (!newMemberForm.firstName || !newMemberForm.lastName || !newMemberForm.email) {
      setCreateError("All fields are required")
      return
    }

    setIsCreating(true)
    try {
      await createMember(newMemberForm)
      toast({ title: "Member created", description: "New member has been added successfully." })
      setCreateDialogOpen(false)
      // Reset wird jetzt vom useEffect erledigt
      setMembersPage(1)
      loadMembers()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create member"
      setCreateError(errorMessage) 
    } finally {
      setIsCreating(false)
    }
  }

  // Handle Edit Click
  const handleEditClick = (member: Member) => {
    setEditMemberForm({
      id: member._id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      blocked: member.blocked || false
    })
    setEditDialogOpen(true)
  }

  // Handle Update Logic
  const handleUpdateMember = async () => {
     if (!editMemberForm.firstName || !editMemberForm.lastName || !editMemberForm.email) {
      toast({ title: "Validation error", description: "All fields are required", variant: "destructive" })
      return
    }
    setIsUpdating(true)
    try {
      await updateMember(editMemberForm.id, {
        firstName: editMemberForm.firstName,
        lastName: editMemberForm.lastName,
        email: editMemberForm.email,
        blocked: editMemberForm.blocked
      })
      toast({ title: "Member updated", description: "Member details have been updated." })
      setEditDialogOpen(false)
      loadMembers()
    } catch (error) {
      toast({ title: "Error", description: "Failed to update member", variant: "destructive" })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleResetQrCode = async (memberId: string) => {
    try {
      await resetQrCode(memberId)
      toast({ title: "QR Code reset", description: "Member QR code has been regenerated." })
      loadMembers()
    } catch (error) {
      toast({ title: "Error", description: "Failed to reset QR code", variant: "destructive" })
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
      toast({ title: "Export complete", description: "Members data has been exported to CSV." })
    } catch (error) {
      toast({ title: "Error", description: "Failed to export CSV", variant: "destructive" })
    }
  }

  const handleImportCSV = async () => {
    if (!csvFile) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        const lines = content.trim().split("\n")
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
        let imported = 0
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
          const row: Record<string, string> = {}
          headers.forEach((header, index) => { row[header] = values[index] || "" })
          if (row.firstname && row.lastname && row.email) {
            await createMember({ firstName: row.firstname, lastName: row.lastname, email: row.email })
            imported++
          }
        }
        toast({ title: "Import complete", description: `Imported ${imported} members.` })
        setImportDialogOpen(false)
        setCsvFile(null)
        setMembersPage(1)
        loadMembers()
      } catch (error) {
        toast({ title: "Error", description: "Failed to import CSV", variant: "destructive" })
      }
    }
    reader.readAsText(csvFile)
  }

  const handleViewMember = (member: Member) => { setSelectedMember(member); setDetailsDrawerOpen(true) }
  
  const handlePrintQR = (member: Member) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(member.qrUuid)}`
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>QR Code</title></head>
      <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
        <h1>${member.firstName} ${member.lastName}</h1>
        <img src="${qrCodeUrl}" style="width:300px;height:300px;margin:20px;" />
        <p>${member.email}</p>
        <script>window.onload = () => window.print();</script>
      </body></html>
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
          </div>

          {/* Stats Cards */}
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
                <div className="text-2xl font-bold text-green-600">{membersData.filter(m => !m.blocked).length}</div>
              </CardContent>
            </Card>
            <Card className="border-red-200 sm:col-span-2 lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blocked</CardTitle>
                <Users className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{membersData.filter(m => m.blocked).length}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="checkins">
                Recent Check-ins
                {unreadCheckInsCount > 0 && (
                  <Badge className="ml-2 bg-red-500 text-white hover:bg-red-600">{unreadCheckInsCount}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* --- MEMBERS TAB --- */}
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
                        <UserPlus className="mr-2 h-4 w-4" /> Add Member
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportCSV}>
                        <Download className="mr-2 h-4 w-4" /> Export
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" /> Import
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
                          onChange={(e) => { setSearchQuery(e.target.value); setMembersPage(1) }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <select
                          id="status"
                          value={blockedFilter}
                          onChange={(e) => { setBlockedFilter(e.target.value as any); setMembersPage(1) }}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="all">All Members</option>
                          <option value="active">Active</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Members Table */}
                  {isMembersLoading ? (
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
                              <TableCell className="font-medium">{member.firstName} {member.lastName}</TableCell>
                              <TableCell className="hidden sm:table-cell">{member.email}</TableCell>
                              <TableCell className="hidden md:table-cell">{new Date(member.createdAt).toLocaleDateString()}</TableCell>
                              <TableCell>
                                {member.blocked ? <Badge variant="destructive">Blocked</Badge> : 
                                 member.emailValid ? <Badge className="bg-green-600">Active</Badge> : 
                                 <Badge variant="secondary">Pending</Badge>}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => handleViewMember(member)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handlePrintQR(member)}>
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleEditClick(member)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {membersData.length === 0 && (
                            <TableRow><TableCell colSpan={5} className="text-center py-8">No members found</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Pagination */}
                  {totalMembersPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {membersPage} of {totalMembersPages} ({totalMembers} members)
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setMembersPage(p => Math.max(1, p - 1))} disabled={membersPage === 1}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setMembersPage(p => Math.min(totalMembersPages, p + 1))} disabled={membersPage === totalMembersPages}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- CHECK-INS TAB --- */}
            <TabsContent value="checkins" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent Check-ins</CardTitle>
                    <CardDescription>Real-time log of member access</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {isCheckInsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">Loading check-ins...</div>
                    </div>
                  ) : checkInsData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No recent check-ins found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {checkInsData.map((checkIn: CheckInEvent, index) => {
                        const hasWarning = checkIn.warning;
                        const warningMessage = checkIn.warning;

                        return (
                          <div
                            key={index}
                            className={`flex items-center justify-between rounded-lg border p-4 ${
                              hasWarning ? "border-red-300 bg-red-50" : "border-border bg-background"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                  hasWarning ? "bg-red-600" : "bg-primary"
                                } text-white`}>
                                {hasWarning ? "⚠" : "✓"}
                              </div>
                              <div>
                                <p className="font-semibold">
                                  {checkIn.member ? `${checkIn.member.firstName} ${checkIn.member.lastName}` : "Unknown Member"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {checkIn.member?.email || "No email"}
                                </p>
                                {warningMessage && (
                                  <p className="text-sm text-red-600 font-medium mt-1">{warningMessage}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">
                                {new Date(checkIn.timestamp|| Date.now()).toLocaleTimeString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(checkIn.timestamp || Date.now()).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {checkInsPage} of {totalCheckInsPages} ({totalCheckIns} check ins)
                    </p>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setCheckInsPage(p => Math.max(1, p - 1))} 
                            disabled={checkInsPage === 1 || isCheckInsLoading}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setCheckInsPage(p => Math.min(totalCheckInsPages, p + 1))} 
                            disabled={checkInsPage === totalCheckInsPages || isCheckInsLoading}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                  </div>
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

            {/* Send Email Toggle */}
            <div className="flex items-center space-x-2 pt-2">
              <Switch 
                id="send-email" 
                checked={newMemberForm.sendEmail}
                onCheckedChange={(checked) => setNewMemberForm({...newMemberForm, sendEmail: checked})}
              />
              <Label htmlFor="send-email" className="font-normal cursor-pointer">
                Send email with QR-code
              </Label>
            </div>

            {/* Error Message Display */}
            {createError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 mt-2">
                <p className="text-sm text-destructive font-medium flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {createError}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateMember} disabled={isCreating}>{isCreating ? "Creating..." : "Create Member"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>Update member details and status</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-firstName">First Name</Label>
              <Input
                id="edit-firstName"
                value={editMemberForm.firstName}
                onChange={(e) => setEditMemberForm({ ...editMemberForm, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lastName">Last Name</Label>
              <Input
                id="edit-lastName"
                value={editMemberForm.lastName}
                onChange={(e) => setEditMemberForm({ ...editMemberForm, lastName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                value={editMemberForm.email}
                onChange={(e) => setEditMemberForm({ ...editMemberForm, email: e.target.value })}
              />
            </div>
            
            {/* Status Radio Buttons */}
            <div className="space-y-3 pt-2">
              <Label>Status</Label>
              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="status-active"
                    name="status"
                    className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                    checked={!editMemberForm.blocked}
                    onChange={() => setEditMemberForm({ ...editMemberForm, blocked: false })}
                  />
                  <Label htmlFor="status-active" className="font-normal cursor-pointer">Active</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="status-blocked"
                    name="status"
                    className="h-4 w-4 border-gray-300 text-red-600 focus:ring-red-600"
                    checked={editMemberForm.blocked}
                    onChange={() => setEditMemberForm({ ...editMemberForm, blocked: true })}
                  />
                  <Label htmlFor="status-blocked" className="font-normal cursor-pointer text-red-600">Blocked</Label>
                </div>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateMember} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
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
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleImportCSV} disabled={!csvFile}>Import</Button>
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
                    <div className="flex justify-between"><span className="text-muted-foreground">Name:</span><span className="font-medium">{selectedMember.firstName} {selectedMember.lastName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="font-medium">{selectedMember.email}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">ID:</span><span className="font-mono text-xs">{selectedMember._id}</span></div>
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
                </Card>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => handlePrintQR(selectedMember)} className="w-full"><Printer className="mr-2 h-4 w-4" /> Print QR</Button>
                <Button variant="outline" onClick={() => handleResetQrCode(selectedMember._id)} className="w-full"><RotateCcw className="mr-2 h-4 w-4" /> Reset QR</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}