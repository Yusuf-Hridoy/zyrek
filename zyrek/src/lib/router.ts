import { useEffect, useState } from 'react'

export type Route =
  | { view: 'assay' }
  | { view: 'pipeline' }
  | { view: 'app'; id: string }
  | { view: 'insights' }
  | { view: 'settings' }

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '')
  if (h === '' || h === '/') return { view: 'assay' }
  if (h === '/pipeline') return { view: 'pipeline' }
  if (h === '/insights') return { view: 'insights' }
  if (h === '/settings') return { view: 'settings' }
  const m = h.match(/^\/app\/(.+)$/)
  if (m) return { view: 'app', id: decodeURIComponent(m[1]) }
  return { view: 'assay' }
}

export function routeToHash(r: Route): string {
  switch (r.view) {
    case 'assay':
      return '#/'
    case 'pipeline':
      return '#/pipeline'
    case 'insights':
      return '#/insights'
    case 'settings':
      return '#/settings'
    case 'app':
      return `#/app/${encodeURIComponent(r.id)}`
  }
}

export function navigate(r: Route): void {
  window.location.hash = routeToHash(r)
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
