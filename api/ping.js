// Простой хелс-чек: GET /api/ping
// Используй для проверки что Serverless Functions вообще работают
module.exports = function handler(req, res) {
  res.status(200).json({ ok: true, ts: Date.now() })
}
