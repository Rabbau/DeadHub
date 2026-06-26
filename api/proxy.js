export const config = {
  runtime: 'edge',
}

const UPSTREAM = {
  assets: 'https://assets.deadlock-api.com',
  analytics: 'https://api.deadlock-api.com',
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path') || ''

  const parts = path.split('/')
  const prefix = parts.shift()
  const rest = parts.join('/')

  const targetBase = UPSTREAM[prefix]
  if (!targetBase) {
    return new Response(JSON.stringify({ error: `Unknown prefix "${prefix}"` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const qs = new URLSearchParams()
  searchParams.forEach((v, k) => { if (k !== 'path') qs.append(k, v) })
  const targetUrl = `${targetBase}/${rest}${qs.toString() ? '?' + qs.toString() : ''}`

  const upstream = await fetch(targetUrl, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'DeadHub/1.0' },
  })

  const body = await upstream.text()

  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 's-maxage=3600',
    },
  })
}