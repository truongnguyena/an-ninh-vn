import { useState, useCallback, useEffect, useRef } from 'react';
import { useMailbox } from './hooks/useMailbox';
import EmailBar from './components/EmailBar';
import InboxList from './components/InboxList';
import EmailModal from './components/EmailModal';
import TimerBar from './components/TimerBar';
import QRCode from './components/QRCode';
import TestEmailPanel from './components/TestEmailPanel';
import DeveloperPanel from './components/DeveloperPanel';

const NAV_TABS = [
  {
    id: 'inbox', label: 'Inbox',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
      </svg>
    ),
  },
  {
    id: 'developer', label: 'Developer',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
];

let toastId = 0;

export default function App() {
  const [activeTab, setActiveTab]         = useState('inbox');
  const [openMessageId, setOpenMessageId] = useState(null);
  const [toasts, setToasts]               = useState([]);

  const {
    address, expiresAt, messages, unseenCount,
    loading, polling, error, domains, selectedDomain,
    setSelectedDomain,
    searchQuery, setSearchQuery,
    searchResults,
    serverStatus,
    refresh, generateNew, deleteInbox, clearInbox,
    extendTime, sendTestEmail, setCustomAddress,
    markAllRead, starMessage, clearError,
  } = useMailbox();

  // ─── Toast system ─────────────────────────────────────────────────────────
  const addToast = useCallback((msg, type = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-3), { id, msg, type }]); // max 4 toasts
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // Forward errors from hook → toast
  useEffect(() => {
    if (error) {
      addToast(error, 'error');
      clearError();
    }
  }, [error, addToast, clearError]);

  return (
    <div className="min-h-screen flex flex-col">

      {/* ─── Toast Container ──────────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-slide-down max-w-xs border
              ${t.type === 'error'
                ? 'bg-red-950/95 border-red-500/40 text-red-200'
                : t.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
                : 'bg-dark-700/95 border-white/10 text-slate-200'
              }`}
          >
            {t.type === 'error' && '⚠ '}
            {t.type === 'success' && '✓ '}
            {t.msg}
          </div>
        ))}
      </div>

      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <header className="border-b border-white/[0.05] bg-dark-800/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-kurumi-500 to-purple-700 flex items-center justify-center shadow-lg shadow-kurumi-900/50">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold gradient-text leading-none">KurumiMail</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-slate-600">Disposable Email</span>
                {serverStatus === 'ok' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    <span className="text-[10px] text-emerald-600">online</span>
                  </>
                )}
                {serverStatus === 'error' && (
                  <span className="text-[10px] text-red-500">⚠ offline</span>
                )}
              </div>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-1.5">
            {unseenCount > 0 && (
              <span className="badge-new animate-bounce-in">{unseenCount} mới</span>
            )}

            <button
              onClick={refresh}
              title="Tải lại hộp thư"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-all active:scale-90"
            >
              <svg className={`w-4 h-4 ${polling ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <div className="relative">
              <QRCode address={address} />
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="max-w-2xl mx-auto px-4 flex gap-0">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold border-b-2 transition-all duration-200
                ${activeTab === tab.id
                  ? 'border-kurumi-500 text-kurumi-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-white/20'
                }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'inbox' && unseenCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-kurumi-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {unseenCount > 9 ? '9+' : unseenCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ─── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 flex flex-col gap-4">

        {/* INBOX TAB */}
        {activeTab === 'inbox' && (
          <>
            <EmailBar
              address={address}
              domains={domains}
              selectedDomain={selectedDomain}
              onGenerate={(domain) => {
                if (domain) setSelectedDomain(domain);
                generateNew(domain);
              }}
              onDelete={deleteInbox}
              onCustom={setCustomAddress}
            />

            {expiresAt && (
              <TimerBar expiresAt={expiresAt} onExtend={extendTime} />
            )}

            <InboxList
              messages={messages}
              loading={loading}
              polling={polling}
              searchQuery={searchQuery}
              searchResults={searchResults}
              onSearch={setSearchQuery}
              onOpen={setOpenMessageId}
              onClear={clearInbox}
              onMarkAllRead={markAllRead}
              onStar={starMessage}
              unseenCount={unseenCount}
            />

            <TestEmailPanel onSend={sendTestEmail} />

            <p className="text-center text-xs text-slate-700 pb-2">
              Email tự xóa sau khi hết hạn · Không cần đăng ký ·{' '}
              <span className="text-kurumi-800">KurumiMail v2.1</span>
            </p>
          </>
        )}

        {/* DEVELOPER TAB */}
        {activeTab === 'developer' && (
          <DeveloperPanel domains={domains} />
        )}
      </main>

      {/* Email Modal */}
      {openMessageId && (
        <EmailModal
          address={address}
          messageId={openMessageId}
          onClose={() => setOpenMessageId(null)}
          onStar={starMessage}
          currentMessages={messages}
        />
      )}
    </div>
  );
}
