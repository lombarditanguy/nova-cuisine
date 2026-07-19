export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: "La variable REPLICATE_API_TOKEN n’est pas configurée dans les variables d’environnement."
    });
  }

  try {
    const { image, config } = req.body || {};
    if (!image || !config) {
      return res.status(400).json({ error: "Photo ou configuration manquante." });
    }

    const prompt = buildPrompt(config);

    const upstream = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Prefer": "wait=5"
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
      }
    );

    const raw = await upstream.text();
    let prediction;
    try {
      prediction = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        error: `Réponse invalide du moteur de rendu (HTTP ${upstream.status}) : ${raw.slice(0, 300)}`
      });
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: prediction.detail || prediction.error || prediction.title ||
          `Le moteur de rendu a refusé la demande (HTTP ${upstream.status}).`
      });
    }

    const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output || null;
    return res.status(200).json({
      id: prediction.id,
      status: prediction.status,
      imageUrl: output
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Erreur serveur lors du lancement du rendu." });
  }
}

function buildPrompt(config) {
  const appliances = Array.isArray(config.appliances) && config.appliances.length
    ? config.appliances.join(", ")
    : "none";

  const walls = [
    config.wall1 ? `main wall ${config.wall1} cm` : "",
    config.wall2 ? `second wall ${config.wall2} cm` : "",
    config.wall3 ? `third wall ${config.wall3} cm` : ""
  ].filter(Boolean).join(", ");

  const noHandles = /push|sans poignée/i.test(config.handleType || "") || /sans poignée/i.test(config.doorStyle || "");

  const island = config.island
    ? `Add a freestanding kitchen island, ${config.island.width || 140} by ${config.island.depth || 90} cm, matching the same cabinet fronts and worktop.${
        config.island.feature && config.island.feature !== "Aucun" ? ` The island includes an integrated ${config.island.feature}.` : ""
      }${config.island.seating ? " Add a bar overhang with counter-height seating on one side." : ""}`
    : "Do not add any kitchen island; keep the floor space open.";

  const corner = config.corner
    ? `Corner cabinet solution: ${config.corner}.`
    : "";

  const lighting = config.lighting && (config.lighting.spots || config.lighting.led)
    ? [
        config.lighting.spots ? "Add recessed spotlights under the upper wall cabinets." : "",
        config.lighting.led ? "Add a warm LED light strip along the underside of the worktop illuminating the backsplash." : ""
      ].filter(Boolean).join(" ")
    : "Do not add extra light fixtures beyond the room's existing natural and ambient light.";

  const lines = [
    "This is a precise photo edit of the exact reference photo provided, not a new scene: same room, same photo, same camera angle and framing, same distance and lens perspective.",
    "Keep 100% identical and pixel-accurate, exactly as in the reference photo, in shape, color, material and position: the floor (same material, color and pattern), every wall (same color and texture), the ceiling, every window (same size, position and frame), every door, and any technical or fixed equipment visible such as a boiler, water heater, radiator, thermostat, electrical panel, meter box, light switch, socket, pipe or vent.",
    "The only thing allowed to change in the whole photo is the kitchen furniture itself: remove the existing kitchen cabinets, worktop, kitchen appliances, kitchen backsplash and any freestanding kitchen table or chairs, and replace them with the new made-to-measure kitchen described below. Do not remove, move, resize, recolor or redesign anything else in the room — no window, no door, no boiler, no radiator, no floor, no wall.",
    "Do not simply recolor, repaint or restyle the existing kitchen furniture — rebuild it entirely as a newly built kitchen, while leaving every other element of the room untouched.",
    `Kitchen layout: ${config.layout || "linear"}${walls ? `, ${walls}` : ""}.`,
    corner,
    island,
    `Cabinet fronts: ${config.doorStyle || "flat"} style, ${config.facades || "matte white"} finish.`,
    `Worktop: ${config.worktop || "white quartz"}.`,
    `Backsplash: ${config.credence || "matching the worktop"}.`,
    noHandles
      ? "Cabinet fronts have no visible handles, push-to-open mechanism, perfectly flush and seamless."
      : `Handles: ${config.handleType || "bar handles"} in ${config.handleColor || "black"} finish, consistent on every cabinet.`,
    `Plinth (kickboard): ${config.plinth || "matching the cabinet fronts"}.`,
    config.upperCabinets ? "Include new upper wall cabinets fitted to the ceiling height, without covering any window." : "Do not include upper wall cabinets, keep the wall above the worktop open.",
    `Integrated appliances to include: ${appliances}.`,
    `Sink: ${config.sink || "stainless steel undermount"}. Faucet finish: ${config.faucet || "matte black"}.`,
    lighting,
    "Use standard 19 mm melamine cabinet carcasses, filler panels against walls and finished end panels on exposed sides, fitted around any window, door, boiler or radiator exactly where it already is.",
    "Respect real construction scale, realistic joins, shadows, reflections and natural perspective — the kitchen must look physically built in this exact room, not pasted on.",
    "Photorealistic single wide shot of the whole kitchen, professional interior photography, natural color grading. No collage, no split screen, no before/after comparison, no grid of images, no text, no logo, no watermark, no interface, no people, no pets.",
    "Final check before rendering: the floor, walls, ceiling, windows, doors, and any boiler, radiator or other technical equipment must remain exactly as in the original photo — only the kitchen furniture has changed."
  ].filter(Boolean);

  return lines.join(" ");
}
