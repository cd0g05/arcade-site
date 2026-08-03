/**
 * @vitest-environment jsdom
 *
 * tokens.spec.ts — the token layer's contract with the existing arcade
 * (tasks.md ids 84-86, 88).
 *
 * The thing actually under test is the promise this partition makes: tokens are a layer
 * ON TOP of a finished site, and every failure mode of that layer must leave gameplay
 * intact. So most of these assert that something DOESN'T block a game.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const spend = vi.fn();
const submitScore = vi.fn();
const getBalance = vi.fn();
let configured = true;

vi.mock('../lib/tokenApi', () => ({
  tokensConfigured: () => configured,
  signInUrl: () => 'https://backend.test/api/auth/signin',
  signOutUrl: () => 'https://backend.test/api/auth/signout',
  linkDiscordUrl: () => 'https://backend.test/api/auth/signin/discord',
  getBalance: (...a: unknown[]) => getBalance(...a),
  spend: (...a: unknown[]) => spend(...a),
  submitScore: (...a: unknown[]) => submitScore(...a),
  getContent: vi.fn(),
  completeContent: vi.fn(),
}));

// The pixel wipe wraps every fullscreen transition in ~340ms of rAF + timers, which
// this suite has no reason to wait out — what's under test is whether the spend gate
// let the transition happen at all, not how it looked. Resolving immediately keeps the
// fullscreen assertions about the gate.
vi.mock('../lib/wipe', () => ({
  showInstantCover: vi.fn(),
  coverScreen: () => Promise.resolve(),
  revealScreen: () => Promise.resolve(),
}));

const { Hub } = await import('../lib/hub');
const { store } = await import('../lib/storage');
const { initTokens, __resetTokens } = await import('../lib/tokens');
const { gameByBestKey, gameByHubId, TOKEN_GAMES } = await import('../lib/tokenGames');

/** A card carrying the pieces Hub.register and the token layer look for. */
function makeCard(): HTMLElement {
  const card = document.createElement('div');
  const veil = document.createElement('div');
  veil.className = 'veil';
  const msg = document.createElement('div');
  msg.className = 'veil-msg';
  msg.textContent = 'CLICK TO PLAY';
  veil.append(msg);
  card.append(veil);
  document.body.append(card);
  return card;
}

function makeCartridge() {
  return { start: vi.fn(), stop: vi.fn() };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.replaceChildren();
  configured = true;
  vi.clearAllMocks();
  getBalance.mockResolvedValue({ status: 'ok', data: { balance: 50, recent: [] } });
  spend.mockResolvedValue({ outcome: 'spent', newBalance: 47 });
  submitScore.mockResolvedValue({ status: 'ok', data: { recorded: true, awards: [] } });
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    key: () => null,
    length: 0,
  });
});

afterEach(() => {
  __resetTokens();
  Hub.sleep();
  vi.unstubAllGlobals();
});

describe('game id mapping', () => {
  it('maps every local identifier to a backend slug exactly once', () => {
    const slugs = TOKEN_GAMES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    expect(gameByHubId('dino')?.slug).toBe('dino-run');
    expect(gameByHubId('g2048')?.slug).toBe('2048');
    // The site calls this game ECHO; the backend seeds it as `simon`.
    expect(gameByHubId('echo')?.slug).toBe('simon');
    expect(gameByBestKey('best:2048')?.slug).toBe('2048');
  });

  it('has no best key pointing at two games', () => {
    const keys = TOKEN_GAMES.map((g) => g.bestKey).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('spend-before-play gate (id:84, id:85)', () => {
  it('starts the game after a successful spend', async () => {
    const card = makeCard();
    const cart = makeCartridge();
    initTokens(document.body);
    Hub.register('dino', cart, card);

    Hub.wake('dino');
    await flush();

    expect(spend).toHaveBeenCalledWith('dino-run');
    expect(cart.start).toHaveBeenCalled();
    expect(Hub.current).toBe('dino');
  });

  it('blocks the game and shows the exact veil copy when the balance is short', async () => {
    spend.mockResolvedValue({ outcome: 'insufficient', required: 3, balance: 1 });
    const card = makeCard();
    const cart = makeCartridge();
    initTokens(document.body);
    Hub.register('dino', cart, card);

    Hub.wake('dino');
    await flush();

    expect(cart.start).not.toHaveBeenCalled();
    expect(Hub.current).toBeNull();
    expect(card.querySelector('.veil-msg')?.textContent).toBe('NEED 3 TOKENS');
    // The veil must not steal focus from whatever the player is actually doing.
    expect(document.activeElement).not.toBe(card);
  });

  it('lets the game start when the backend is unreachable', async () => {
    spend.mockResolvedValue({ outcome: 'unavailable' });
    const card = makeCard();
    const cart = makeCartridge();
    initTokens(document.body);
    Hub.register('dino', cart, card);

    Hub.wake('dino');
    await flush();

    // The whole point: an outage must not lock players out of a site that worked fine
    // before tokens existed.
    expect(cart.start).toHaveBeenCalled();
    expect(Hub.current).toBe('dino');
  });

  it('lets the game start for a signed-out visitor without ever calling spend', async () => {
    getBalance.mockResolvedValue({ status: 'signed-out' });
    const card = makeCard();
    const cart = makeCartridge();
    initTokens(document.body);
    await flush();
    Hub.register('dino', cart, card);

    Hub.wake('dino');
    await flush();

    expect(spend).not.toHaveBeenCalled();
    expect(cart.start).toHaveBeenCalled();
  });

  it('does not gate a game the backend does not know about', async () => {
    const card = makeCard();
    const cart = makeCartridge();
    initTokens(document.body);
    Hub.register('not-a-real-game', cart, card);

    Hub.wake('not-a-real-game');
    await flush();

    expect(spend).not.toHaveBeenCalled();
    expect(cart.start).toHaveBeenCalled();
  });

  it('installs no gate at all when no backend is configured', async () => {
    configured = false;
    const card = makeCard();
    const cart = makeCartridge();
    initTokens(document.body);
    Hub.register('dino', cart, card);

    Hub.wake('dino');

    // Synchronous, exactly as before this partition existed — no awaiting a gate.
    expect(Hub.current).toBe('dino');
    expect(cart.start).toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
  });

  it('does not let the fullscreen button bypass the spend gate', async () => {
    spend.mockResolvedValue({ outcome: 'insufficient', required: 3, balance: 0 });
    const card = makeCard();
    const cart = makeCartridge();
    initTokens(document.body);
    Hub.register('dino', cart, card);

    Hub.toggleFs('dino');
    await flush();

    expect(cart.start).not.toHaveBeenCalled();
    expect(Hub.fullscreen).toBeNull();
    expect(card.classList.contains('fs')).toBe(false);
  });

  it('fullscreens a paid game once its spend resolves', async () => {
    const card = makeCard();
    const cart = makeCartridge();
    initTokens(document.body);
    Hub.register('dino', cart, card);

    Hub.toggleFs('dino');
    await flush();

    expect(cart.start).toHaveBeenCalled();
    expect(Hub.fullscreen).toBe('dino');
    // Exactly once: the fullscreen path gates, then wakes directly rather than routing
    // back through Hub.wake(), which would consult the gate a second time and charge
    // twice for one ⛶ press.
    expect(spend).toHaveBeenCalledTimes(1);
    Hub.exitFs();
  });
});

describe('score submission (id:86)', () => {
  it('submits a new personal best without any game code knowing', async () => {
    initTokens(document.body);
    await flush();

    // This is exactly what dino.ts already does on a new best — unchanged by this work.
    store.set('best:dino', 1200);
    await flush();

    expect(submitScore).toHaveBeenCalledWith('dino-run', 1200);
  });

  it('ignores writes that are not scores', async () => {
    initTokens(document.body);
    await flush();

    store.set('credits', 5);
    store.set('watersort:level', 3);
    store.set('best:dino', 'not a number');
    store.set('best:dino', -1);
    await flush();

    expect(submitScore).not.toHaveBeenCalled();
  });

  it('renders a toast for each award returned', async () => {
    submitScore.mockResolvedValue({
      status: 'ok',
      data: {
        recorded: true,
        awards: [{ amount: 15, reason: 'High Score: Dino Run', source: 'achievement' }],
      },
    });
    initTokens(document.body);
    await flush();

    store.set('best:dino', 1200);
    // Two ticks: one for the submit round trip, one for showAwards' per-award timer,
    // which staggers multiple awards so each is announced separately.
    await flush();
    await flush();

    const toast = document.querySelector('.token-toast');
    expect(toast?.textContent).toContain('+15');
    expect(toast?.textContent).toContain('High Score: Dino Run');
    // Announced politely rather than interrupting play.
    expect(toast?.getAttribute('aria-live')).toBe('polite');
  });

  it('survives a submission failure silently', async () => {
    submitScore.mockResolvedValue({ status: 'unavailable' });
    initTokens(document.body);
    await flush();

    expect(() => store.set('best:dino', 1200)).not.toThrow();
    await flush();
    expect(document.querySelector('.token-toast')).toBeNull();
  });

  it('never lets a throwing observer break the game that wrote the score', () => {
    const unsubscribe = store.observe(() => {
      throw new Error('observer blew up');
    });
    expect(() => store.set('best:dino', 10)).not.toThrow();
    unsubscribe();
  });
});

describe('balance widget (id:81, id:82)', () => {
  it('shows the balance once loaded', async () => {
    initTokens(document.body);
    await flush();

    const pill = document.querySelector('.token-pill');
    expect(pill?.textContent).toContain('50');
    expect(pill?.getAttribute('aria-label')).toBe('Token balance: 50');
  });

  it('offers sign-in when signed out', async () => {
    getBalance.mockResolvedValue({ status: 'signed-out' });
    initTokens(document.body);
    await flush();

    const signIn = document.querySelector<HTMLElement>('.token-signin');
    expect(signIn?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('.token-pill')?.hidden).toBe(true);
  });

  it('degrades to a dimmed pill rather than vanishing when the backend is down', async () => {
    getBalance.mockResolvedValue({ status: 'unavailable' });
    initTokens(document.body);
    await flush();

    const pill = document.querySelector('.token-pill');
    // A disappearing balance reads as "my tokens are gone"; dimming reads as "can't reach".
    expect(pill?.classList.contains('degraded')).toBe(true);
    expect(pill?.getAttribute('aria-label')).toBe('Token balance unavailable');
  });

  it('keeps offering sign-in after a signed-out visitor starts a game', async () => {
    getBalance.mockResolvedValue({ status: 'signed-out' });
    spend.mockResolvedValue({ outcome: 'unavailable' });
    const card = makeCard();
    initTokens(document.body);
    await flush();
    Hub.register('dino', makeCartridge(), card);

    Hub.wake('dino');
    await flush();

    // A failed spend must not degrade a session we already know is signed out — the
    // player needs the sign-in affordance, not a dimmed pill.
    expect(document.querySelector<HTMLElement>('.token-signin')?.hidden).toBe(false);
    expect(document.querySelector('.token-pill')?.classList.contains('degraded')).toBe(false);
  });

  it('renders nothing at all when tokens are not configured', () => {
    configured = false;
    initTokens(document.body);

    expect(document.querySelector<HTMLElement>('.token-widget')?.hidden).toBe(true);
  });
});
