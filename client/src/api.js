async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'include', ...options });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || 'Something went wrong. Please try again.');
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  upload: (path, body) => request(path, { method: 'POST', body }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
};
