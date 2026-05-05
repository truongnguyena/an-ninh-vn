import { useEffect, useRef, useState } from 'react';

const ICONS = {
  attachment: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
    </svg>
  ),
  inbox: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  star: (starred) => (
    <svg className={`w-4 h-4 ${starred ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  close: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  spinner: (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ),
};

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'vừa xong';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}p trước`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h trước`;
  return d.toLocaleDateString('vi-VN');
}

function MessageCard({ message, onClick, isNew, onStar }) {
  const handleStar = (e) => {
    e.stopPropagation();
    onStar?.(message.id, !message.starred);
  };

  return (
    <button
      onClick={() => onClick(message.id)}
      className={`inbox-item w-full text-left glass-sm p-4 hover:bg-white/[0.06] hover:border-kurumi-500/20
        active:scale-[0.99] transition-all duration-200 group ${!message.seen ? 'border-l-2 border-l-kurumi-500' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
          ${message.seen ? 'bg-dark-600/80 text-slate-500' : 'bg-gradient-to-br from-kurumi-600 to-purple-700 text-white shadow-lg shadow-kurumi-900/50'}`}>
          {(message.from?.name || message.from?.address || '?')[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={`text-sm font-semibold truncate ${message.seen ? 'text-slate-400' : 'text-slate-100'}`}>
              {message.from?.name || message.from?.address || 'Unknown'}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isNew && <span className="badge-new">MỚI</span>}
              <span className="text-xs text-slate-600">{formatTime(message.receivedAt)}</span>
            </div>
          </div>

          <p className={`text-sm truncate mb-1 ${message.seen ? 'text-slate-500' : 'text-slate-300 font-medium'}`}>
            {message.subject}
          </p>

          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-600 truncate flex-1">
              {message.preview || 'Không có nội dung preview'}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {message.hasAttachments && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  {ICONS.attachment}
                </span>
              )}
              {/* Star button */}
              <button
                onClick={handleStar}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:scale-110 active:scale-95"
                title={message.starred ? 'Bỏ đánh dấu' : 'Đánh dấu sao'}
              >
                {ICONS.star(message.starred)}
              </button>
              {message.starred && (
                <span className="text-amber-400 opacity-100">
                  {ICONS.star(true)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function InboxList({
  messages, loading, polling,
  searchQuery, searchResults, onSearch,
  onOpen, onClear, onMarkAllRead, onStar, unseenCount,
}) {
  const prevCountRef = useRef(0);
  const newIds = useRef(new Set());
  const searchRef = useRef(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'starred'

  // Track newly received messages
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      messages.slice(0, messages.length - prevCountRef.current).forEach((m) => {
        newIds.current.add(m.id);
      });
    }
    prevCountRef.current = messages.length;
    const timer = setTimeout(() => { newIds.current = new Set(); }, 10000);
    return () => clearTimeout(timer);
  }, [messages]);

  // Determine which list to show
  const isSearching = searchQuery && searchQuery.trim().length >= 2;
  let displayMessages = isSearching ? (searchResults || []) : messages;

  // Apply filter (only when not searching)
  if (!isSearching) {
    if (filter === 'unread') displayMessages = displayMessages.filter((m) => !m.seen);
    if (filter === 'starred') displayMessages = displayMessages.filter((m) => m.starred);
  }

  const starredCount = messages.filter((m) => m.starred).length;

  if (loading) {
    return (
      <div className="glass p-12 flex flex-col items-center justify-center gap-3 animate-fade-in">
        <div className="text-kurumi-400">{ICONS.spinner}</div>
        <p className="text-slate-500 text-sm">Đang kết nối hộp thư...</p>
      </div>
    );
  }

  return (
    <div className="glass animate-fade-in">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-white/[0.05]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-200">Hộp thư đến</h2>
            {messages.length > 0 && (
              <span className="bg-dark-600/80 text-slate-400 text-xs px-2 py-0.5 rounded-full">
                {messages.length}
              </span>
            )}
            {polling && (
              <span className="text-slate-700 text-xs">{ICONS.spinner}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unseenCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs text-slate-500 hover:text-kurumi-300 transition-colors px-2 py-1 rounded-lg hover:bg-kurumi-500/10"
                title="Đánh dấu tất cả đã đọc"
              >
                Đọc tất cả
              </button>
            )}
            {messages.length > 0 && (
              <button onClick={onClear} className="btn-ghost text-xs py-1.5">
                Xóa tất cả
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            {ICONS.search}
          </span>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery || ''}
            onChange={(e) => onSearch?.(e.target.value)}
            placeholder="Tìm kiếm email, tiêu đề, người gửi..."
            className="input-field w-full pl-10 pr-9 py-2 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => onSearch?.('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              {ICONS.close}
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        {!isSearching && (
          <div className="flex gap-1">
            {[
              { id: 'all', label: 'Tất cả', count: messages.length },
              { id: 'unread', label: 'Chưa đọc', count: unseenCount },
              { id: 'starred', label: '⭐ Yêu thích', count: starredCount },
            ].map(({ id, label, count }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1
                  ${filter === id
                    ? 'bg-kurumi-600/30 text-kurumi-300 border border-kurumi-500/30'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                  }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    filter === id ? 'bg-kurumi-500/30 text-kurumi-300' : 'bg-white/[0.06] text-slate-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Search status */}
        {isSearching && (
          <p className="text-xs text-slate-500 mt-1">
            {searchResults === null
              ? 'Đang tìm kiếm...'
              : `Tìm thấy ${searchResults.length} kết quả cho "${searchQuery}"`}
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="divide-y divide-white/[0.04] max-h-[520px] overflow-y-auto custom-scroll">
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
            <div className="text-dark-500/60">{ICONS.inbox}</div>
            <div className="text-center">
              {isSearching ? (
                <>
                  <p className="text-slate-500 font-medium">Không tìm thấy kết quả</p>
                  <p className="text-slate-600 text-sm mt-1">Thử từ khóa khác</p>
                </>
              ) : filter !== 'all' ? (
                <>
                  <p className="text-slate-500 font-medium">Không có email {filter === 'unread' ? 'chưa đọc' : 'yêu thích'}</p>
                  <button onClick={() => setFilter('all')} className="text-xs text-kurumi-400 mt-2 hover:underline">
                    Xem tất cả
                  </button>
                </>
              ) : (
                <>
                  <p className="text-slate-500 font-medium">Đang chờ email...</p>
                  <p className="text-slate-600 text-sm mt-1">
                    Chia sẻ địa chỉ trên để nhận email
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-2">
            {displayMessages.map((msg) => (
              <MessageCard
                key={msg.id}
                message={msg}
                onClick={onOpen}
                isNew={newIds.current.has(msg.id)}
                onStar={onStar}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
