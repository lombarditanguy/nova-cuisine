export default async function handler(req, res) {  
  res.setHeader("Content-Type", "application/json; charset=utf-8");  
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {  
    return res.status(405).json({ error: "Méthode non autorisée." });  
  }

  const token = process.env.REPLICATE_API_TOKEN;  
  if (!token) {  
    return res.status(500).json({  
      error: "La variable REPLICATE_API_TOKEN n’est pas configurée."  
    });  
  }

  try {  
    const { image, config } = req.body || {};

    if (!image || !config) {  
      return res.status(400).json({  
        error: "Photo ou configuration manquante."  
      });  
    }

    const appliances = Array.isArray(config.appliances) && config.appliances.length  
      ? config.appliances.join(", ")  
      : "aucun appareil visible";

    const walls = [  
      config.wall1 ? `main wall ${config.wall1} cm` : "",  
      config.wall2 ? `second wall ${config.wall2} cm` : "",  
      config.wall3 ? `third wall ${config.wall3} cm` : ""  
    ].filter(Boolean).join(", ");

    const prompt = [  
      "Photorealistic interior renovation.",  
      "Keep exactly the same empty room shell: camera angle, perspective, walls, windows, ceiling, floor and natural lighting.",  
      "Completely remove all existing kitchen cabinets, appliances, worktops, backsplash and furniture.",  
      "Do not reuse, recolor or restyle the old kitchen.",  
      "Create a completely new made-to-measure kitchen from scratch.",  
      `Kitchen layout: ${config.layout || "linear"}, ${walls}.`,  
      `Cabinet fronts: ${config.facades || "matte white"}.`,  
      `Worktop: ${config.worktop || "white quartz"}.`,  
      `Handles: ${config.handleType || "bar handles"} in ${config.handleColor || "black"} finish.`,  
      config.upperCabinets  
        ? "Include new upper wall cabinets."  
        : "Do not include upper wall cabinets.",  
      `Integrated appliances to include: ${appliances}.`,  
      "Use standard 19 mm melamine cabinet carcasses, filler panels against walls and finished end panels on exposed sides.",  
      "Premium professional kitchen design, realistic proportions, physically credible shadows and reflections.",  
      "No text, no labels, no interface."  
    ].join(" ");

    const upstream = await fetch(  
      "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",  
      {  
        method: "POST",  
        headers: {  
          Authorization: `Bearer ${token}`,  
          "Content-Type": "application/json"  
        },  
        body: JSON.stringify({  
          input: {  
            prompt,  
            input_image: image,  
            output_format: "jpg",  
            safety_tolerance: 2  
          }  
        })  
      }  
    );

    const prediction = await upstream.json();

    if (!upstream.ok) {  
      return res.status(upstream.status).json({  
        error:  
          prediction.detail ||  
          prediction.error ||  
          "La génération n’a pas pu démarrer."  
      });  
    }

    const output = Array.isArray(prediction.output)  
      ? prediction.output[0]  
      : prediction.output || null;

    return res.status(200).json({  
      id: prediction.id,  
      status: prediction.status,  
      imageUrl: output  
    });  
  } catch (error) {  
    return res.status(500).json({  
      error: error.message || "Erreur serveur."  
    });  
  }  
}  
