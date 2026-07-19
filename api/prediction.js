export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const { id } = req.query;
  const token = process.env.REPLICATE_API_TOKEN;

  if (!id) return res.status(400).json({ error: "Identifiant de rendu manquant." });
  if (!token) return res.status(500).json({ error: "La variable REPLICATE_API_TOKEN n’est pas configurée." });

  try {
    const upstream = await fetch(
      `https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`,
      { headers: { "Authorization": `Bearer ${token}` } }
    );

    const raw = await upstream.text();
    let prediction;
    try {
      prediction = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: `Réponse de suivi invalide (HTTP ${upstream.status}).` });
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: prediction.detail || prediction.error || prediction.title || "Impossible de suivre le rendu."
      });
    }

    const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output || null;
    return res.status(200).json({
      status: prediction.status,
      imageUrl: output,
      error: prediction.error || null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Erreur lors du suivi du rendu." });
  }
}
