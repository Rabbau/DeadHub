import NewHeroes from '../components/hero/NewHeroes'
import HomeBanner from '../components/home/HomeBanner'
import HomeNow from '../components/home/HomeNow'
import HomeSections from '../components/home/HomeSections'
import HomeTiles from '../components/home/HomeTiles'
import { useMetaDashboard } from '../hooks/useMetaDashboard'
import { usePageMeta } from '../hooks/usePageMeta'

/**
 * Главная (адрес /): что это за сайт и куда идти. Баннер обновления во всю ширину, под ним полоса новых героев,
 * витрина инструментов плитками, срез меты «сейчас» и оглавление. Данных нужно столько же, сколько списку героев,
 * за вычетом сравнения с прошлым периодом: список героев и статистика общие со страницами «Герои» и «Мета»
 * и берутся из одного кеша. Сам список героев переехал на /heroes (HeroesPage).
 */
function HomePage() {
  const dashboard = useMetaDashboard({ withDeltas: false })
  usePageMeta('home')

  return (
    <div className="home">
      <HomeBanner />
      <div className="page home__body">
        <NewHeroes heroes={dashboard.allHeroes} />
        <HomeTiles dashboard={dashboard} />
        <HomeNow dashboard={dashboard} />
        <HomeSections />
      </div>
    </div>
  )
}

export default HomePage
