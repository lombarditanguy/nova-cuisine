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
  const handleColorValue = config.handleColor || "black";
  const handleShapeWord = /bouton/i.test(config.handleType || "") ? "round knobs" : "bar handles";
  const handleDescriptor = noHandles
    ? "no visible handles or knobs anywhere: push-to-open fronts, perfectly flush and seamless"
    : /bouton/i.test(config.handleType || "")
    ? `small round KNOBS in ${handleColorValue.toUpperCase()} finish only — one compact individual round knob per door and drawer, absolutely NOT a long bar handle, and NOT any color other than ${handleColorValue}`
    : `long bar/pull HANDLES in ${handleColorValue.toUpperCase()} finish only — a single straight bar mounted on each door and drawer, absolutely NOT small round knobs, and NOT any color other than ${handleColorValue}`;

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
    ? "The dishwasher is fully integrated (encastré): it is hidden behind a flat decor door panel that exactly matches the surrounding cabinet fronts in color, material and style — a plain cabinet-style door, the same height as a normal base-unit door (roughly 82 cm), at most a slim discreet control strip along the very top edge. It must NOT have a large circular glass porthole window, must NOT have a front-loading drum door, must NOT have a program dial, and must NOT look like a washing machine in any way — no visible white or stainless appliance face at all."
    : "";

  const noExtraAppliancesLine = `Do not add any appliance that is not explicitly listed in the mandatory specification above.${
    hasDishwasher ? "" : " In particular, do NOT add a dishwasher: none was selected."
  } Never add a washing machine, tumble dryer or any other laundry equipment under any circumstance, and never render the dishwasher as a washing machine — this is a kitchen, not a utility room, regardless of what the reference photo shows.`;

  const hasOven = applianceList.some(a => /four/i.test(a));
  const hasHob = applianceList.some(a => /plaque/i.test(a));
  const rangeConfusionLine = hasOven && hasHob
    ? "The oven and the hob are two separate, physically distinct built-in appliances in two different locations: the oven is built into a tall cabinet column (or under the worktop only if there is no column space), and the hob is a separate flush cooktop set into the worktop, well away from the oven. Never merge them into a single freestanding range/cooker (gazinière) unit with an oven door directly below exposed burners."
    : "";
  const hobTypeLine = hasHob
    ? "The hob (plaque de cuisson) is a flush induction cooktop: a smooth glass-ceramic surface sitting perfectly flat with the worktop, with no visible flame, no gas burners, no cast-iron grates and no control knobs."
    : "";

  const notes = typeof config.notes === "string" ? config.notes.trim().slice(0, 500) : "";
  const notesLine = notes
    ? `Additional client instructions specific to this room — follow them precisely and let them override any conflicting instruction above: ${notes}.`
    : "";

  const targetSummaryLine = `MANDATORY CLIENT SPECIFICATION for the new kitchen (highest priority, follow exactly, completely replacing the old kitchen's appearance with zero trace of its original colors): cabinet fronts ${config.doorStyle || "flat"} style in ${config.facades || "matte white"}; worktop ${config.worktop || "white quartz"}; backsplash ${config.credence || "matching the worktop"}; plinth ${config.plinth || "matching the cabinet fronts"}; hardware ${handleDescriptor}; layout ${layoutValue}${wallSideText ? ` along ${wallSideText}` : ""}; upper wall cabinets ${config.upperCabinets ? "present" : "absent"}; appliances (exactly one of each, never duplicated, and STRICTLY no appliance beyond this list): ${applianceList.length ? applianceList.join(", ") : "none beyond what is strictly necessary"}. ABSOLUTE RULE, no exception: NEVER include a washing machine or any laundry appliance — if a dishwasher is listed, it is a dishwasher, never a washing machine.`;

  const lines = [
    targetSummaryLine,
    "This is a precise photo edit of the exact reference photo, not a new scene: same room, same camera angle, same framing and perspective.",
    "Keep identical, exactly as in the reference photo: the floor, every wall, the ceiling, every window, and any fixed equipment such as a boiler, radiator, electrical panel, socket or pipe.",
    "Every door keeps exactly its original type, size, position and opening mechanism — including any full-height glazed door, sliding door, porte-fenêtre or balcony door. Never convert a door into a window or a window into a door.",
    "Remove the existing kitchen cabinets, worktop, appliances and backsplash, and rebuild the new kitchen specified above in their place. Do not recolor or restyle the old kitchen — replace it entirely. Nothing else in the room changes.",
    notesLine,
    walls ? `Wall dimensions: ${walls}.` : "",
    layoutConstraint,
    corner,
    island,
    dishwasherLine,
    noExtraAppliancesLine,
    rangeConfusionLine,
    hobTypeLine,
    `Sink: ${config.sink || "stainless steel undermount"} (single sink). Faucet: ${config.faucet || "matte black"} (single faucet).`,
    lighting,
    "Standard 19 mm melamine cabinet carcasses, filler and end panels fitted around any window, door, boiler or radiator exactly where it already is.",
    "Realistic construction scale, joins, shadows and perspective — the kitchen must look physically built in this room, not pasted on.",
    "Photorealistic single wide shot, professional interior photography. No collage, no split screen, no text, no logo, no watermark, no people, no pets.",
    `Reminder of the mandatory specification: cabinet fronts exactly ${config.facades || "matte white"} (not the old color), worktop ${config.worktop || "white quartz"}, plinth exactly ${config.plinth || "matching the cabinet fronts"} (not the old color), hardware ${noHandles ? "no handles/knobs" : `${handleShapeWord} in ${handleColorValue} finish (not another color, not another shape)`}, upper wall cabinets ${config.upperCabinets ? "present" : "absent"}, single-wall layout${wallSideText ? ` on ${wallSideText}` : ""} with no corner, appliances strictly limited to ${applianceList.length ? applianceList.join(", ") : "none"} — no washing machine, no dryer, no unlisted appliance of any kind${hasDishwasher ? ", and the dishwasher is a flat integrated cabinet-front panel, definitely not a washing machine with a round porthole door" : ""}.`
  ].filter(Boolean);

  return lines.join(" ");
}
