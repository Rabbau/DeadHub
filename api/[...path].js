/**
 * Vercel Serverless Function (CommonJS) — CORS proxy для Deadlock API.
 *
 * ВАЖНО: файл должен быть CommonJS (module.exports), НЕ ESM (export default),
 * потому что Vercel Serverless Functions не поддерживают ES modules в .js файлах
 * даже если package.json содержит "type": "module".
 *
 * Маппинг:
 *   GET /api/assets/v2/heroes         → https://assets.deadlock-api.com/v2/heroes
 *   GET /api/analytics/v1/analytics/… → https://api.deadlock-api.com/v1/analytics/…
 *
 * При переходе на Python-бэкенд: удалить этот файл целиком,
 * поставить VITE_API_MODE=backend и VITE_BACKEND_URL в Vercel Environment Variables.
 */

const UPSTREAM = {
  assets:    'https://assets.deadlock-api.com',
  analytics: 'https://api.deadlock-api.com',
}

export default async function handler(req, res) {
  // CORS
    console.log("URL:", req.url);
    console.log("QUERY:", req.query);

    res.status(200).json({
        url: req.url,
        query: req.query
      });
    

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  // path сегменты: /api/assets/v2/heroes → ['assets','v2','heroes']
  let segments = req.query.path || []
  if (!Array.isArray(segments)) segments = [segments]

  const prefix = segments[0]
  const rest   = segments.slice(1).join('/')

  const targetBase = UPSTREAM[prefix]
  if (!targetBase) {
    res.status(404).json({ error: `Unknown prefix "${prefix}"`, received: segments })
    return
  }

  // Собираем query string (без служебного параметра "path")
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== 'path') qs.append(k, v)
  }
  const qsStr = qs.toString()
  const targetUrl = `${targetBase}/${rest}${qsStr ? '?' + qsStr : ''}`

  try {
    const upstream = await fetch(targetUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'DeadHub/1.0' },
    })

    const body = await upstream.text()

    if (!upstream.ok) {
      console.error(`[proxy] ${upstream.status} from ${targetUrl}`)
      res.status(upstream.status).json({
        error: `Upstream ${upstream.status}`,
        upstream_url: targetUrl,
      })
      return
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600')
    res.status(200).send(body)

  } catch (err) {
    console.error('[proxy] fetch error:', err.message, '→', targetUrl)
    res.status(500).json({ error: err.message, upstream_url: targetUrl })
  }
}
