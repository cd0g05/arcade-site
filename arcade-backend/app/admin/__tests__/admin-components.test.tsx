/**
 * @vitest-environment jsdom
 *
 * Component tests for the two admin interactions with real consequences (tasks.md id:70):
 * the balance-edit confirm flow, which writes a ledger transaction, and the achievement
 * builder's empty/populated states, whose empty copy is fixed by the UX Copy & Tone table.
 *
 * Server actions are mocked — they are exercised for real against Postgres by the route
 * and lib suites. What is under test here is the client-side gating: that a write cannot
 * happen without passing through the confirm step, and that the right copy renders.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const adjustBalanceAction = vi.fn();
const createAchievementAction = vi.fn();
const deactivateAchievementAction = vi.fn();
const updateAchievementAction = vi.fn();

vi.mock('../actions', () => ({
  adjustBalanceAction: (...args: unknown[]) => adjustBalanceAction(...args),
  createAchievementAction: (...args: unknown[]) => createAchievementAction(...args),
  deactivateAchievementAction: (...args: unknown[]) => deactivateAchievementAction(...args),
  updateAchievementAction: (...args: unknown[]) => updateAchievementAction(...args),
}));

const { BalanceAdjuster } = await import('../users/BalanceAdjuster');
const { AchievementBuilder, EMPTY_COPY } = await import('../games/AchievementBuilder');

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  adjustBalanceAction.mockResolvedValue({ ok: true });
  createAchievementAction.mockResolvedValue({ ok: true });
  deactivateAchievementAction.mockResolvedValue({ ok: true });
  updateAchievementAction.mockResolvedValue({ ok: true });
});

describe('BalanceAdjuster (id:63, UX Flow 3)', () => {
  const props = { userId: '11111111-1111-4111-8111-111111111111', balance: 40 };

  it('requires the confirm step before writing — the UX flow 40 -> 55', async () => {
    const user = userEvent.setup();
    render(<BalanceAdjuster {...props} />);

    await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

    const input = screen.getByLabelText('New balance');
    await user.clear(input);
    await user.type(input, '55');
    await user.click(screen.getByRole('button', { name: 'Review' }));

    // The exact confirm copy from UX Flow 3 step 3.
    expect(screen.getByText('Confirm: 40 → 55?')).toBeInTheDocument();
    // Nothing written yet — this is the whole point of the confirm step.
    expect(adjustBalanceAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(adjustBalanceAction).toHaveBeenCalledWith({
      userId: props.userId,
      newBalance: 55,
    });
  });

  it('writes nothing when the confirm step is cancelled', async () => {
    const user = userEvent.setup();
    render(<BalanceAdjuster {...props} />);

    await user.click(screen.getByRole('button', { name: 'Adjust balance' }));
    const input = screen.getByLabelText('New balance');
    await user.clear(input);
    await user.type(input, '9999');
    await user.click(screen.getByRole('button', { name: 'Review' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(adjustBalanceAction).not.toHaveBeenCalled();
    // Back to idle, with the field reset rather than holding the abandoned value.
    expect(screen.getByRole('button', { name: 'Adjust balance' })).toBeInTheDocument();
  });

  it('surfaces a failed adjustment inline and returns to editing', async () => {
    adjustBalanceAction.mockResolvedValue({ ok: false, error: 'User not found.' });
    const user = userEvent.setup();
    render(<BalanceAdjuster {...props} />);

    await user.click(screen.getByRole('button', { name: 'Adjust balance' }));
    await user.click(screen.getByRole('button', { name: 'Review' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('User not found.');
    expect(screen.getByLabelText('New balance')).toBeInTheDocument();
  });
});

describe('AchievementBuilder (ids 64-65, UX Flow 2)', () => {
  it('renders the exact empty-state copy when a game has no criteria', () => {
    render(<AchievementBuilder gameId="dino-run" initialRows={[]} />);

    expect(screen.getByText(EMPTY_COPY)).toBeInTheDocument();
    expect(EMPTY_COPY).toBe('No achievements configured for this game yet.');
    expect(screen.queryAllByTestId('criteria-row')).toHaveLength(0);
  });

  it('renders configured criteria rows instead of the empty state', () => {
    render(
      <AchievementBuilder
        gameId="dino-run"
        initialRows={[
          {
            id: '22222222-2222-4222-8222-222222222222',
            gameId: 'dino-run',
            mode: 'threshold',
            value: 1000,
            award: 25,
            active: true,
          },
          {
            id: '33333333-3333-4333-8333-333333333333',
            gameId: 'dino-run',
            mode: 'interval_gap',
            value: 100,
            award: 5,
            active: true,
          },
        ]}
      />,
    );

    expect(screen.queryByText(EMPTY_COPY)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('criteria-row')).toHaveLength(2);
    expect(screen.getByText('Threshold')).toBeInTheDocument();
    expect(screen.getByText('Interval-Gap')).toBeInTheDocument();
    expect(screen.getByText('→ +25 tokens')).toBeInTheDocument();
  });

  it('treats a deactivated criteria row as empty, not as a row', () => {
    render(
      <AchievementBuilder
        gameId="dino-run"
        initialRows={[
          {
            id: '44444444-4444-4444-8444-444444444444',
            gameId: 'dino-run',
            mode: 'threshold',
            value: 1000,
            award: 25,
            active: false,
          },
        ]}
      />,
    );

    // Deactivated rows are history, not configuration — the builder should read as empty.
    expect(screen.getByText(EMPTY_COPY)).toBeInTheDocument();
  });

  it('adds a criteria row and shows it in the list without a reload', async () => {
    const user = userEvent.setup();
    render(<AchievementBuilder gameId="dino-run" initialRows={[]} />);

    await user.click(screen.getByRole('button', { name: '+ Add criteria' }));
    await user.type(screen.getByLabelText('Threshold score'), '500');
    await user.type(screen.getByLabelText('Award amount'), '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(createAchievementAction).toHaveBeenCalledWith({
      gameId: 'dino-run',
      mode: 'threshold',
      value: 500,
      award: 15,
    });
    expect(await screen.findByTestId('criteria-row')).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_COPY)).not.toBeInTheDocument();
  });

  it('keeps the empty state and shows an error when the save fails', async () => {
    createAchievementAction.mockResolvedValue({
      ok: false,
      error: 'Value and award must be positive whole numbers.',
    });
    const user = userEvent.setup();
    render(<AchievementBuilder gameId="dino-run" initialRows={[]} />);

    await user.click(screen.getByRole('button', { name: '+ Add criteria' }));
    await user.type(screen.getByLabelText('Threshold score'), '0');
    await user.type(screen.getByLabelText('Award amount'), '0');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Value and award must be positive whole numbers.',
    );
    expect(screen.queryAllByTestId('criteria-row')).toHaveLength(0);
  });
});
