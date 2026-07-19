module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  try {
    const { image, config } = req.body || {};
    if (!image || !config) return res.status(400).json({ error: "Photo ou configuration manquante." });
    if (!process.env.REPLICATE_API_TOKEN) return res.status(500).json({ error: "La clé de rendu n’est pas renseignée dans les variables d’environnement." });

    const appliances = Array.isArray(config.electromenager) && config.electromenager.length
      ? config.electromenager.join(", ") : "aucun appareil apparent";

    const prompt = [
      "Photographie d'architecture intérieure photoréaliste.",
      "Conserver exactement la pièce de référence : murs, sol, plafond, fenêtre, luminosité naturelle, perspective et angle de caméra.",
      "SUPPRIMER ENTIÈREMENT toute la cuisine existante, tous ses meubles, ses appareils et son ancienne implantation.",
      "Construire à la place une NOUVELLE cuisine sur mesure indépendante, pas une recolorisation de l'ancienne cuisine.",
      `Implantation : cuisine ${config.implantation}, mur principal ${config.mur1} cm${config.mur2 ? `, second mur ${config.mur2} cm` : ""}${config.mur3 ? `, troisième mur ${config.mur3} cm` : ""}.`,
      `Caissons standards mélaminé 19 mm, avec fileurs contre les murs et joues de finition aux extrémités ouvertes.`,
      `Façades ${config.facades}; plan de travail ${config.planTravail}; poignées ${config.poignees}, finition ${config.couleurPoignees}.`,
      config.meublesHauts ? "Inclure des meubles hauts élégants et proportionnés." : "Ne pas inclure de meubles hauts.",
      `Électroménager à intégrer : ${appliances}.`,
      "Volumes cohérents, rangements crédibles, matériaux réalistes, ombres et reflets naturels. Aucun texte, aucune interface, aucune illustration, aucune cuisine ancienne visible."
    ].join(" ");

    const start = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        "Prefer": "wait=55"
      },
      body: JSON.stringify({
        input: {
          prompt,
          input_image: image,
          aspect_ratio: "match_input_image",
          output_format: "jpg",
          safety_tolerance: 2,
          prompt_upsampling: false
        }
      })
    });

    const prediction = await start.json();
    if (!start.ok) return res.status(start.status).json({ error: prediction.detail || prediction.error || "Le moteur de rendu a refusé la demande." });

    const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (!output) {
      return res.status(504).json({ error: "Le rendu prend plus de temps que prévu. Réessayez dans un instant." });
    }
    return res.status(200).json({ imageUrl: output });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Erreur de génération." });
  }
};
