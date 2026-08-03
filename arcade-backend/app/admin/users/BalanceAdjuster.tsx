'use client';

import { useState, useTransition } from 'react';
import { adjustBalanceAction } from '../actions';

/**
 * The "Adjust balance" inline edit + confirm flow (tasks.md id:63, UX Flow 3).
 *
 * Three states rather than two: idle -> editing (input pre-filled with the current
 * balance) -> confirming ("Confirm: {old} -> {new}?"). The confirm step is a deliberate
 * speed bump — this writes a real ledger transaction, and a typo'd balance cannot be
 * undone except by another adjustment.
 */
export function BalanceAdjuster({
  userId,
  balance,
}: {
  userId: string;
  balance: number;
}) {
  const [mode, setMode] = useState<'idle' | 'editing' | 'confirming'>('idle');
  const [value, setValue] = useState(String(balance));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setMode('idle');
    setValue(String(balance));
    setError(null);
  };

  if (mode === 'idle') {
    return (
      <button
        className="btn"
        onClick={() => {
          setValue(String(balance));
          setMode('editing');
        }}
      >
        Adjust balance
      </button>
    );
  }

  const parsed = Number(value);
  const valid = Number.isInteger(parsed);

  return (
    <div className="adjust-row" aria-label="Balance adjustment in progress">
      {mode === 'editing' ? (
        <>
          <span>{balance} &rarr;</span>
          <input
            type="number"
            aria-label="New balance"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={!valid}
            onClick={() => setMode('confirming')}
          >
            Review
          </button>
          <button className="btn" onClick={reset}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <span>
            Confirm: {balance} &rarr; {parsed}?
          </span>
          <button
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await adjustBalanceAction({
                  userId,
                  newBalance: parsed,
                });
                if (result.ok) {
                  reset();
                } else {
                  setError(result.error ?? 'Could not adjust balance.');
                  setMode('editing');
                }
              })
            }
          >
            {pending ? 'Saving…' : 'Confirm'}
          </button>
          <button className="btn" disabled={pending} onClick={reset}>
            Cancel
          </button>
        </>
      )}
      {error ? (
        <span className="error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
