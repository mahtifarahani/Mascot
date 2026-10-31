import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { AccountView, HandoffDraft, Request, Snapshot } from '../protocol';
import './style.css';

type Tab = 'accounts' | 'handoffs';
type Saved = { tab?: Tab; selectedId?: string; draft?: HandoffDraft; newHandoff?: boolean };

declare function acquireVsCodeApi(): { postMessage(value: Request): void; getState(): Saved | undefined; setState(value: Saved): void };
const vscode = acquireVsCodeApi();
const send = (request: Request) => vscode.postMessage(request);
const brand = document.getElementById('root')!.dataset.brand;
const emptyDraft: HandoffDraft = { title: '', goal: '', summary: '', next: '' };
const saved: Saved = vscode.getState() ?? {};

function Icon({ name, size = 16 }: { name: 'arrow' | 'plus' | 'refresh' | 'folder' | 'check' | 'close' | 'terminal' | 'shield' | 'gauge' | 'back'; size?: number }) {
  const paths = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></>,
    folder: <path d="M3 7V5h6l2 2h10v13H3z" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    terminal: <><path d="m5 7 5 5-5 5M13 17h6" /></>,
    shield: <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z" />,
    gauge: <><path d="M4 17a8 8 0 1 1 16 0" /><path d="m12 17 4-5" /></>,
    back: <path d="M9 7 4 12l5 5M4 12h10a6 6 0 0 1 6 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

// Selected profile and verified sign-in are different facts; only an explicit auth check may claim "verified".
function standing(account: AccountView): { tone: 'ok' | 'warn' | 'idle'; label: string; detail: string } {
  const { auth } = account;
  if (auth.state === 'signed-in') return { tone: 'ok', label: 'Signed in', detail: auth.email ?? 'Verified with official Claude' };
  if (auth.state === 'signed-out') return { tone: 'warn', label: 'Signed out', detail: 'Sign in through official Claude' };
  if (auth.state === 'unavailable') return { tone: 'idle', label: 'Check failed', detail: auth.message ?? 'Could not check sign-in' };
  return { tone: 'idle', label: 'Not checked', detail: account.current ? 'Selected for Claude · sign-in not verified' : 'Sign-in not checked yet' };
}

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [fatal, setFatal] = useState('');
  const [tab, setTab] = useState<Tab>(saved.tab ?? 'accounts');
  const [selectedId, setSelectedId] = useState(saved.selectedId ?? '');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [newHandoff, setNewHandoff] = useState(!!saved.newHandoff);
  const [draft, setDraft] = useState<HandoffDraft>(saved.draft ?? emptyDraft);
  const [dismissed, setDismissed] = useState('');
  const knownIds = useRef<string[] | undefined>(undefined);
  const handoffCount = useRef<number | undefined>(undefined);
  const group = useRef<HTMLDivElement>(null);

  useEffect(() => { vscode.setState({ tab, selectedId, draft, newHandoff }); }, [tab, selectedId, draft, newHandoff]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.data.type === 'fatal') { setFatal(event.data.message); return; }
      if (event.data.type !== 'snapshot') return;
      const next: Snapshot = event.data.snapshot;
      setSnapshot(next); setFatal('');
      if (next.busy) { setDismissed(''); return; }
      // Follow the result of an explicit add or handoff once the extension has finished it.
      if (knownIds.current) {
        const created = next.accounts.find(a => !knownIds.current!.includes(a.id));
        if (created) setSelectedId(created.id);
        knownIds.current = undefined;
      }
      if (handoffCount.current !== undefined) {
        if (next.handoffs.length > handoffCount.current) { setNewHandoff(false); setDraft(emptyDraft); }
        handoffCount.current = undefined;
      }
    };
    window.addEventListener('message', receive);
    send({ type: 'refresh' });
    return () => window.removeEventListener('message', receive);
  }, []);

  const accounts = snapshot?.accounts ?? [];
  const selected = accounts.find(a => a.id === selectedId) ?? accounts.find(a => a.current) ?? accounts[0];
  const busy = !!snapshot?.busy;
  const disabled = busy || !snapshot?.trusted;
  const official = !!snapshot?.officialAvailable;
  const canLaunch = !disabled && official;
  const notice = snapshot?.notice && snapshot.notice !== dismissed ? snapshot.notice : '';
  const error = snapshot?.error && snapshot.error !== dismissed ? snapshot.error : '';
  const accountName = (id: string) => accounts.find(a => a.id === id)?.name;

  const addAccount = () => {
    if (!name.trim()) return;
    knownIds.current = accounts.map(a => a.id);
    send({ type: 'add', name: name.trim() });
    setName(''); setAdding(false);
  };
  const showAdd = () => { setTab('accounts'); setAdding(true); setRenaming(false); setName(''); };
  const closeOnEscape = (close: () => void) => (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const chooseAccount = (id: string) => { setSelectedId(id); setRenaming(false); };
  const moveSelection = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!step || !selected) return;
    e.preventDefault();
    const index = (accounts.indexOf(selected) + step + accounts.length) % accounts.length;
    chooseAccount(accounts[index].id);
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[index]?.focus();
  };
  const standingNow = selected ? standing(selected) : undefined;

  return <main aria-busy={busy}>
    <header className="brand">
      <div className="brand-lockup"><img src={brand} alt="" /><div><h1>Mascot</h1>{snapshot && <p>Claude accounts</p>}</div></div>
      <button className="icon-button" title="Refresh account list" aria-label="Refresh account list" disabled={busy} onClick={() => send({ type: 'refresh' })}><Icon name="refresh" /></button>
    </header>
    <nav role="tablist" aria-label="Main navigation">
      <button role="tab" id="tab-accounts" aria-controls="panel-accounts" aria-selected={tab === 'accounts'} tabIndex={tab === 'accounts' ? 0 : -1} className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>Accounts{accounts.length > 0 && <span className="count">{accounts.length}</span>}</button>
      <button role="tab" id="tab-handoffs" aria-controls="panel-handoffs" aria-selected={tab === 'handoffs'} tabIndex={tab === 'handoffs' ? 0 : -1} className={tab === 'handoffs' ? 'active' : ''} onClick={() => setTab('handoffs')}>Handoffs{!!snapshot?.handoffs.length && <span className="count">{snapshot.handoffs.length}</span>}</button>
      <button className="icon-button nav-add" title="Add account" aria-label="Add account" disabled={disabled} onClick={showAdd}><Icon name="plus" /></button>
    </nav>

    {fatal && <div className="alert error" role="alert"><span>{fatal}</span></div>}
    {!snapshot && !fatal && <div className="skeleton" role="status" aria-label="Loading accounts"><span /><span /><span /></div>}
    {snapshot && <>
      {!snapshot.trusted && <div className="alert warn" role="alert"><Icon name="shield" /><span>Mascot is read-only here. Open a trusted local workspace to switch accounts.</span></div>}
      {snapshot.trusted && !official && <div className="alert warn" role="alert"><span>Install the official <strong>Claude Code</strong> extension to switch accounts. Mascot never installs it for you.</span></div>}
      {snapshot.busy && <div className="alert" role="status"><span className="loader" /><span>{snapshot.busy}</span></div>}
      {notice && <div className="alert success" role="status"><Icon name="check" /><span>{notice}</span><button className="icon-button dismiss" aria-label="Dismiss message" onClick={() => setDismissed(notice)}><Icon name="close" size={12} /></button></div>}
      {error && <div className="alert error" role="alert"><span>{error}</span><button className="icon-button dismiss" aria-label="Dismiss message" onClick={() => setDismissed(error)}><Icon name="close" size={12} /></button></div>}

      {tab === 'accounts' ? <section className="accounts-content" id="panel-accounts" role="tabpanel" aria-labelledby="tab-accounts">
        {adding && <form className="inline-form" onKeyDown={closeOnEscape(() => setAdding(false))} onSubmit={e => { e.preventDefault(); addAccount(); }}>
          <div className="form-heading"><label htmlFor="account-name">New account</label><button className="icon-button" type="button" aria-label="Cancel adding account" onClick={() => setAdding(false)}><Icon name="close" size={14} /></button></div>
          <div className="input-action"><input id="account-name" autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="e.g. Personal, Work" required /><button className="primary" disabled={disabled || !name.trim()} type="submit">Add</button></div>
          <p className="hint">Only a label. You sign in later through official Claude.</p>
        </form>}

        {!accounts.length && !adding && <div className="empty-state">
          <h2>Add your first account</h2><p>Give each Claude subscription a label, then switch between them in one click.</p>
          <ol className="steps"><li><span>1</span><div>Add a label</div></li><li><span>2</span><div>Choose <b>Use account</b></div></li><li><span>3</span><div>Sign in once in official Claude</div></li></ol>
          <button className="primary" disabled={disabled} onClick={showAdd}><Icon name="plus" /> Add account</button>
        </div>}

        {accounts.length > 0 && <div className="account-list" role="radiogroup" aria-label="Accounts" ref={group} onKeyDown={moveSelection}>{accounts.map((account, i) => {
          const status = standing(account);
          const active = account.id === selected?.id;
          return <button
            key={account.id}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={account.name}
            className={`account-row ${active ? 'is-selected' : ''}`}
            onClick={() => chooseAccount(account.id)}
          >
            <span className={`avatar avatar-${i % 4}`}>{[...account.name][0]?.toUpperCase()}<span className={`dot ${status.tone}`} role="img" aria-label={status.label} title={status.label} /></span>
            <span className="account-info"><strong>{account.name}</strong><span>{status.detail}</span></span>
            {account.current && <span className="current-label">Current</span>}
          </button>;
        })}</div>}

        {selected && standingNow && <div className="account-actions" key={selected.id}>
          <div className="action-head"><h2>{selected.name}</h2><span className={`chip ${standingNow.tone}`}>{standingNow.label}</span></div>
          {selected.current
            ? <button className="primary full" disabled={!canLaunch} onClick={() => send({ type: 'claude' })}>Open Claude<Icon name="arrow" /></button>
            : <button className="primary full" disabled={!canLaunch} onClick={() => send({ type: 'switch', id: selected.id })}>Use account<Icon name="arrow" /></button>}
          <p className="hint">{selected.current ? 'Official Claude is using this profile.' : 'Reloads this window. Stop running Claude chats first.'}</p>
          <div className="quick-actions">
            <button className="secondary" disabled={!canLaunch} onClick={() => send({ type: 'terminal', id: selected.id })}><Icon name="terminal" size={14} />Terminal</button>
            <button className="secondary" disabled={!canLaunch || !selected.profileReady} title={selected.profileReady ? 'Ask official Claude who is signed in' : 'The profile is created the first time you use this account'} onClick={() => send({ type: 'auth', id: selected.id })}><Icon name="check" size={14} />Check sign-in</button>
            {selected.current && <button className="secondary" disabled={!canLaunch} title="Copies /usage for you to paste into Claude" onClick={() => send({ type: 'usage' })}><Icon name="gauge" size={14} />Usage</button>}
          </div>
          {selected.auth.checkedAt && <p className="hint">Sign-in checked {new Date(selected.auth.checkedAt).toLocaleString()}.</p>}
          {selected.auth.state === 'unavailable' && selected.auth.message && <p className="hint">{selected.auth.message}</p>}

          <details className="account-details">
            <summary>More</summary>
            <div className="details-body">
              {renaming
                ? <form className="inline-form" onKeyDown={closeOnEscape(() => setRenaming(false))} onSubmit={e => { e.preventDefault(); send({ type: 'rename', id: selected.id, name }); setRenaming(false); }}><label htmlFor="rename-name">Account name</label><div className="input-action"><input id="rename-name" autoFocus value={name} maxLength={60} onChange={e => setName(e.target.value)} required /><button className="primary" type="submit" disabled={disabled || !name.trim()}>Save</button></div></form>
                : <button className="text-button" disabled={disabled} onClick={() => { setRenaming(true); setName(selected.name); }}>Rename label</button>}
              <dl className="paths"><dt>Claude profile</dt><dd className="plain">{selected.profileReady ? 'Prepared' : 'Created on first use'}</dd><dt>Folder</dt><dd>{selected.configDir}</dd></dl>
              <button className="text-button remove" disabled={disabled || selected.current} title={selected.current ? 'Switch to another profile before removing this label' : 'Remove the label only. Account files and sign-ins are kept.'} onClick={() => send({ type: 'remove', id: selected.id })}>Remove from list</button>
            </div>
          </details>
        </div>}
        {snapshot.canRestore && <div className="restore"><button className="text-button" disabled={disabled || !official} onClick={() => send({ type: 'restore' })}><Icon name="back" size={13} />Use previous Claude profile</button><p className="hint">Return to the profile selected before Mascot.</p></div>}
      </section> : <section className="handoffs-content" id="panel-handoffs" role="tabpanel" aria-labelledby="tab-handoffs">
        {!newHandoff ? <>
          {snapshot.handoffs.length > 0 ? <div className="section-toolbar"><span>Saved handoffs</span><button className="secondary new-handoff" disabled={disabled || !selected} onClick={() => setNewHandoff(true)}><Icon name="plus" size={14} /> New</button></div> : <div className="empty-state"><h2>Continue in another account</h2><p>Save a short summary of your task, then pick it up with a different Claude account. Nothing is sent automatically.</p>{selected ? <button className="primary new-handoff" disabled={disabled} onClick={() => setNewHandoff(true)}><Icon name="plus" /> New handoff</button> : <button className="secondary" disabled={disabled} onClick={showAdd}>Add an account first</button>}</div>}
          <div className="saved-handoffs">{snapshot.handoffs.map(h => <button key={h.id} className="handoff-row" disabled={disabled || !official} title="Continue with a Claude account" onClick={() => send({ type: 'open-handoff', id: h.id })}><Icon name="folder" /><span><strong>{h.title}</strong><small>{[accountName(h.accountId), new Date(h.createdAt).toLocaleDateString()].filter(Boolean).join(' · ')}</small></span><Icon name="arrow" size={14} /></button>)}</div>
        </> : selected ? <form className="handoff-form" onKeyDown={closeOnEscape(() => setNewHandoff(false))} onSubmit={e => { e.preventDefault(); handoffCount.current = snapshot.handoffs.length; send({ type: 'handoff', id: selected.id, draft }); }}>
          <div className="form-heading"><h2>New handoff</h2><button type="button" className="icon-button" aria-label="Close handoff form" onClick={() => setNewHandoff(false)}><Icon name="close" /></button></div>
          {accounts.length > 1 ? <><label htmlFor="source-account">From account</label><select id="source-account" value={selected.id} onChange={e => setSelectedId(e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></> : <p className="hint source-account">From {selected.name}</p>}
          <label htmlFor="handoff-title">Task</label><input id="handoff-title" autoFocus value={draft.title} maxLength={120} required placeholder="What are you working on?" onChange={e => setDraft({ ...draft, title: e.target.value })} />
          <label htmlFor="summary">Summary</label><textarea id="summary" rows={5} maxLength={30000} value={draft.summary} placeholder="Progress, decisions, and what to do next…" onChange={e => setDraft({ ...draft, summary: e.target.value })} />
          <details className="optional-fields" open={!!(draft.goal || draft.next)}><summary>Goal &amp; next step</summary>{([{ key: 'goal', label: 'Goal & constraints' }, { key: 'next', label: 'Next step' }] as const).map(field => <div className="field" key={field.key}><label htmlFor={field.key}>{field.label}</label><textarea id={field.key} rows={3} maxLength={10000} value={draft[field.key]} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })} /></div>)}</details>
          <button className="primary full" disabled={disabled || !draft.title.trim()} type="submit">Save handoff<Icon name="arrow" /></button>
          <p className="hint">Includes local Git details. The draft is kept until it is saved. Nothing is sent automatically.</p>
        </form> : <div className="empty">Add an account to create a handoff.</div>}
      </section>}
    </>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
