"use client"

import * as React from "react"
import Link from "next/link"

type ApplicationStatus = "SUBMITTED" | "REVIEWING" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED"

const STATUSES: ApplicationStatus[] = ["SUBMITTED","REVIEWING","INTERVIEW","OFFER","HIRED","REJECTED"]

type Candidate = {
  id: string
  name: string | null
  email: string
  resumeUrl: string | null
  frontend: string[]
  backend: string[]
  cloud: string[]
  database: string[]
}

type Application = {
  id: string
  status: ApplicationStatus
  createdAt: string
  candidate: Candidate
}

export default function KanbanBoard({
  jobId,
  initialApplications,
}: {
  jobId: string
  initialApplications: Application[]
}) {
  const [apps, setApps] = React.useState<Application[]>(initialApplications)
  const [loadingId, setLoadingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const grouped = React.useMemo(() => {
    const map: Record<ApplicationStatus, Application[]> = {
      SUBMITTED: [], REVIEWING: [], INTERVIEW: [], OFFER: [], HIRED: [], REJECTED: []
    }
    for (const a of apps) map[a.status].push(a)
    return map
  }, [apps])

  async function move(appId: string, to: ApplicationStatus) {
    setLoadingId(appId)
    setError(null)
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `Error ${res.status}`)
      }
      const updated = await res.json()
      setApps(prev => prev.map(a => (a.id === appId ? { ...a, status: updated.status } : a)))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingId(null)
    }
  }

  async function refresh() {
    setError(null)
    const url = new URL(`/api/applications`, window.location.origin)
    url.searchParams.set("jobId", jobId)
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j?.error || `Error ${res.status}`)
      return
    }
    const data = await res.json()
    setApps(data)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={refresh} className="px-3 py-1 rounded bg-gray-100 border">
          Refrescar
        </button>
        {error && <span className="text-sm text-red-600">⚠ {error}</span>}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${STATUSES.length}, minmax(220px, 1fr))` }}>
        {STATUSES.map((status) => (
          <div key={status} className="rounded-2xl border bg-white">
            <div className="sticky top-0 p-3 border-b bg-gray-50 font-semibold text-sm">
              {status} <span className="text-gray-500">({grouped[status].length})</span>
            </div>
            <div className="p-3 space-y-3">
              {grouped[status].map(app => (
                <AppCard
                  key={app.id}
                  app={app}
                  jobId={jobId}
                  onMove={move}
                  loading={loadingId === app.id}
                />
              ))}
              {grouped[status].length === 0 && (
                <div className="text-xs text-gray-400 border border-dashed rounded p-3 text-center">
                  Sin candidatos
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AppCard({
  app,
  jobId,
  onMove,
  loading,
}: {
  app: Application
  jobId: string
  onMove: (id: string, to: ApplicationStatus) => Promise<void>
  loading: boolean
}) {
  const skills = [
    ...(app.candidate.frontend || []),
    ...(app.candidate.backend || []),
    ...(app.candidate.cloud || []),
    ...(app.candidate.database || []),
  ].slice(0, 6)

  const candidateHref = `/dashboard/candidates/${app.candidate.id}?jobId=${jobId}&applicationId=${app.id}`

  return (
    <div className="rounded-xl border p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">
          <Link
            href={candidateHref}
            className="underline underline-offset-2 hover:opacity-80"
            title="Ver detalle del candidato"
          >
            {app.candidate.name || "Sin nombre"}
          </Link>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border">{app.status}</span>
      </div>
      <div className="text-xs text-gray-500 truncate">{app.candidate.email}</div>

      {skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {skills.map((s, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-gray-50 border">{s}</span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1">
        {(["REVIEWING","INTERVIEW","OFFER","HIRED","REJECTED"] as ApplicationStatus[])
          .filter(to => to !== app.status)
          .map(to => (
            <button
              key={to}
              disabled={loading}
              onClick={() => onMove(app.id, to)}
              className="text-[11px] px-2 py-1 rounded border bg-gray-50 hover:bg-gray-100 disabled:opacity-50"
              title={`Mover a ${to}`}
            >
              → {to}
            </button>
          ))}
      </div>
    </div>
  )
}
