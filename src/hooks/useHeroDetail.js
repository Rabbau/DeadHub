import { useState, useEffect } from 'react'
import { fetchHeroDetail, fetchItemsByHero } from '../api/index.js'

export function useHeroDetail(id) {
  const [hero, setHero] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)

    Promise.allSettled([
      fetchHeroDetail(id),
      fetchItemsByHero(id),
    ]).then(([heroRes, itemsRes]) => {
      if (heroRes.status === 'fulfilled') setHero(heroRes.value)
      else setError(heroRes.reason?.message ?? 'Failed to load hero')
      if (itemsRes.status === 'fulfilled') setItems(itemsRes.value)
      setLoading(false)
    })
  }, [id])

  return { hero, items, loading, error }
}