export function normalizeApiPath(requestUrl = '/') {
  const [pathname, query = ''] = requestUrl.split('?', 2);
  const normalizedPathname = pathname === '/api' || pathname.startsWith('/api/')
    ? pathname
    : `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  return query ? `${normalizedPathname}?${query}` : normalizedPathname;
}
