export default {
  async fetch(request) {
    const headers = { "content-type": "application/json; charset=utf-8" };

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Méthode non autorisée." }), { status: 405, headers });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ error: "La variable REPLICATE_API_TOKEN n’est pas configurée dans Vercel." }), { status: 500, headers });
    }

    try {
      const { image, config } = await request.json();
      if (!image || !config) {
        return new Response(JSON.stringify({ error: "Photo ou configuration manquante." }), { status: 400, headers });
      }

      const appliances = Array.isArray(config.appliances) && config.appliances.length
        ? config.appliances.join(", ")
        : "aucun appareil visible supplémentaire";

      const walls = [
        config.wall1 ? `mur principal ${config.wall1} cm` : "",
        config.wall2 ? `second mur ${config.wall2} cm` : "",
        config.wall3 ? `troisième mur ${config.wall3} cm` : ""
      ].filter(Boolean).join(", ");

      const prompt = [
        "Photorealistic interior renovation photograph.",
        "Preserve the room shell exactly: camera angle, perspective, walls, windows, ceiling, floor and natural lighting.",
        "First remove and discard every existing kitchen cabinet, worktop, appliance, backsplash and table from the photo.",
        "Do not recolor, repaint, restyle or reuse the existing kitchen. Build a completely new made-to-measure kitchen from scratch.",
        `New layout: ${config.layout || "linear"}, ${walls}.`,
        `New finishes: ${config.facades || "mat white"} cabinet fronts, ${config.worktop || "white quartz"} worktop, ${config.handleType || "bar"} handles in ${config.handleColor || "black"} finish.`,
        `${config.upperCabinets ? "Include new upper wall cabinets." : "Do not include upper wall cabinets."}`,
        `Include only these integrated appliances when appropriate: ${appliances}.`,
        "Use standard 19 mm melamine carcasses, filler panels against walls and finished end panels on exposed sides.",
        "Professional high-end kitchen design, physically credible scale, joins, shadows and reflections. No text, no labels, no UI."
      ].join(" ");

      const upstream = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
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

      const prediction = await upstream.json();
      if (!upstream.ok) {
        return new Response(JSON.stringify({ error: prediction.detail || prediction.error || "La génération n’a pas pu démarrer." }), { status: upstream.status, headers });
      }

      return new Response(JSON.stringify({
        id: prediction.id,
        status: prediction.status,
        imageUrl: Array.isArray(prediction.output) ? prediction.output[0] : prediction.output || null
      }), { status: 200, headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message || "Erreur serveur." }), { status: 500, headers });
    }
  }
};
