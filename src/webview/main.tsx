import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AccountView, HandoffDraft, Request, Snapshot } from '../protocol';
import './style.css';

declare function acquireVsCodeApi(): { postMessage(value: Request): void };
const vscode = acquireVsCodeApi();
const send = (request: Request) => vscode.postMessage(request);
const brand = document.getElementById('root')!.dataset.brand;

function Icon({ name, size = 16 }: { name: 'arrow' | 'plus' | 'refresh' | 'folder' | 'check' | 'close'; size?: number }) {
  const paths = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></>,
    folder: <path d="M3 7V5h6l2 2h10v13H3z" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [fatal, setFatal] = useState('');
  const [tab, setTab] = useState<'accounts' | 'handoffs'>('accounts');
  const [selectedId, setSelectedId] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [newHandoff, setNewHandoff] = useState(false);
  const [draft, setDraft] = useState<HandoffDraft>({ title: '', goal: '', summary: '', next: '' });

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.data.type === 'snapshot') { setSnapshot(event.data.snapshot); setFatal(''); }
      if (event.data.type === 'fatal') setFatal(event.data.message);
    };
    window.addEventListener('message', receive);
    send({ type: 'refresh' });
    return () => window.removeEventListener('message', receive);
  }, []);

  const accounts = snapshot?.accounts ?? [];
  const selected = accounts.find(a => a.id === selectedId) ?? accounts.find(a => a.current) ?? accounts[0];
  const busy = !!snapshot?.busy;
  const disabled = busy || !snapshot?.trusted;
  const currentSelected = !!selected?.current;
  const addAccount = () => {
    if (!name.trim()) return;
    send({ type: 'add', name: name.trim() });
    setName(''); setAdding(false);
  };
  const showAdd = () => { setTab('accounts'); setAdding(true); setRenaming(false); setName(''); };

  return <main>
    <header className="brand">
      <div className="brand-lockup"><img src={brand} alt="Mascot" /><div><h1>Mascot</h1>{snapshot && <p>Claude accounts</p>}</div></div>
      <button className="icon-button" title="Refresh account list" aria-label="Refresh account list" disabled={busy} onClick={() => send({ type: 'refresh' })}><Icon name="refresh" /></button>
    </header>
    <nav aria-label="Main navigation">
      <button className={tab === 'accounts' ? 'active' : ''} aria-current={tab === 'accounts' ? 'page' : undefined} onClick={() => setTab('accounts')}>Accounts{accounts.length > 0 && <span className="count">{accounts.length}</span>}</button>
      <button className={tab === 'handoffs' ? 'active' : ''} aria-current={tab === 'handoffs' ? 'page' : undefined} onClick={() => setTab('handoffs')}>Handoffs</button>
      <button className="icon-button nav-add" title="Add account" aria-label="Add account" disabled={disabled} onClick={showAdd}><Icon name="plus" /></button>
    </nav>

    {fatal && <div className="alert error" role="alert">{fatal}</div>}
    {!snapshot && !fatal && <div className="empty"><span className="loader" />Loading accounts…</div>}
    {snapshot && <>
      {!snapshot.trusted && <div className="alert" role="alert">Trust a local workspace to use Mascot.</div>}
      {snapshot.busy && <div className="alert" role="status"><span className="loader" />{snapshot.busy}</div>}
      {snapshot.notice && <div className="alert success" role="status"><Icon name="check" />{snapshot.notice}</div>}
      {snapshot.error && <div className="alert error" role="alert">{snapshot.error}</div>}

      {tab === 'accounts' ? <section className="accounts-content" aria-label="Account management">
        {adding && <form className="inline-form" onSubmit={e => { e.preventDefault(); addAccount(); }}>
          <div className="form-heading"><label htmlFor="account-name">New account</label><button className="icon-button" type="button" aria-label="Cancel adding account" onClick={() => setAdding(false)}><Icon name="close" size={14} /></button></div>
          <div className="input-action"><input id="account-name" autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Account name" required /><button className="primary" disabled={disabled || !name.trim()} type="submit">Add</button></div>
        </form>}

        {!accounts.length && !adding && <div className="empty-state">
          <h2>Add your first account</h2><p>Choose which account Claude uses.</p>
          <button className="primary" disabled={disabled} onClick={showAdd}><Icon name="plus" /> Add account</button>
        </div>}

        <div className="account-list" aria-label="Accounts">{accounts.map((account, i) => <button
          key={account.id}
          title={account.name}
          aria-pressed={account.id === selected?.id}
          className={`account-row ${account.id === selected?.id ? 'is-selected' : ''}`}
          onClick={() => { setSelectedId(account.id); setRenaming(false); }}
        >
          <span className={`avatar avatar-${i % 4}`}>{account.name.charAt(0).toUpperCase()}</span>
          <span className="account-info"><strong>{account.name}</strong><span>{account.auth.email ?? (account.auth.state === 'signed-out' ? 'Sign in with Claude' : account.current ? 'Selected for Claude' : 'Not checked')}</span></span>
          {account.current && <span className="current-label">Current</span>}
        </button>)}</div>

        {selected && <div className="account-actions" key={selected.id}>
          {currentSelected ? <button className="primary full" disabled={disabled || !snapshot.officialAvailable} onClick={() => send({ type: 'claude' })}>Open Claude<Icon name="arrow" /></button>
            : <button className="primary full" disabled={disabled || !snapshot.officialAvailable} onClick={() => send({ type: 'switch', id: selected.id })}>Use account<Icon name="arrow" /></button>}
          {!snapshot.officialAvailable && <p className="hint">Install the official Claude Code extension to continue.</p>}
          <div className="quick-actions"><button className="text-button" disabled={disabled || !snapshot.officialAvailable} onClick={() => send({ type: 'terminal', id: selected.id })}>Open terminal</button>
          {currentSelected && <button className="text-button" disabled={disabled || !snapshot.officialAvailable} onClick={() => send({ type: 'usage' })}>Check usage ↗</button>}</div>

          <details className="account-details">
            <summary>Account details</summary>
            <div className="details-body">
              <div className="detail-heading"><h3>{selected.name}</h3><button className="text-button" disabled={disabled} onClick={() => { setRenaming(!renaming); setName(selected.name); }}>Rename</button></div>
              {renaming && <form className="inline-form" onSubmit={e => { e.preventDefault(); send({ type: 'rename', id: selected.id, name }); setRenaming(false); }}><label htmlFor="rename-name">Account name</label><div className="input-action"><input id="rename-name" value={name} maxLength={60} onChange={e => setName(e.target.value)} required /><button className="primary" type="submit" disabled={disabled || !name.trim()}>Save</button></div></form>}
              <AccountDetails account={selected} />
              <button className="secondary full" disabled={disabled || !snapshot.officialAvailable || !selected.profileReady} onClick={() => send({ type: 'auth', id: selected.id })}>Check sign-in</button>
              {selected.auth.message && <p className="hint">{selected.auth.message}</p>}
              {selected.auth.checkedAt && <p className="hint">Checked {new Date(selected.auth.checkedAt).toLocaleString()}</p>}
              <details className="paths"><summary>Folders</summary><dl><dt>Claude profile</dt><dd>{selected.configDir}</dd></dl></details>
              <button className="text-button remove" disabled={disabled || selected.current} title="Remove the label only. Account files are kept." onClick={() => send({ type: 'remove', id: selected.id })}>Remove from list</button>
            </div>
          </details>
        </div>}
        {snapshot.canRestore && <button className="text-button restore-button" disabled={disabled} onClick={() => send({ type: 'restore' })}>Use previous Claude profile</button>}
      </section> : <section className="handoffs-content" aria-label="Task handoffs">
        {!newHandoff ? <>
          {snapshot.handoffs.length > 0 ? <div className="section-toolbar"><span>Saved handoffs</span><button className="secondary new-handoff" disabled={disabled || !selected} onClick={() => setNewHandoff(true)}><Icon name="plus" size={14} /> New</button></div> : <div className="empty-state"><h2>Continue in another account</h2><p>Save a short summary for the next session.</p>{selected ? <button className="primary new-handoff" disabled={disabled} onClick={() => setNewHandoff(true)}><Icon name="plus" /> New handoff</button> : <button className="secondary" disabled={disabled} onClick={showAdd}>Add an account first</button>}</div>}
          <div className="saved-handoffs">{snapshot.handoffs.map(h => <button key={h.id} className="handoff-row" disabled={disabled} title="Continue with a Claude account" onClick={() => send({ type: 'open-handoff', id: h.id })}><Icon name="folder" /><span><strong>{h.title}</strong><small>{new Date(h.createdAt).toLocaleDateString()}</small></span><Icon name="arrow" size={14} /></button>)}</div>
        </> : selected ? <form className="handoff-form" onSubmit={e => { e.preventDefault(); send({ type: 'handoff', id: selected.id, draft }); }}>
          <div className="form-heading"><h2>New handoff</h2><button type="button" className="icon-button" aria-label="Close handoff form" onClick={() => setNewHandoff(false)}><Icon name="close" /></button></div>
          {accounts.length > 1 ? <><label htmlFor="source-account">From account</label><select id="source-account" value={selected.id} onChange={e => setSelectedId(e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></> : <p className="hint source-account">From {selected.name}</p>}
          <label htmlFor="handoff-title">Task</label><input id="handoff-title" value={draft.title} maxLength={120} required placeholder="Task name" onChange={e => setDraft({ ...draft, title: e.target.value })} />
          <label htmlFor="summary">Summary</label><textarea id="summary" rows={5} maxLength={30000} value={draft.summary} placeholder="Progress, decisions, and what to do next…" onChange={e => setDraft({ ...draft, summary: e.target.value })} />
          <details className="optional-fields"><summary>Goal & next step</summary>{([{ key: 'goal', label: 'Goal & constraints' }, { key: 'next', label: 'Next step' }] as const).map(field => <div className="field" key={field.key}><label htmlFor={field.key}>{field.label}</label><textarea id={field.key} rows={3} maxLength={10000} value={draft[field.key]} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })} /></div>)}</details>
          <button className="primary full" disabled={disabled || !draft.title.trim()} type="submit">Save handoff<Icon name="arrow" /></button>
          <p className="hint">Includes local Git details. Nothing is sent automatically.</p>
        </form> : <div className="empty">Add an account to create a handoff.</div>}
      </section>}
    </>}
  </main>;
}

function AccountDetails({ account }: { account: AccountView }) {
  return <dl className="setup-checks"><div><dt>Claude profile</dt><dd>{account.profileReady ? 'Prepared' : 'Created on first use'}</dd></div><div><dt>Sign-in</dt><dd>{account.auth.state === 'signed-in' ? 'Verified' : account.auth.state === 'signed-out' ? 'Signed out' : 'Not checked'}</dd></div></dl>;
}

createRoot(document.getElementById('root')!).render(<App />);
