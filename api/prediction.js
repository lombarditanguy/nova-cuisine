export default async function handler(req, res) {  
  res.setHeader("Content-Type", "application/json; charset=utf-8");  
  res.setHeader("Cache-Control", "no-store");

  const { id } = req.query;

  if (!id) {  
    return res.status(400).json({ error: "Identifiant de rendu manquant." });  
  }

  try {  
    const response = await fetch(  
      `https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`,  
      {  
        headers: {  
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`  
        }  
      }  
    );

    const prediction = await response.json();

    if (!response.ok) {  
      return res.status(response.status).json({  
        error:  
          prediction.detail ||  
          prediction.error ||  
          "Impossible de récupérer l’avancement du rendu."  
      });  
    }

    const output = Array.isArray(prediction.output)  
      ? prediction.output[0]  
      : prediction.output || null;

    return res.status(200).json({  
      status: prediction.status,  
      imageUrl: output,  
      error: prediction.error || null  
    });  
  } catch (error) {  
    return res.status(500).json({  
      error: error.message || "Erreur lors du suivi du rendu."  
    });  
  }  
}  
