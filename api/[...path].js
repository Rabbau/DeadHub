/**
 * Vercel Serverless Function — CORS proxy для Deadlock API.
 *
 * Маппинг путей:
 *   /api/assets/v2/heroes     → https://assets.deadlock-api.com/v2/heroes
 *   /api/analytics/v1/...     → https://api.deadlock-api.com/v1/...
 *
 * Почему нужен прокси:
 *   assets.deadlock-api.com не отдаёт CORS-заголовки для браузера,
 *   поэтому все запросы идут через эту функцию на Vercel.
 *
 * При переходе на Python-бэкенд этот файл удаляется полностью —
 * фронт будет ходить напрямую на FastAPI.
 */

export default async function handler(req, res) {
  // CORS — разрешаем все origin для публичного API
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // req.query.path — массив сегментов после /api/
  // Например: /api/assets/v2/heroes → ['assets', 'v2', 'heroes']
  let pathSegments = req.query.path || []
  if (!Array.isArray(pathSegments)) pathSegments = [pathSegments]

  if (pathSegments.length === 0) {
    res.status(400).json({ error: 'No path provided' })
    return
  }

  const prefix = pathSegments[0] // 'assets' | 'analytics'
  const restSegments = pathSegments.slice(1) // всё после префикса

  // Определяем целевой хост по первому сегменту пути
  let targetBase
  if (prefix === 'assets') {
    targetBase = 'https://assets.deadlock-api.com'
  } else if (prefix === 'analytics') {
    targetBase = 'https://api.deadlock-api.com'
  } else {
    res.status(404).json({ error: `Unknown API prefix: "${prefix}"` })
    return
  }

  // Строим целевой URL
  const targetPath = restSegments.join('/')
  const targetUrl = new URL(targetPath, targetBase + '/')

  // Прокидываем все query-параметры кроме служебного "path"
  const incomingUrl = new URL(req.url, `http://${req.headers.host}`)
  incomingUrl.searchParams.forEach((value, key) => {
    if (key !== 'path') targetUrl.searchParams.append(key, value)
  })

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DeadHub/1.0',
      },
    })

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: `Upstream returned ${upstream.status}`,
        url: targetUrl.toString(),
      })
      return
    }

    const data = await upstream.json()
    
    // Кешируем на 1 час на CDN-уровне Vercel
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600')
    res.status(200).json(data)

  } catch (error) {
    console.error('Proxy error:', error.message, '→', targetUrl.toString())
    res.status(500).json({ error: error.message, url: targetUrl.toString() })
  }
}
