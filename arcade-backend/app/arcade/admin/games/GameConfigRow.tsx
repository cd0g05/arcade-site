'use client';

import { useState, useTransition } from 'react';
import { updateGameConfigAction } from '../actions';

/** Per-game token cost + default top-score award editing (tasks.md id:66, FR-4.1). */
export function GameConfigRow({
  gameId,
  displayName,
  tier,
  tokenCost,
  defaultTopScoreAward,
}: {
  gameId: string;
  displayName: string;
  tier: string;
  tokenCost: number;
  defaultTopScoreAward: number;
}) {
  const [cost, setCost] = useState(String(tokenCost));
  const [award, setAward] = useState(String(defaultTopScoreAward));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  // An emptied field must not count as changed: Number('') is 0, which would let a blank
  // input silently save a cost of zero.
  const filled = cost.trim() !== '' && award.trim() !== '';
  const dirty =
    filled && (Number(cost) !== tokenCost || Number(award) !== defaultTopScoreAward);

  return (
    <tr>
      <td>{displayName}</td>
      <td>{tier}</td>
      <td>
        <input
          type="number"
          aria-label={`Token cost for ${displayName}`}
          value={cost}
          onChange={(e) => {
            setCost(e.target.value);
            setSaved(false);
          }}
          style={{ width: '4rem' }}
        />
      </td>
      <td>
        <input
          type="number"
          aria-label={`Default top score award for ${displayName}`}
          value={award}
          onChange={(e) => {
            setAward(e.target.value);
            setSaved(false);
          }}
          style={{ width: '4rem' }}
        />
      </td>
      <td>
        <button
          className="btn"
          disabled={pending || !dirty}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await updateGameConfigAction({
                gameId,
                tokenCost: Number(cost),
                defaultTopScoreAward: Number(award),
              });
              if (result.ok) {
                setSaved(true);
              } else {
                setError(result.error ?? 'Could not save.');
              }
            })
          }
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {saved ? <span className="badge badge-active">Saved</span> : null}
        {error ? (
          <span className="error" role="alert">
            {error}
          </span>
        ) : null}
      </td>
    </tr>
  );
}
