import { useState } from 'react';

export default function TestEmailPanel({ onSend }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      await onSend(subject || undefined, text || undefined);
      setResult({ ok: true, message: 'Test email sent! Check your inbox in ~3s.' });
      setSubject('');
      setText('');
    } catch (err) {
      setResult({ ok: false, message: err.message });
    }
    setSending(false);
    setTimeout(() => setResult(null), 5000);
  };

  return (
    <div className="glass-sm animate-fade-in">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2.5 text-sm text-slate-400">
          <svg className="w-4 h-4 text-kurumi-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.607L5 14.5m14.8.5l-1.5 4.5a2.25 2.25 0 01-2.121 1.5H7.818a2.25 2.25 0 01-2.122-1.5L4.2 15" />
          </svg>
          Send Test Email
        </div>
        <svg
          className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 animate-slide-down border-t border-white/[0.04]">
          <div className="pt-3">
            <label className="text-xs text-slate-500 mb-1.5 block">Subject (optional)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Test email subject..."
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Message (optional)</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Email body text..."
              rows={3}
              className="input-field w-full resize-none"
            />
          </div>

          {result && (
            <div className={`text-xs px-3 py-2 rounded-lg animate-fade-in ${
              result.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {result.ok ? '✓ ' : '✗ '}{result.message}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending}
            className="btn-primary justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Send Test Email
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
