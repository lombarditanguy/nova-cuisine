const REPLICATE_API = "https://api.replicate.com/v1";

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  const token = process.env.REPLICATE_API_TOKEN;
  const model = process.env.REPLICATE_MODEL || "black-forest-labs/flux-kontext-pro";
  if (!token) return res.status(500).json({ error: "La variable REPLICATE_API_TOKEN n'est pas configurée dans les paramètres du projet." });

  try {
    const { image, brief } = req.body || {};
    if (!image || !brief) return res.status(400).json({ error: "Photo ou paramètres de cuisine manquants." });

    const walls = brief.layout === "Linéaire" ? `${brief.lengths[0]} cm` :
      brief.layout === "En L" ? `${brief.lengths[0]} cm et ${brief.lengths[1]} cm` :
      `${brief.lengths[0]} cm, ${brief.lengths[1]} cm et ${brief.lengths[2]} cm`;

    const prompt = `Retouche intérieure photoréaliste de haute qualité à partir de l'image de référence. Conserver exactement la pièce, le cadrage, la géométrie, les murs, les ouvertures, le sol et la lumière. Remplacer uniquement la cuisine existante par une cuisine ${brief.layout}, adaptée précisément à la perspective : murs ${walls}; caissons standard en mélaminé 19 mm avec fileurs contre les murs et joues de finition aux extrémités libres; façades ${brief.front}; plan de travail ${brief.worktop}; poignées ${brief.handle} couleur ${brief.handleColor}; ${brief.upperCabinets ? "meubles hauts inclus" : "sans meubles hauts"}; électroménager ${brief.appliances.join(", ") || "non visible"}. Rénovation réaliste, proportions exactes, matériaux et ombres cohérents. Sans texte, sans interface, sans dessin, sans changement de point de vue.`;

    const create = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "wait=60" },
      body: JSON.stringify({ input: { prompt, input_image: image } })
    });
    let prediction = await create.json();
    if (!create.ok) throw new Error(prediction.detail || prediction.title || "Le moteur de rendu a refusé la demande.");

    const deadline = Date.now() + 110000;
    while (!["succeeded", "failed", "canceled"].includes(prediction.status) && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2500));
      const poll = await fetch(prediction.urls.get, { headers: { "Authorization": `Bearer ${token}` } });
      prediction = await poll.json();
    }
    if (prediction.status !== "succeeded") throw new Error(prediction.error || "Le rendu n'a pas été finalisé à temps.");
    const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (!output) throw new Error("Le moteur n'a renvoyé aucune image.");
    res.status(200).json({ output });
  } catch (error) {
    res.status(500).json({ error: error.message || "Erreur pendant la génération." });
  }
};
