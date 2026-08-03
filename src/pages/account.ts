/**
 * account.ts — the minimal Account surface (tasks.md ids 87, 87a).
 *
 * Per UX Information Architecture this is deliberately small: link Discord, see your own
 * transaction log, and do the riddles/tasks. It is not a second dashboard — anything
 * administrative lives in the backend's /admin, behind an isAdmin check.
 *
 * Every section degrades independently. A signed-out or unreachable backend renders an
 * explanatory panel rather than an error, matching the rest of this partition.
 */
import '../styles/main.css';
import * as api from '../lib/tokenApi';
import { initTokens } from '../lib/tokens';

function $<T extends HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`account: missing ${sel}`);
  return el;
}

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function signedOutPanel(message: string): HTMLElement {
  const wrap = el('div', 'panel');
  wrap.append(el('p', 'tiny', message));
  if (api.tokensConfigured()) {
    const link = document.createElement('a');
    link.className = 'button button-primary';
    link.href = api.signInUrl();
    link.textContent = 'SIGN IN WITH GOOGLE';
    wrap.append(link);
  }
  return wrap;
}

/* ---------- transaction log ---------- */

function renderLog(host: HTMLElement, txs: api.Transaction[]): void {
  host.replaceChildren();

  if (txs.length === 0) {
    host.append(el('p', 'tiny', 'No activity yet.'));
    return;
  }

  const table = document.createElement('table');
  table.className = 'token-log';

  const head = document.createElement('tr');
  for (const label of ['When', 'Amount', 'Reason']) {
    head.append(el('th', undefined, label));
  }
  table.append(head);

  for (const tx of txs) {
    const row = document.createElement('tr');
    row.append(el('td', undefined, new Date(tx.createdAt).toLocaleDateString()));
    row.append(
      el(
        'td',
        tx.amount < 0 ? 'amt-neg' : 'amt-pos',
        tx.amount > 0 ? `+${tx.amount}` : String(tx.amount),
      ),
    );
    row.append(el('td', undefined, tx.reason));
    table.append(row);
  }

  host.replaceChildren(table);
}

/* ---------- riddles / tasks ---------- */

function renderContent(host: HTMLElement, items: api.ContentItem[]): void {
  host.replaceChildren();

  if (items.length === 0) {
    // Expected at launch — content authoring is out of scope this initiative, so there is
    // nothing seeded yet. UX Riddles/Tasks List calls for the same muted empty-state
    // convention as every other list, NOT an error.
    host.append(el('p', 'tiny', 'Nothing here yet.'));
    return;
  }

  for (const item of items) {
    const row = el('div', 'content-item');
    row.append(el('div', 'content-prompt', item.prompt));

    const meta = el('div', 'tiny');
    meta.textContent = `${item.type} · +${item.award} tokens`;
    row.append(meta);

    if (item.completedToday) {
      // Only riddles/trivia can be "done for today"; tasks repeat without limit, and the
      // backend already encodes that by never setting this flag for them.
      row.append(el('span', 'pill', 'COMPLETED TODAY'));
    } else {
      const form = document.createElement('form');
      form.className = 'content-form';

      const input = document.createElement('input');
      input.type = 'text';
      input.required = true;
      input.setAttribute('aria-label', `Answer for: ${item.prompt}`);

      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'button button-primary';
      submit.textContent = 'SUBMIT';

      const status = el('span', 'tiny');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!input.value.trim()) return;
        submit.disabled = true;
        status.textContent = 'Submitting…';

        void api.completeContent(item.id, input.value.trim()).then((result) => {
          submit.disabled = false;
          if (result.status !== 'ok') {
            status.textContent = 'Could not submit right now.';
            return;
          }
          if (result.data.ok) {
            status.textContent = `+${result.data.awarded ?? item.award} tokens`;
            void load();
          } else {
            status.textContent = 'Already completed today.';
          }
        });
      });

      form.append(input, submit, status);
      row.append(form);
    }

    host.append(row);
  }
}

/* ---------- boot ---------- */

const logHost = $('#account-log');
const contentHost = $('#account-content');
const linkHost = $('#account-discord');

async function load(): Promise<void> {
  const balance = await api.getBalance();

  if (balance.status === 'signed-out') {
    logHost.replaceChildren(signedOutPanel('Sign in to see your token history.'));
    contentHost.replaceChildren(signedOutPanel('Sign in to earn from riddles and tasks.'));
    linkHost.replaceChildren();
    return;
  }

  if (balance.status === 'unavailable') {
    const message = api.tokensConfigured()
      ? 'Token service is unreachable right now. Games still work.'
      : 'Tokens are not enabled on this build.';
    logHost.replaceChildren(el('p', 'tiny', message));
    contentHost.replaceChildren();
    linkHost.replaceChildren();
    return;
  }

  renderLog(logHost, balance.data.recent);

  // Linking is optional and one-way from here — Auth.js owns the flow, so this is a link
  // into it rather than a form of our own.
  linkHost.replaceChildren();
  const link = document.createElement('a');
  link.className = 'button button-secondary';
  link.href = api.linkDiscordUrl();
  link.textContent = 'LINK DISCORD ACCOUNT';
  linkHost.append(
    el('p', 'tiny', 'Link Discord so scores you post in chat count toward your balance.'),
    link,
  );

  const content = await api.getContent();
  if (content.status === 'ok') renderContent(contentHost, content.data.items);
  else contentHost.replaceChildren(el('p', 'tiny', 'Riddles and tasks are unavailable.'));
}

initTokens(document.querySelector<HTMLElement>('.top-ctrl'));
void load();
