import { useEffect, useState, useRef } from 'react';
import { mailboxApi } from '../services/api';

const ICONS = {
  close: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  download: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  eml: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  attachment: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
    </svg>
  ),
  spinner: (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  ),
  star: (filled) => (
    <svg
      className={`w-5 h-5 transition-all duration-150 ${filled ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-500 hover:text-amber-400'}`}
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
};

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('vi-VN', {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function EmailModal({ address, messageId, onClose, onStar, currentMessages }) {
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('html'); // 'html' | 'text'
  const [starred, setStarred] = useState(false);
  const iframeRef = useRef(null);
  const backdropRef = useRef(null);

  // Get initial starred state from currentMessages
  useEffect(() => {
    const existing = currentMessages?.find((m) => m.id === messageId);
    if (existing) setStarred(existing.starred || false);
  }, [messageId, currentMessages]);

  useEffect(() => {
    if (!address || !messageId) return;
    setLoading(true);
    mailboxApi.getMessage(address, messageId)
      .then((data) => {
        setMessage(data);
        setStarred(data.starred || false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [address, messageId]);

  // Auto-resize iframe to content
  useEffect(() => {
    if (!message?.html || viewMode !== 'html') return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      try {
        const height = iframe.contentDocument?.documentElement?.scrollHeight;
        if (height) iframe.style.height = Math.min(height + 20, 600) + 'px';
      } catch {}
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [message, viewMode]);

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Star toggle
  const handleStar = async () => {
    const next = !starred;
    setStarred(next);
    onStar?.(messageId, next);
  };

  // Download .eml
  const handleDownloadEml = () => {
    if (!address || !messageId) return;
    const url = mailboxApi.emlUrl(address, messageId);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${messageId.slice(0, 8)}.eml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const htmlDoc = message?.html
    ? `<!DOCTYPE html><html><head><meta charset="utf-8">
        <style>body{margin:0;padding:16px;font-family:Arial,sans-serif;font-size:14px;
        background:#0f0f1a;color:#e2e8f0;word-break:break-word;}
        a{color:#a78bfa;}img{max-width:100%;height:auto;}</style></head>
        <body>${message.html}</body></html>`
    : null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="glass w-full max-w-2xl max-h-[92vh] flex flex-col animate-slide-up shadow-2xl shadow-black/50">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500">
                {ICONS.spinner} <span className="text-sm">Đang tải email...</span>
              </div>
            ) : (
              <>
                <h2 className="font-semibold text-slate-100 text-lg leading-snug mb-2 line-clamp-2">
                  {message?.subject || '(Không có tiêu đề)'}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    <span className="text-slate-600">Từ: </span>
                    <span className="text-slate-400">
                      {message?.from?.name
                        ? `${message.from.name} <${message.from.address}>`
                        : message?.from?.address}
                    </span>
                  </span>
                  <span>
                    <span className="text-slate-600">Đến: </span>
                    <span className="text-slate-400">{message?.to}</span>
                  </span>
                  <span>
                    <span className="text-slate-600">Ngày: </span>
                    <span className="text-slate-400">{formatDate(message?.date)}</span>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Star */}
            {!loading && message && (
              <button
                onClick={handleStar}
                title={starred ? 'Bỏ đánh dấu yêu thích' : 'Đánh dấu yêu thích'}
                className="p-2 rounded-xl transition-all hover:bg-amber-500/10 active:scale-90"
              >
                {ICONS.star(starred)}
              </button>
            )}

            {/* Download EML */}
            {!loading && message && (
              <button
                onClick={handleDownloadEml}
                title="Tải xuống file .eml"
                className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-all active:scale-90"
              >
                {ICONS.eml}
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all ml-1"
            >
              {ICONS.close}
            </button>
          </div>
        </div>

        {/* View mode toggle */}
        {!loading && message && (
          <div className="flex items-center gap-1 px-5 py-2.5 border-b border-white/[0.04] flex-shrink-0">
            {[
              { id: 'html', label: 'HTML' },
              { id: 'text', label: 'Văn bản thuần' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  viewMode === id
                    ? 'bg-kurumi-600/40 text-kurumi-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
            {message?.attachments?.length > 0 && (
              <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                {ICONS.attachment}
                {message.attachments.length} file đính kèm
              </span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scroll p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-600">
              {ICONS.spinner}
            </div>
          ) : !message ? (
            <p className="text-slate-500 text-center py-12">Không tìm thấy email.</p>
          ) : viewMode === 'html' && htmlDoc ? (
            <iframe
              ref={iframeRef}
              srcDoc={htmlDoc}
              sandbox="allow-same-origin"
              className="w-full rounded-xl border border-white/[0.05] bg-dark-700"
              style={{ minHeight: '200px', height: '400px' }}
              title="Nội dung email"
            />
          ) : (
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
              {message.text || message.html?.replace(/<[^>]*>/g, '') || '(Email trống)'}
            </pre>
          )}

          {/* Attachments */}
          {!loading && message?.attachments?.length > 0 && (
            <div className="mt-5 border-t border-white/[0.06] pt-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                File đính kèm ({message.attachments.length})
              </p>
              <div className="flex flex-col gap-2">
                {message.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={mailboxApi.attachmentUrl(address, messageId, idx)}
                    download={att.filename}
                    className="flex items-center gap-3 p-3 glass-sm hover:bg-white/[0.06] transition-all group"
                  >
                    <div className="text-kurumi-400">{ICONS.attachment}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate group-hover:text-white transition-colors">
                        {att.filename}
                      </p>
                      <p className="text-xs text-slate-600">
                        {att.contentType} · {formatSize(att.size)}
                      </p>
                    </div>
                    <div className="text-slate-600 group-hover:text-kurumi-400 transition-colors">
                      {ICONS.download}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
