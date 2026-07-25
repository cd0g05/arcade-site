'use client';

import { useState, useTransition } from 'react';
import {
  createAchievementAction,
  deactivateAchievementAction,
  updateAchievementAction,
} from '../actions';

export interface AchievementRow {
  id: string;
  gameId: string;
  mode: 'threshold' | 'interval_gap';
  value: number;
  award: number;
  active: boolean;
}

/** Empty-state copy is fixed by the UX Copy & Tone table (tasks.md id:65). */
export const EMPTY_COPY = 'No achievements configured for this game yet.';

function ModeLabel({ mode }: { mode: AchievementRow['mode'] }) {
  return <span>{mode === 'threshold' ? 'Threshold' : 'Interval-Gap'}</span>;
}

/**
 * Per-game criteria-row CRUD (tasks.md id:64, UX Flow 2).
 *
 * Rows apply live with no redeploy — not because of anything here, but because
 * `lib/achievements.ts` reads the `achievements` table on every score submission.
 */
export function AchievementBuilder({
  gameId,
  initialRows,
}: {
  gameId: string;
  initialRows: AchievementRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    mode: 'threshold' as AchievementRow['mode'],
    value: '',
    award: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activeRows = rows.filter((r) => r.active);

  const submitDraft = () => {
    setError(null);
    const value = Number(draft.value);
    const award = Number(draft.award);

    startTransition(async () => {
      const result = await createAchievementAction({
        gameId,
        mode: draft.mode,
        value,
        award,
      });

      if (!result.ok) {
        setError(result.error ?? 'Could not save.');
        return;
      }

      // Optimistically appended so the row shows "immediately" per UX Flow 2 step 3.
      // revalidatePath() in the action refreshes the server-rendered list behind it, at
      // which point this local copy is replaced with the persisted one.
      setRows((prev) => [
        ...prev,
        { id: `pending-${Date.now()}`, gameId, mode: draft.mode, value, award, active: true },
      ]);
      setDraft({ mode: 'threshold', value: '', award: '' });
      setAdding(false);
    });
  };

  const toggleActive = (row: AchievementRow, active: boolean) => {
    setError(null);
    setSavingId(row.id);
    startTransition(async () => {
      const result = active
        ? await updateAchievementAction({
            id: row.id,
            value: row.value,
            award: row.award,
            active: true,
          })
        : await deactivateAchievementAction(row.id);

      setSavingId(null);
      if (!result.ok) {
        // "Row reverts to prior saved state" — UX Achievement Builder Save error state.
        setError(result.error ?? 'Could not save.');
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, active } : r)),
      );
    });
  };

  return (
    <div>
      {activeRows.length === 0 && !adding ? (
        <p className="empty">{EMPTY_COPY}</p>
      ) : (
        <div>
          {activeRows.map((row) => (
            <div
              key={row.id}
              className={`criteria-row${savingId === row.id ? ' saving' : ''}`}
              data-testid="criteria-row"
            >
              <ModeLabel mode={row.mode} />
              <span>
                {row.mode === 'threshold' ? 'at' : 'every'} {row.value}
              </span>
              <span>&rarr; +{row.award} tokens</span>
              <span className="badge badge-active">Active</span>
              <button
                className="btn"
                // Optimistically-appended rows carry a placeholder id until the server
                // refresh replaces them; deactivating one would send that placeholder and
                // fail uuid validation, so it waits rather than showing a spurious error.
                disabled={savingId === row.id || row.id.startsWith('pending-')}
                onClick={() => toggleActive(row, false)}
              >
                Deactivate
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="criteria-row">
          <select
            aria-label="Mode"
            value={draft.mode}
            onChange={(e) =>
              setDraft((d) => ({ ...d, mode: e.target.value as AchievementRow['mode'] }))
            }
          >
            <option value="threshold">Threshold</option>
            <option value="interval_gap">Interval-Gap</option>
          </select>
          <input
            type="number"
            aria-label={draft.mode === 'threshold' ? 'Threshold score' : 'Gap amount'}
            placeholder={draft.mode === 'threshold' ? 'Score' : 'Gap'}
            value={draft.value}
            onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
          />
          <input
            type="number"
            aria-label="Award amount"
            placeholder="Award"
            value={draft.award}
            onChange={(e) => setDraft((d) => ({ ...d, award: e.target.value }))}
          />
          <button className="btn btn-primary" disabled={pending} onClick={submitDraft}>
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            className="btn"
            disabled={pending}
            onClick={() => {
              setAdding(false);
              setError(null);
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + Add criteria
        </button>
      )}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
