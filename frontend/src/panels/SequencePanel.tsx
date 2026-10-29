import { useStore } from '../state/store'
import Badge from '../components/Badge'
import type { SeqEntry } from '../state/types'

function fmtEta(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function wakeBadge(w: string) {
  const tone = w === 'H' || w === 'J' ? 'bad' : w === 'M' ? 'warn' : 'ok'
  return <Badge text={w} tone={tone} />
}

function EntryRow({ e, idx }: { e: SeqEntry; idx: number }) {
  const select = useStore((s) => s.select)
  return (
    <tr
      className={e.frozen ? 'sel' : ''}
      style={{ cursor: 'pointer' }}
      onClick={() => select(e.hex)}
    >
      <td>{idx + 1}</td>
      <td><strong>{e.cs || e.hex}</strong></td>
      <td>{e.type ?? '?'}</td>
      <td>{wakeBadge(e.wake)}</td>
      <td>{e.rwy}</td>
      <td>{fmtEta(e.eta_in)}</td>
      <td>{e.delay > 0 ? `+${Math.round(e.delay)}s` : '—'}</td>
      <td>
        {e.frozen && <Badge text="FRZ" tone="warn" />}
        {e.ga && <Badge text="GA" tone="bad" />}
        {e.late && <Badge text="LATE" tone="bad" />}
      </td>
    </tr>
  )
}

export default function SequencePanel() {
  const ops = useStore((s) => s.ops)
  const seq = ops?.sequence ?? null

  if (!ops) return <div className="detail dim">Waiting for data…</div>
  if (!seq || seq.entries.length === 0)
    return (
      <div className="detail">
        <h3>ARRIVAL SEQUENCE</h3>
        <div className="small dim">No arrivals sequenced yet.</div>
        {seq?.closed?.length ? (
          <div className="small dim">Closed runways: {seq.closed.join(', ')}</div>
        ) : null}
      </div>
    )

  const m = seq.metrics
  return (
    <div className="detail">
      <h3>ARRIVAL SEQUENCE</h3>
      <div className="small dim" style={{ marginBottom: 6 }}>
        Solver: {seq.solver} · {seq.solve_ms} ms
        {seq.optimal ? '' : ' · SUB-OPTIMAL'}
        {seq.generated_at
          ? ` · ${new Date(seq.generated_at * 1000).toISOString().slice(11, 19)}Z`
          : ''}
      </div>

      {m && (
        <div className="small" style={{ marginBottom: 8 }}>
          <span style={{ marginRight: 12 }}>
            Delay: <strong>{Math.round(m.total)}s</strong>
            <span className="dim"> (FCFS {Math.round(m.fcfs_total)}s)</span>
          </span>
          <span style={{ marginRight: 12 }}>
            Max: <strong>{Math.round(m.max)}s</strong>
            <span className="dim"> (FCFS {Math.round(m.fcfs_max)}s)</span>
          </span>
          <span>
            Waiting: <strong>{m.w}</strong>
            <span className="dim"> (FCFS {m.fcfs_w})</span>
          </span>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>C/S</th>
            <th>TYPE</th>
            <th>WAKE</th>
            <th>RWY</th>
            <th>ETA</th>
            <th>DELAY</th>
            <th>FLAGS</th>
          </tr>
        </thead>
        <tbody>
          {seq.entries.map((e, i) => (
            <EntryRow key={e.hex} e={e} idx={i} />
          ))}
        </tbody>
      </table>

      {seq.closed.length > 0 && (
        <div className="small dim" style={{ marginTop: 6 }}>
          Closed: {seq.closed.join(', ')}
        </div>
      )}
    </div>
  )
}
