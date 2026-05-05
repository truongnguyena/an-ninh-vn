import { useState, useRef } from 'react';
import { useClipboard } from '../hooks/useClipboard';

const ICONS = {
  copy: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  delete: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  edit: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  close: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

export default function EmailBar({ address, domains, selectedDomain, onGenerate, onDelete, onCustom }) {
  const { copied, copy } = useClipboard();
  const [editing, setEditing] = useState(false);
  const [localPart, setLocalPart] = useState('');
  const [domainChoice, setDomainChoice] = useState(selectedDomain || domains?.[0] || '');
  const inputRef = useRef(null);

  const handleCopy = () => copy(address);

  const handleStartEdit = () => {
    const local = address?.split('@')[0] || '';
    setLocalPart(local);
    setDomainChoice(selectedDomain || domains?.[0] || '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSaveEdit = () => {
    if (localPart.trim().length >= 3) {
      onCustom(localPart.trim().toLowerCase(), domainChoice);
    }
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveEdit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className="glass p-5 animate-fade-in">
      {/* Label */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">
          Your Temporary Email
        </span>
        <div className="flex items-center gap-1.5">
          {/* Live indicator */}
          <span className="pulse-dot" />
          <span className="text-xs text-emerald-400 font-medium">LIVE</span>
        </div>
      </div>

      {/* Email Address Display / Editor */}
      {editing ? (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 flex items-center glass-sm border-kurumi-500/40 overflow-hidden">
            <input
              ref={inputRef}
              type="text"
              value={localPart}
              onChange={(e) => setLocalPart(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-100 font-mono focus:outline-none"
              placeholder="username"
              maxLength={40}
            />
            <span className="text-slate-500 text-sm px-1">@</span>
            <select
              value={domainChoice}
              onChange={(e) => setDomainChoice(e.target.value)}
              className="bg-dark-700/80 text-slate-300 text-sm py-2.5 pr-3 focus:outline-none border-l border-white/[0.06]"
            >
              {domains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <button onClick={handleSaveEdit} className="btn-primary py-2.5">
            {ICONS.check} Save
          </button>
          <button onClick={() => setEditing(false)} className="btn-ghost py-2.5">
            {ICONS.close}
          </button>
        </div>
      ) : (
        <div
          className="flex items-center gap-3 mb-4 group cursor-pointer"
          onClick={handleCopy}
          title="Click to copy"
        >
          <div className="flex-1 email-address text-lg truncate group-hover:border-kurumi-500/40 transition-colors duration-200">
            {address || 'loading...'}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className={`flex-shrink-0 p-2.5 rounded-xl transition-all duration-200 ${
              copied
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-white/[0.05] text-slate-400 hover:bg-kurumi-500/20 hover:text-kurumi-300'
            }`}
            title="Copy to clipboard"
          >
            {copied ? ICONS.check : ICONS.copy}
          </button>
        </div>
      )}

      {copied && (
        <p className="text-xs text-emerald-400 mb-3 animate-fade-in">✓ Copied to clipboard!</p>
      )}

      {/* Domain quick-switch (when not editing) */}
      {!editing && domains.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {domains.map((d) => (
            <button
              key={d}
              onClick={() => onGenerate(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                address?.endsWith('@' + d)
                  ? 'bg-kurumi-600/40 text-kurumi-300 border border-kurumi-500/40'
                  : 'bg-white/[0.04] text-slate-500 hover:text-slate-300 hover:bg-white/[0.08] border border-transparent'
              }`}
            >
              @{d}
            </button>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => onGenerate(selectedDomain)} className="btn-primary">
          {ICONS.refresh} New Address
        </button>
        <button onClick={handleStartEdit} className="btn-ghost">
          {ICONS.edit} Custom
        </button>
        <button onClick={onDelete} className="btn-danger ml-auto">
          {ICONS.delete} Delete Inbox
        </button>
      </div>
    </div>
  );
}
