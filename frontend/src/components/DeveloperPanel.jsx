import { useState } from 'react';
import { developerApi } from '../services/api';
import { useClipboard } from '../hooks/useClipboard';

const CODE_TABS = ['curl', 'javascript', 'python'];

const CODE_EXAMPLES = {
  curl: (key, domain) => `# 1. Tạo hộp thư tạm
curl -X POST https://your-domain/api/v1/mailbox \\
  -H "X-API-Key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"${domain}","ttlMinutes":60}'

# 2. Kiểm tra emails
curl https://your-domain/api/v1/mailbox/your@${domain} \\
  -H "X-API-Key: ${key}"

# 3. Xem nội dung email
curl https://your-domain/api/v1/mailbox/your@${domain}/MSG_ID \\
  -H "X-API-Key: ${key}"

# 4. Tải .eml file
curl -o email.eml \\
  https://your-domain/api/v1/mailbox/your@${domain}/MSG_ID/raw \\
  -H "X-API-Key: ${key}"`,

  javascript: (key, domain) => `const API_KEY = '${key}';
const BASE   = 'https://your-domain/api/v1';
const headers = { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' };

// 1. Tạo hộp thư
const { address } = await fetch(\`\${BASE}/mailbox\`, {
  method: 'POST', headers,
  body: JSON.stringify({ domain: '${domain}', ttlMinutes: 30 })
}).then(r => r.json());
console.log('Email:', address);

// 2. Poll nhận email (mỗi 3 giây)
const check = setInterval(async () => {
  const { messages } = await fetch(\`\${BASE}/mailbox/\${address}\`, { headers })
    .then(r => r.json());
  if (messages.length > 0) {
    console.log('Nhận được:', messages[0].subject);
    clearInterval(check);
  }
}, 3000);

// 3. Đọc nội dung email đầy đủ
const msg = await fetch(\`\${BASE}/mailbox/\${address}/\${messages[0].id}\`, { headers })
  .then(r => r.json());
console.log('HTML:', msg.html);`,

  python: (key, domain) => `import requests, time

API_KEY = '${key}'
BASE    = 'https://your-domain/api/v1'
HEADERS = {'X-API-Key': API_KEY}

# 1. Tạo hộp thư
r = requests.post(f'{BASE}/mailbox', headers=HEADERS,
    json={'domain': '${domain}', 'ttlMinutes': 30})
address = r.json()['address']
print(f'Email: {address}')

# 2. Poll nhận email
while True:
    msgs = requests.get(f'{BASE}/mailbox/{address}', headers=HEADERS).json()
    if msgs.get('messages'):
        msg = msgs['messages'][0]
        print(f"Tiêu đề: {msg['subject']}")
        # Đọc nội dung đầy đủ
        full = requests.get(f"{BASE}/mailbox/{address}/{msg['id']}", headers=HEADERS).json()
        print(f"HTML: {full['html'][:100]}...")
        break
    time.sleep(3)`,
};

const ENDPOINTS = [
  { method: 'POST',   path: '/api/v1/mailbox',              desc: 'Tạo hộp thư (+ TTL tùy chỉnh)' },
  { method: 'GET',    path: '/api/v1/mailbox/:address',      desc: 'Lấy danh sách emails' },
  { method: 'GET',    path: '/api/v1/mailbox/:address/:id',  desc: 'Đọc nội dung email đầy đủ' },
  { method: 'GET',    path: '/api/v1/mailbox/:address/:id/raw', desc: 'Tải file .eml' },
  { method: 'DELETE', path: '/api/v1/mailbox/:address',      desc: 'Xóa hộp thư vĩnh viễn' },
  { method: 'PUT',    path: '/api/v1/mailbox/:address/extend', desc: 'Gia hạn TTL (1-60 phút)' },
  { method: 'GET',    path: '/api/v1/domains',               desc: 'Danh sách domain được hỗ trợ' },
];

const METHOD_COLORS = {
  GET:    'bg-emerald-500/15 text-emerald-400',
  POST:   'bg-blue-500/15 text-blue-400',
  PUT:    'bg-amber-500/15 text-amber-400',
  DELETE: 'bg-red-500/15 text-red-400',
};

export default function DeveloperPanel({ domains = [] }) {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [apiKey, setApiKey]   = useState(null);
  const [keyInfo, setKeyInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [codeTab, setCodeTab] = useState('javascript');
  const [showDocs, setShowDocs] = useState(false);
  const { copied, copy }      = useClipboard();

  const domain = domains[0] || 'kurumi.vn';

  const handleCreate = async () => {
    if (!name.trim()) { setError('Vui lòng nhập tên ứng dụng.'); return; }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await developerApi.createKey(name.trim(), email.trim());
      setApiKey(data.key);
      setKeyInfo(data);
      setSuccess('API key đã được tạo! Lưu lại ngay — key sẽ không hiển thị lần sau.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setApiKey(null);
    setKeyInfo(null);
    setName('');
    setEmail('');
    setSuccess('');
    setError('');
  };

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header + Stats ───────────────────────────────────────────────── */}
      <div className="glass p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Developer API</h2>
            <p className="text-xs text-slate-500">Tích hợp KurumiMail vào ứng dụng của bạn qua REST API</p>
          </div>
          <button
            onClick={() => setShowDocs((v) => !v)}
            className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
          >
            {showDocs ? 'Ẩn Docs' : '📋 Xem Docs'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Rate Limit',  value: '300 req/phút' },
            { label: 'Domains',     value: `${domains.length || 4} domains` },
            { label: 'API Version', value: 'v1.0' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] text-center">
              <p className="text-[11px] text-slate-500 mb-1">{label}</p>
              <p className="text-xs font-semibold text-blue-400">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── API Docs ─────────────────────────────────────────────────────── */}
      {showDocs && (
        <div className="glass p-5 animate-slide-down">
          <h3 className="text-sm font-semibold text-white mb-3">📋 Endpoints</h3>
          <div className="space-y-1 mb-4">
            {ENDPOINTS.map(({ method, path, desc }) => (
              <div key={path} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono flex-shrink-0 ${METHOD_COLORS[method]}`}>
                  {method}
                </span>
                <span className="text-xs font-mono text-kurumi-300 flex-1 truncate">{path}</span>
                <span className="text-xs text-slate-500 text-right flex-shrink-0">{desc}</span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="text-blue-400 font-semibold">Authentication: </span>
              Thêm header{' '}
              <code className="text-kurumi-300 font-mono bg-kurumi-900/30 px-1.5 py-0.5 rounded text-[11px]">
                X-API-Key: km_live_xxx
              </code>{' '}
              vào mọi request tới <code className="text-slate-300">/api/v1</code>.
              Hoặc dùng query param{' '}
              <code className="text-kurumi-300 font-mono bg-kurumi-900/30 px-1.5 py-0.5 rounded text-[11px]">
                ?api_key=km_live_xxx
              </code>
            </p>
          </div>
        </div>
      )}

      {/* ── Create API Key ───────────────────────────────────────────────── */}
      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">Tạo API Key</h3>
        </div>

        {!apiKey ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Tên ứng dụng *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="vd: My Automation Bot, Test Project..."
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Email liên hệ (không bắt buộc)</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@example.com"
                type="email"
                className="input-field w-full"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">⚠ {error}</p>
            )}

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold
                hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Đang tạo...' : '🔑 Tạo API Key'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <p className="text-xs text-emerald-400 font-medium">✓ {success}</p>
              </div>
            )}

            {/* Key info */}
            {keyInfo && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.06]">
                  <p className="text-slate-600 mb-0.5">Tên ứng dụng</p>
                  <p className="text-slate-300 font-medium truncate">{keyInfo.name}</p>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.06]">
                  <p className="text-slate-600 mb-0.5">Rate limit</p>
                  <p className="text-slate-300 font-medium">{keyInfo.rateLimit} req/min</p>
                </div>
              </div>
            )}

            {/* Key display */}
            <div className="bg-dark-900/80 rounded-xl p-4 border border-amber-500/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500">API Key của bạn</p>
                <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">
                  Chỉ hiển thị một lần!
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-kurumi-300 break-all leading-relaxed">
                  {apiKey}
                </code>
                <button
                  onClick={() => copy(apiKey)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.06] text-slate-400 hover:bg-kurumi-500/20 hover:text-kurumi-300'
                  }`}
                >
                  {copied ? '✓ Đã sao chép' : 'Sao chép'}
                </button>
              </div>
            </div>

            {/* Code examples */}
            <div>
              <p className="text-xs text-slate-500 mb-2">Ví dụ sử dụng:</p>
              <div className="flex gap-1 mb-3">
                {CODE_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCodeTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                      codeTab === tab
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="relative">
                <pre className="bg-dark-900/90 rounded-xl p-4 text-xs font-mono text-slate-300 overflow-x-auto border border-white/[0.06] whitespace-pre-wrap leading-relaxed max-h-72">
                  {CODE_EXAMPLES[codeTab](apiKey, domain)}
                </pre>
                <button
                  onClick={() => copy(CODE_EXAMPLES[codeTab](apiKey, domain))}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-white/[0.07] text-slate-400 text-xs hover:bg-white/[0.12] transition-all"
                >
                  Sao chép
                </button>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-2 rounded-xl border border-white/[0.08] text-slate-400 text-xs hover:text-white hover:border-white/[0.15] transition-all"
            >
              + Tạo key khác
            </button>
          </div>
        )}
      </div>

      {/* ── Security notice ─────────────────────────────────────────────── */}
      <div className="glass-sm px-4 py-3 flex gap-3 items-start">
        <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="text-amber-400 font-medium">Bảo mật: </span>
          Không chia sẻ API key của bạn. Key có thể bị thu hồi bất cứ lúc nào qua{' '}
          <code className="text-slate-400">DELETE /api/developer/keys/:key</code>.
        </p>
      </div>
    </div>
  );
}
