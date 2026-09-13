export function buildExpressRequestUrl(requestUrl = '/') {
  const url = new URL(requestUrl, 'http://localhost');
  const path = url.searchParams.get('path') || '';

  url.searchParams.delete('path');
  const query = url.searchParams.toString();
  const normalizedPath = path.replace(/^\/+/, '');
  const apiPath = normalizedPath ? `/api/${normalizedPath}` : '/api';

  return query ? `${apiPath}?${query}` : apiPath;
}
