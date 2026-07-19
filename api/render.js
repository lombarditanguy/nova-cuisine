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
  const applianceList = Array.isArray(config.appliances) ? config.appliances.filter(Boolean) : [];

  const walls = [
    config.wall1 ? `main wall ${config.wall1} cm` : "",
    config.wall2 ? `second wall ${config.wall2} cm` : "",
    config.wall3 ? `third wall ${config.wall3} cm` : ""
  ].filter(Boolean).join(", ");

  const noHandles = /push|sans poignée/i.test(config.handleType || "") || /sans poignée/i.test(config.doorStyle || "");
  const handleDescriptor = noHandles
    ? "no visible handles or knobs anywhere: push-to-open fronts, perfectly flush and seamless"
    : /bouton/i.test(config.handleType || "")
    ? `small round KNOBS only — one compact individual round knob per door and drawer, absolutely NOT a long bar handle — in ${config.handleColor || "black"} finish`
    : `long bar/pull HANDLES only — a single straight bar mounted on each door and drawer, absolutely NOT small round knobs — in ${config.handleColor || "black"} finish`;

  const upperLine = config.upperCabinets
    ? "Mandatory, do not skip: include upper wall cabinets above the worktop, running along the same wall as the base cabinets, matching the same door style and finish, fitted up to near ceiling height. The kitchen is incomplete and WRONG if these upper cabinets are missing from the final image — they must be clearly visible."
    : "Do not include any upper wall cabinets — leave the entire wall above the worktop bare, showing only the wall finish.";

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

  const wallSideText = {
    left: "the wall visible on the LEFT side of the photo, as framed by the camera",
    right: "the wall visible on the RIGHT side of the photo, as framed by the camera",
    center: "the back wall, centered in the photo and facing the camera"
  }[config.wallSide] || null;

  const layoutValue = config.layout || "linéaire";
  const layoutConstraint = /linéaire|linear/i.test(layoutValue)
    ? `This is a strictly single-wall (linear) kitchen, like a single straight sideboard: one flat, straight run of cabinets with NO bend, NO corner and NO angle anywhere in it, placed along ONE wall only${wallSideText ? ` — specifically along ${wallSideText}` : ""}. IMPORTANT: even if the existing kitchen counter in the reference photo currently wraps around a corner in an L shape, you must NOT reproduce that L-shaped footprint — the new linear kitchen stops at the corner. Every other wall visible in the photo, including the corner and any adjacent wall, must end up completely bare (only wall tiles or paint visible, no counter, no cabinet, no worktop, no appliance at all on that other wall).`
    : /en l\b/i.test(layoutValue)
    ? "This is an L-shaped kitchen across exactly two adjoining walls meeting at a right angle. Do not add cabinetry to any third wall."
    : /en u\b/i.test(layoutValue)
    ? "This is a U-shaped kitchen across exactly three walls. Do not extend cabinetry beyond these three walls."
    : "";

  const hasDishwasher = applianceList.some(a => /lave.vaisselle/i.test(a));
  const dishwasherLine = hasDishwasher
    ? "The dishwasher is fully integrated (encastré): it is hidden behind a decor door panel that exactly matches the surrounding cabinet fronts in color, material and style — no visible white or stainless appliance face, no visible control panel, it must look like a normal cabinet door."
    : "";

  const hasOven = applianceList.some(a => /four/i.test(a));
  const hasHob = applianceList.some(a => /plaque/i.test(a));
  const rangeConfusionLine = hasOven && hasHob
    ? "The oven and the hob are two separate, physically distinct built-in appliances in two different locations: the oven is built into a tall cabinet column (or under the worktop only if there is no column space), and the hob is a separate flush cooktop set into the worktop, well away from the oven. Never merge them into a single freestanding range/cooker (gazinière) unit with an oven door directly below exposed burners."
    : "";
  const hobTypeLine = hasHob
    ? "The hob (plaque de cuisson) is a flush induction cooktop: a smooth glass-ceramic surface sitting perfectly flat with the worktop, with no visible flame, no gas burners, no cast-iron grates and no control knobs."
    : "";

  const appliancesLine = applianceList.length
    ? `Integrated appliances to include, exactly one of each, never duplicated: ${applianceList.join(", ")}.`
    : "No integrated appliances beyond what is strictly necessary.";

  const notes = typeof config.notes === "string" ? config.notes.trim().slice(0, 500) : "";
  const notesLine = notes
    ? `Additional client instructions specific to this room — follow them precisely and let them override any conflicting instruction above: ${notes}.`
    : "";

  const lines = [
    "This is a precise photo edit of the exact reference photo provided, not a new scene: same room, same photo, same camera angle and framing, same distance and lens perspective.",
    "Keep 100% identical and pixel-accurate, exactly as in the reference photo, in shape, color, material and position: the floor (same material, color and pattern), every wall (same color and texture), the ceiling, every window (same size, position and frame), and any technical or fixed equipment visible such as a boiler, water heater, radiator, thermostat, electrical panel, meter box, light switch, socket, pipe or vent.",
    "Every door must keep exactly the same type, height, width, position and opening mechanism as in the reference photo — including any full-height glazed door, French door, sliding door, porte-fenêtre or balcony door. Never convert a door into a smaller window, and never convert a window into a door.",
    "The only thing allowed to change in the whole photo is the kitchen furniture itself: remove the existing kitchen cabinets, worktop, kitchen appliances, kitchen backsplash and any freestanding kitchen table or chairs, and replace them with the new made-to-measure kitchen described below. Do not remove, move, resize, recolor or redesign anything else in the room — no window, no door, no boiler, no radiator, no floor, no wall.",
    "Do not simply recolor, repaint or restyle the existing kitchen furniture — rebuild it entirely as a newly built kitchen, while leaving every other element of the room untouched.",
    notesLine,
    `Kitchen layout: ${layoutValue}${walls ? `, ${walls}` : ""}.`,
    layoutConstraint,
    corner,
    island,
    `Cabinet fronts: ${config.doorStyle || "flat"} style, ${config.facades || "matte white"} finish.`,
    `Worktop: ${config.worktop || "white quartz"}.`,
    `Backsplash: ${config.credence || "matching the worktop"}.`,
    `Cabinet hardware (mandatory, identical on every single door and drawer, never mixed): ${handleDescriptor}.`,
    `Plinth (kickboard): ${config.plinth || "matching the cabinet fronts"}.`,
    upperLine,
    appliancesLine,
    dishwasherLine,
    rangeConfusionLine,
    hobTypeLine,
    `Sink: ${config.sink || "stainless steel undermount"}, a single sink only. Faucet finish: ${config.faucet || "matte black"}, a single faucet only.`,
    lighting,
    "Use standard 19 mm melamine cabinet carcasses, filler panels against walls and finished end panels on exposed sides, fitted around any window, door, boiler or radiator exactly where it already is.",
    "Respect real construction scale, realistic joins, shadows, reflections and natural perspective — the kitchen must look physically built in this exact room, not pasted on.",
    "Photorealistic single wide shot of the whole kitchen, professional interior photography, natural color grading. No collage, no split screen, no before/after comparison, no grid of images, no text, no logo, no watermark, no interface, no people, no pets.",
    `Final check before rendering: the floor, walls, ceiling, every window, every door (including any porte-fenêtre or balcony door, which must stay a door) and any boiler, radiator or other technical equipment must remain exactly as in the original photo — the kitchen layout must match the requested wall count exactly${wallSideText ? ` (single wall: ${wallSideText})` : ""}, the oven and hob must stay two separate appliances, the cabinet hardware must exactly match the requested type (${noHandles ? "no handles/knobs" : /bouton/i.test(config.handleType || "") ? "round knobs, not bar handles" : "bar handles, not round knobs"}), upper wall cabinets must be ${config.upperCabinets ? "clearly present" : "absent"} exactly as requested, and only the kitchen furniture has changed.`
  ].filter(Boolean);

  return lines.join(" ");
}
