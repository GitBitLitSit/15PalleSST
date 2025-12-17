const API_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_URL) {
  console.error("API URL is missing! Check your .env or SST output.")
}

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function loginAdmin(credentials: { username: string; password: string }) {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  })
  return handleResponse(res)
}

export async function createMember(data: { firstName: string; lastName: string; email: string }) {
  const res = await fetch(`${API_URL}/members`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function getMembers(page = 1, search = "", blocked = false, limit = "20") {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit,
    ...(search && { search }),
    ...(blocked && { blocked: "true" }),
  })

  const res = await fetch(`${API_URL}/members?${params}`, {
    method: "GET",
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function resetQrCode(memberId: string) {
  const res = await fetch(`${API_URL}/members/reset-qrcode`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ id: memberId }),
  })
  return handleResponse(res)
}

export async function requestVerificationCode(email: string) {
  const res = await fetch(`${API_URL}/auth/request-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  return handleResponse(res)
}

export async function verifyAndRecover(data: {
  email: string
  verificationCode: string
  deliveryMethod: "email" | "display"
}) {
  const res = await fetch(`${API_URL}/members/recover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function getCheckIns(page = 1, limit = 50) {
  const token = localStorage.getItem("token")
  const res = await fetch(`${API_URL}/auth/check-ins?page=${page}&limit=${limit}`, {
    method: "GET",
    headers: getAuthHeaders(),
  })

  return handleResponse(res)
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP Error: ${res.status}`)
  }

  return res.json()
}
