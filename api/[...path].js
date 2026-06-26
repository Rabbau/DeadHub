// api/[...path].js
export default async function handler(req, res) {
    // Получаем путь после /api/
    const { path } = req.query;
    let joinedPath = Array.isArray(path) ? path.join('/') : path || '';
  
    // Определяем базовый URL в зависимости от префикса
    let targetBase;
    if (joinedPath.startsWith('assets/')) {
      targetBase = 'https://assets.deadlock-api.com';
      joinedPath = joinedPath.slice(7); // убираем 'assets/'
    } else if (joinedPath.startsWith('analytics/')) {
      targetBase = 'https://api.deadlock-api.com';
      joinedPath = joinedPath.slice(10); // убираем 'analytics/'
    } else {
      res.status(404).json({ error: 'Not found' });
      return;
    }
  
    // Собираем целевой URL
    const targetUrl = `${targetBase}/${joinedPath}`;
    const url = new URL(targetUrl);
  
    // Переносим query-параметры (кроме 'path')
    Object.keys(req.query).forEach(key => {
      if (key !== 'path') {
        url.searchParams.append(key, req.query[key]);
      }
    });
  
    try {
      const response = await fetch(url.toString());
      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }