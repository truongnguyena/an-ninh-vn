import { useState, useEffect, useRef, useCallback } from 'react';
import { mailboxApi } from '../services/api';

const STORAGE_KEY = 'kurumi_mailbox_v2';
const POLL_INTERVAL = 3000;

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/favicon.ico', silent: false });
    } catch (_) {}
  }
}

export function useMailbox() {
  const [address, setAddress]         = useState(null);
  const [expiresAt, setExpiresAt]     = useState(null);
  const [messages, setMessages]       = useState([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [loading, setLoading]         = useState(false);
  const [polling, setPolling]         = useState(false);
  const [error, setError]             = useState(null);
  const [domains, setDomains]         = useState(['kurumi.vn', 'hopthu.vn', 'mailtam.vn', 'nhanh.vn']);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [serverStatus, setServerStatus] = useState('unknown'); // 'ok' | 'error' | 'unknown'

  const pollRef    = useRef(null);
  const addrRef    = useRef(null);
  const prevCountRef = useRef(0);

  // ─── Fetch domains ──────────────────────────────────────────────────────────
  useEffect(() => {
    mailboxApi.getDomains()
      .then((data) => { if (data.domains?.length) setDomains(data.domains); })
      .catch(() => {});

    // Check server health
    mailboxApi.healthCheck()
      .then(() => setServerStatus('ok'))
      .catch(() => setServerStatus('error'));

    // Request notification permission once
    requestNotificationPermission();
  }, []);

  // ─── Poll messages ──────────────────────────────────────────────────────────
  const poll = useCallback(async (addr) => {
    if (!addr) return;
    try {
      setPolling(true);
      const data = await mailboxApi.getMessages(addr);
      const msgs = data.messages || [];

      // Detect new messages → send notification
      if (msgs.length > prevCountRef.current && prevCountRef.current > 0) {
        const newCount = msgs.length - prevCountRef.current;
        const newest = msgs[0];
        sendNotification(
          `📬 ${newCount} email mới — KurumiMail`,
          newest?.subject || 'Bạn có email mới!'
        );
      }
      prevCountRef.current = msgs.length;

      setMessages(msgs);
      setUnseenCount(data.unseenCount || 0);
      setExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);

      // Renew localStorage with fresh expiresAt
      if (addr && data.expiresAt) {
        try {
          const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...stored,
            expiresAt: data.expiresAt,
          }));
        } catch (_) {}
      }
    } catch (err) {
      if (err.message.includes('404') || err.message.includes('expired')) {
        setError('Hộp thư đã hết hạn. Đang tạo hộp thư mới...');
        clearInterval(pollRef.current);
        localStorage.removeItem(STORAGE_KEY);
        setTimeout(() => generateNew(), 2000);
      }
    } finally {
      setPolling(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPolling = useCallback((addr) => {
    clearInterval(pollRef.current);
    poll(addr);
    pollRef.current = setInterval(() => poll(addr), POLL_INTERVAL);
  }, [poll]);

  // ─── Restore session or create new mailbox ──────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const { address: sa, expiresAt: se } = JSON.parse(stored);
        if (sa && se && new Date(se) > new Date()) {
          setAddress(sa);
          addrRef.current = sa;
          setExpiresAt(new Date(se));
          startPolling(sa);
          return;
        }
      } catch (_) {}
    }
    generateNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const generateNew = useCallback(async (domain = null) => {
    setLoading(true);
    setError(null);
    setSearchQuery('');
    setSearchResults(null);
    prevCountRef.current = 0;
    clearInterval(pollRef.current);
    try {
      const data = await mailboxApi.create(domain || selectedDomain);
      setAddress(data.address);
      addrRef.current = data.address;
      setExpiresAt(new Date(data.expiresAt));
      setMessages([]);
      setUnseenCount(0);
      if (data.domains?.length) setDomains(data.domains);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        address: data.address,
        expiresAt: data.expiresAt,
      }));
      startPolling(data.address);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDomain, startPolling]);

  const setCustomAddress = useCallback(async (local, domain) => {
    if (!local) return;
    setLoading(true);
    setError(null);
    prevCountRef.current = 0;
    clearInterval(pollRef.current);
    try {
      const data = await mailboxApi.create(domain || selectedDomain, local);
      setAddress(data.address);
      addrRef.current = data.address;
      setExpiresAt(new Date(data.expiresAt));
      setMessages([]);
      setUnseenCount(0);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        address: data.address,
        expiresAt: data.expiresAt,
      }));
      startPolling(data.address);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDomain, startPolling]);

  const refresh = useCallback(() => {
    if (addrRef.current) poll(addrRef.current);
  }, [poll]);

  const deleteInbox = useCallback(async () => {
    if (!addrRef.current) return;
    clearInterval(pollRef.current);
    try { await mailboxApi.deleteMailbox(addrRef.current); } catch (_) {}
    localStorage.removeItem(STORAGE_KEY);
    prevCountRef.current = 0;
    setMessages([]);
    setUnseenCount(0);
    setSearchResults(null);
    setSearchQuery('');
    await generateNew();
  }, [generateNew]);

  const clearInbox = useCallback(async () => {
    if (!addrRef.current) return;
    try {
      await mailboxApi.clearMessages(addrRef.current);
      prevCountRef.current = 0;
      setMessages([]);
      setUnseenCount(0);
      setSearchResults(null);
      setSearchQuery('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const extendTime = useCallback(async (minutes = 10) => {
    if (!addrRef.current) return;
    try {
      const data = await mailboxApi.extend(addrRef.current, minutes);
      setExpiresAt(new Date(data.expiresAt));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        address: addrRef.current,
        expiresAt: data.expiresAt,
      }));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const sendTestEmail = useCallback(async (subject, text) => {
    if (!addrRef.current) return;
    try {
      await mailboxApi.sendTest(addrRef.current, subject, text);
      setTimeout(() => poll(addrRef.current), 1000);
    } catch (err) {
      setError(err.message);
    }
  }, [poll]);

  const markAllRead = useCallback(async () => {
    if (!addrRef.current) return;
    try {
      await mailboxApi.markAllRead(addrRef.current);
      setMessages((prev) => prev.map((m) => ({ ...m, seen: true })));
      setUnseenCount(0);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const starMessage = useCallback(async (msgId, starred) => {
    if (!addrRef.current) return;
    try {
      await mailboxApi.starMessage(addrRef.current, msgId, starred);
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, starred } : m)
      );
      if (searchResults) {
        setSearchResults((prev) =>
          prev ? prev.map((m) => m.id === msgId ? { ...m, starred } : m) : prev
        );
      }
    } catch (_) {}
  }, [searchResults]);

  const doSearch = useCallback(async (q) => {
    setSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    if (!addrRef.current) return;
    try {
      const data = await mailboxApi.searchMessages(addrRef.current, q.trim());
      setSearchResults(data.messages || []);
    } catch (_) {
      setSearchResults([]);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    address, expiresAt, messages, unseenCount,
    loading, polling, error, domains, selectedDomain,
    setSelectedDomain,
    searchQuery, setSearchQuery: doSearch,
    searchResults,
    serverStatus,
    refresh, generateNew, deleteInbox, clearInbox,
    extendTime, sendTestEmail, setCustomAddress,
    markAllRead, starMessage, clearError,
  };
}
