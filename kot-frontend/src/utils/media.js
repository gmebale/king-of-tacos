const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export function resolveMediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const input = value.trim();
  const isAbsolute = /^https?:\/\//i.test(input);
  let pathname = input;
  let originalUrl = null;
  if (isAbsolute) {
    try {
      originalUrl = new URL(input);
      pathname = originalUrl.pathname;
    } catch (_error) {
      return input;
    }
  }

  if (pathname.startsWith('/uploads/')) pathname = `/api${pathname}`;
  if (pathname.startsWith('/api/uploads/')) {
    try {
      return new URL(pathname, API_BASE_URL).toString();
    } catch (_error) {
      return pathname;
    }
  }

  if (originalUrl && typeof window !== 'undefined' && window.location.protocol === 'https:' && originalUrl.protocol === 'http:' && originalUrl.host === window.location.host) {
    originalUrl.protocol = 'https:';
    return originalUrl.toString();
  }
  return input;
}
