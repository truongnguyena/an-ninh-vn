import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message =
      err.response?.data?.error ||
      err.message ||
      'Network error';
    return Promise.reject(new Error(message));
  }
);

export const mailboxApi = {
  /** Health check */
  healthCheck: () => api.get('/health'),

  /** Create or retrieve a mailbox */
  create: (domain = null, local = null, ttlMinutes = null) =>
    api.post('/mailbox', { domain, local, ...(ttlMinutes ? { ttlMinutes } : {}) }),

  /** Get all messages (list view) */
  getMessages: (address) =>
    api.get(`/mailbox/${encodeURIComponent(address)}`),

  /** Get single message (full content) */
  getMessage: (address, id) =>
    api.get(`/mailbox/${encodeURIComponent(address)}/${id}`),

  /** Search messages */
  searchMessages: (address, q) =>
    api.get(`/mailbox/${encodeURIComponent(address)}/search`, { params: { q } }),

  /** Delete entire mailbox */
  deleteMailbox: (address) =>
    api.delete(`/mailbox/${encodeURIComponent(address)}`),

  /** Clear all messages */
  clearMessages: (address) =>
    api.delete(`/mailbox/${encodeURIComponent(address)}/messages`),

  /** Extend TTL */
  extend: (address, minutes = 10) =>
    api.put(`/mailbox/${encodeURIComponent(address)}/extend`, { minutes }),

  /** Mark all messages as read */
  markAllRead: (address) =>
    api.put(`/mailbox/${encodeURIComponent(address)}/read-all`),

  /** Star or unstar a message */
  starMessage: (address, id, starred) =>
    api.put(`/mailbox/${encodeURIComponent(address)}/${id}/star`, { starred }),

  /** Register webhook */
  setWebhook: (address, url) =>
    api.post(`/mailbox/${encodeURIComponent(address)}/webhook`, { url }),

  /** Send test email */
  sendTest: (to, subject, text) =>
    api.post('/mailbox/test/send', { to, subject, text }),

  /** Get supported domains */
  getDomains: () => api.get('/mailbox/domains/list'),

  /** Download .eml URL */
  emlUrl: (address, msgId) =>
    `/api/mailbox/${encodeURIComponent(address)}/${msgId}/eml`,

  /** Attachment URL builder */
  attachmentUrl: (address, msgId, index) =>
    `/api/mailbox/${encodeURIComponent(address)}/${msgId}/attachment/${index}`,
};

// Developer API client
export const developerApi = {
  createKey: (name, email) =>
    api.post('/developer/keys', { name, email }),

  getKey: (key) =>
    api.get(`/developer/keys/${key}`),

  revokeKey: (key) =>
    api.delete(`/developer/keys/${key}`),

  getDocs: () =>
    api.get('/developer/docs'),
};

export default api;
