const UPSTREAM = {
    assets: "https://assets.deadlock-api.com",
    analytics: "https://api.deadlock-api.com",
  };
  
  export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
  
    const path = req.query.path;
  
    if (!path) {
      return res.status(400).json({
        error: "Missing path parameter",
      });
    }
  
    const parts = path.split("/");
  
    const prefix = parts.shift();
    const rest = parts.join("/");
  
    const targetBase = UPSTREAM[prefix];
  
    if (!targetBase) {
      return res.status(404).json({
        error: `Unknown prefix "${prefix}"`,
      });
    }
  
    const qs = new URLSearchParams();
  
    for (const [k, v] of Object.entries(req.query)) {
      if (k !== "path") {
        qs.append(k, v);
      }
    }
  
    const targetUrl =
      `${targetBase}/${rest}` +
      (qs.toString() ? `?${qs.toString()}` : "");
  
    try {
      const response = await fetch(targetUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "DeadHub/1.0",
        },
      });
  
      const body = await response.text();
  
      res.status(response.status);
  
      res.setHeader(
        "Content-Type",
        response.headers.get("content-type") || "application/json"
      );
  
      return res.send(body);
    } catch (e) {
      return res.status(500).json({
        error: e.message,
      });
    }
  }