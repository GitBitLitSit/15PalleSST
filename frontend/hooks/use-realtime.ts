"use client"

import { useEffect, useRef, useState } from "react"
import type { CheckInEvent } from "@/lib/types"

export function useRealtimeCheckIns(onCheckIn: (event: CheckInEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_API_URL

    if (!wsUrl) {
      console.error("WebSocket URL is missing")
      return
    }

    // Prevent multiple connections
    if (wsRef.current) return;

    console.log("Connecting to Realtime API...");
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log("✓ WebSocket Connected")
      setIsConnected(true)
      setError(null)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "NEW_CHECKIN") {
          onCheckIn(data)
        }
      } catch (err) {
        console.error("Parse error:", err)
      }
    }

    ws.onerror = (e) => {
      // Only log error if the socket is actually trying to stay open
      if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
          console.error("WebSocket Error:", e);
          setError("Connection Error");
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      wsRef.current = null;
    }

    // Cleanup function
    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        // We set a flag or just close it quietly
        ws.close()
      }
      wsRef.current = null;
    }
  }, [onCheckIn])

  return { isConnected, error }
}