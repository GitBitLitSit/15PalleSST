export interface Member {
  _id: string
  firstName: string
  lastName: string
  email: string
  createdAt: string // ISO Date string
  blocked: boolean
  qrUuid: string
  emailValid: boolean
}

export interface CheckInEvent {
  type: "NEW_CHECKIN"
  member: Member
  warning?: string | null
  timestamp: string
}

export interface DashboardStats {
  total: number
  blocked: number
}

export interface AuthUser {
  id: string
  email: string
  role: "customer" | "owner"
  name: string
}
