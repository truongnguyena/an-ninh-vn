import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useClipboard } from '../hooks/useClipboard';

export default function QRCode({ address }) {
  const [open, setOpen] = useState(false);
  const { copied, copy } = useClipboard();

  if (!address) return null;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Show QR Code"
        className={`p-2.5 rounded-xl transition-all duration-200 active:scale-95
          ${open
            ? 'bg-kurumi-600/30 text-kurumi-300 border border-kurumi-500/40'
            : 'bg-white/[0.05] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200 border border-transparent'
          }`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
        </svg>
      </button>

      {/* QR Panel */}
      {open && (
        <div className="absolute top-full right-0 mt-2 z-40 animate-slide-down">
          <div className="glass p-5 shadow-2xl shadow-black/60 flex flex-col items-center gap-4 w-56">
            {/* QR Code */}
            <div className="p-3 bg-white rounded-xl">
              <QRCodeSVG
                value={address}
                size={160}
                bgColor="#ffffff"
                fgColor="#0f0f1a"
                level="M"
                includeMargin={false}
              />
            </div>

            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Scan to share address</p>
              <p className="text-xs font-mono text-kurumi-400 break-all">{address}</p>
            </div>

            <button
              onClick={() => copy(address)}
              className={`w-full py-2 rounded-xl text-xs font-medium transition-all active:scale-95 ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/[0.06] text-slate-400 hover:bg-kurumi-500/20 hover:text-kurumi-300'
              }`}
            >
              {copied ? '✓ Copied!' : 'Copy Address'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
