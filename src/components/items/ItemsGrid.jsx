import { Link } from 'react-router-dom';
import ItemCard from '../ui/ItemCard';
import TierHeading from './TierHeading';

/**
 * Сетка: карточки предметов по тирам, у каждой всплывает подсказка с характеристиками; щелчок открывает страницу предмета.
 * @param {{ groups: Array<{ key: string, cost: number|null, items: object[] }> }} props
 */
function ItemsGrid({ groups }) {
  return (
    <div className="items-groups">
      {groups.map((group) => (
        <section key={group.key} id={`items-tier-${group.key}`} className="items-group">
          <TierHeading sectionKey={group.key} cost={group.cost} count={group.items.length} />
          <div className="items-grid">
            {group.items.map((item) => (
              <Link to={`/items/${item.id}`} key={item.id} className="item-card-link">
                <ItemCard item={item} />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default ItemsGrid;
