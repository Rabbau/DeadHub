import NewHeroes from '../components/hero/NewHeroes'
import HomeHero from '../components/home/HomeHero'
import HomeNow from '../components/home/HomeNow'
import HomeSections from '../components/home/HomeSections'
import { useMetaDashboard } from '../hooks/useMetaDashboard'
import { usePageMeta } from '../hooks/usePageMeta'

/**
 * Главная (адрес /): что это за сайт и куда идти. Баннер с поиском, полоса новых героев, срез меты «сейчас»
 * и плитки всех разделов. Данных нужно столько же, сколько списку героев, за вычетом сравнения с прошлым периодом:
 * список героев и статистика общие со страницами «Герои» и «Мета» и берутся из одного кеша.
 * Сам список героев переехал на /heroes (HeroesPage).
 */
function HomePage() {
  const dashboard = useMetaDashboard({ withDeltas: false })
  usePageMeta('home')

  return (
    <div className="page home">
      <HomeHero />
      <NewHeroes heroes={dashboard.allHeroes} />
      <HomeNow dashboard={dashboard} />
      <HomeSections />
    </div>
  )
}

export default HomePage
