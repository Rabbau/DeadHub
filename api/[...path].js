// api/[...path].js

export default async function handler(req, res) {
    // Разбираем URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // Получаем путь после /api/
    // req.query.path — это массив из-за динамического роутинга [...path]
    let pathSegments = req.query.path || [];
    if (!Array.isArray(pathSegments)) pathSegments = [pathSegments];
    const joinedPath = pathSegments.join('/');
  
    // Определяем целевой хост
    let targetBase;
    if (joinedPath.startsWith('assets/')) {
      targetBase = 'https://assets.deadlock-api.com';
    } else if (joinedPath.startsWith('analytics/')) {
      targetBase = 'https://api.deadlock-api.com';
    } else {
      res.status(404).json({ error: 'Unknown API route' });
      return;
    }
  
    // Убираем префикс (assets/ или analytics/)
    const cleanPath = joinedPath.replace(/^(assets|analytics)\//, '');
    
    // Строим целевой URL
    const targetUrl = new URL(cleanPath, targetBase);
  
    // Копируем все query-параметры (кроме path)
    url.searchParams.forEach((value, key) => {
      if (key !== 'path') {
        targetUrl.searchParams.append(key, value);
      }
    });
  
    try {
      const response = await fetch(targetUrl.toString());
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }