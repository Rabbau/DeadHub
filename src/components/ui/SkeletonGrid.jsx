export default function SkeletonGrid({ type = 'hero', count = 12 }) {
    const items = Array.from({ length: count });
  
    if (type === 'item') {
      return (
        <div className="items-grid">
          {items.map((_, i) => (
            <div key={i} className="skeleton-item-card">
              <div className="skeleton skeleton-item-card__img" />
              <div className="skeleton skeleton-item-card__name" />
            </div>
          ))}
        </div>
      );
    }
  
    return (
      <div className="hero-grid">
        {items.map((_, i) => (
          <div key={i} className="skeleton-hero-card">
            <div className="skeleton skeleton-hero-card__img" />
            <div className="skeleton-hero-card__body">
              <div className="skeleton skeleton-hero-card__name" />
              <div className="skeleton-hero-card__stats">
                <div className="skeleton skeleton-hero-card__stat" />
                <div className="skeleton skeleton-hero-card__stat" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }