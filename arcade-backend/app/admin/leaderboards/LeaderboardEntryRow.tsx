'use client';

import { useState, useTransition } from 'react';
import {
  deleteLeaderboardEntryAction,
  updateLeaderboardEntryAction,
} from '../actions';

/**
 * One daily-leaderboard entry, editable and deletable (tasks.md id:67).
 *
 * Delete confirms inline for the same reason the balance edit does: an entry may already
 * have paid a participation award and contributed to a settled day, and neither is undone
 * by removing the row.
 */
export function LeaderboardEntryRow({
  id,
  gameId,
  gameDate,
  displayName,
  score,
  submittedVia,
}: {
  id: string;
  gameId: string;
  gameDate: string;
  displayName: string;
  score: number;
  submittedVia: string;
}) {
  const [value, setValue] = useState(String(score));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (removed) return null;

  return (
    <tr>
      <td>{gameDate}</td>
      <td>{gameId}</td>
      <td>{displayName}</td>
      <td>
        <input
          type="number"
          aria-label={`Score for ${displayName} on ${gameDate}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: '5rem' }}
        />
      </td>
      <td>{submittedVia}</td>
      <td>
        <button
          className="btn"
          disabled={pending || Number(value) === score}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await updateLeaderboardEntryAction({
                id,
                score: Number(value),
              });
              if (!result.ok) setError(result.error ?? 'Could not save.');
            })
          }
        >
          Save
        </button>{' '}
        {confirmingDelete ? (
          <>
            <span>Delete?</span>{' '}
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteLeaderboardEntryAction(id);
                  if (result.ok) setRemoved(true);
                  else setError(result.error ?? 'Could not delete.');
                })
              }
            >
              Confirm
            </button>{' '}
            <button className="btn" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => setConfirmingDelete(true)}>
            Delete
          </button>
        )}
        {error ? (
          <span className="error" role="alert">
            {error}
          </span>
        ) : null}
      </td>
    </tr>
  );
}
