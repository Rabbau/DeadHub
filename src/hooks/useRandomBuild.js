import { useState, useCallback } from 'react'
import { useHeroStore } from '../store/heroStore.js'
import { fetchItems } from '../api/index.js'
import { pickRandomHero, pickRandomItems } from '../services/heroService.js'

export function useRandomBuild() {
  const { heroes } = useHeroStore()
  const [build, setBuild] = useState(null)
  const [loading, setLoading] = useState(false)

  const generate = useCallback(async () => {
    if (!heroes.length) return
    setLoading(true)
    try {
      const hero = pickRandomHero(heroes)
      const allItems = await fetchItems()
      const items = pickRandomItems(allItems, 4)
      setBuild({ hero, items, generatedAt: Date.now() })
    } finally {
      setLoading(false)
    }
  }, [heroes])

  return { build, loading, generate }
}