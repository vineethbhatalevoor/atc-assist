import { useState } from 'react'
import { postJSON } from '../api/client'
import { useStore } from '../state/store'
import Badge from '../components/Badge'
import type { RunwayState, RunwayClaim, RwConflict } from '../state/types'

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | undefined> = {
  FREE: 'ok',
  ARRIVAL_IMMINENT: 'warn',
  OCCUPIED: 'bad',
  CLEARING: 'warn',
  CLOSED: 'bad',
}

function fmtTime(epoch: number) {
  return new Date(epoch * 1000).toISOString().slice(11, 19) + 'Z'
}

function ClaimRow({ c }: { c: RunwayClaim }) {
  const select = useStore((s) => s.select)
  const tone = c.kind === 'ARR' ? 'ok' : 'warn'
  return (
    <tr style={{ cursor: 'pointer' }} onClick={() => select(c.hex)}>
      <td><Badge text={c.kind} tone={tone} /></td>
      <td><strong>{c.cs || c.hex}</strong></td>
      <td>{fmtTime(c.start)}</td>
      <td>{fmtTime(c.end)}</td>
      <td>{Math.round(c.conf * 100)}%</td>
      <td>
        {c.pred && <Badge text="PRED" />}
        {c.on && <Badge text="ON RWY" tone="bad" />}
      </td>
    </tr>
  )
}

function RunwayCard({ rwy, conflicts }: { rwy: RunwayState; conflicts: RwConflict[] }) {
  const [busy, setBusy] = useState(false)

  const toggle = () => {
    setBusy(true)
    postJSON('/api/runways/closure', { id: rwy.id, closed: !rwy.closed })
      .catch(() => {})
      .finally(() => setBusy(false))
  }

  const myConflicts = conflicts.filter((c) => c.runway === rwy.id)

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <strong style={{ fontSize: '1.05em' }}>{rwy.id}</strong>
        <Badge text={rwy.status} tone={STATUS_TONE[rwy.status]} />
        {rwy.closed && <Badge text="CLOSED" tone="bad" />}
        <button
          style={{ marginLeft: 'auto', fontSize: '0.75em' }}
          onClick={toggle}
          disabled={busy}
        >
          {rwy.closed ? 'OPEN RUNWAY' : 'CLOSE RUNWAY'}
        </button>
      </div>

      {myConflicts.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          {myConflicts.map((c) => (
            <div key={`${c.a}-${c.b}`} className="small" style={{ color: 'var(--c-bad)' }}>
              ⚠ RWY CONFLICT: {c.ca} / {c.cb} — overlap {Math.round(c.overlap)}s
              in {Math.round(c.t)}s · <Badge text={c.sev} tone="bad" />
            </div>
          ))}
        </div>
      )}

      {rwy.claims.length === 0 ? (
        <div className="small dim">No active claims.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>KIND</th>
              <th>C/S</th>
              <th>FROM</th>
              <th>TO</th>
              <th>CONF</th>
              <th>FLAGS</th>
            </tr>
          </thead>
          <tbody>
            {rwy.claims.map((c) => (
              <ClaimRow key={c.hex + c.kind} c={c} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function RunwayPanel() {
  const ops = useStore((s) => s.ops)

  if (!ops) return <div className="detail dim">Waiting for data…</div>

  const { runways, rw_conflicts } = ops

  if (!runways || runways.length === 0)
    return (
      <div className="detail">
        <h3>RUNWAY STATUS</h3>
        <div className="small dim">No runway data yet.</div>
      </div>
    )

  return (
    <div className="detail">
      <h3>RUNWAY STATUS</h3>
      {rw_conflicts.length > 0 && (
        <div className="small" style={{ marginBottom: 8, color: 'var(--c-bad)' }}>
          ⚠ {rw_conflicts.length} runway conflict{rw_conflicts.length > 1 ? 's' : ''} detected
        </div>
      )}
      {runways.map((rwy) => (
        <RunwayCard key={rwy.id} rwy={rwy} conflicts={rw_conflicts} />
      ))}
    </div>
  )
}
