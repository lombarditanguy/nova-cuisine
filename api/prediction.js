export default async function handler(req, res) {  
  res.setHeader('Access-Control-Allow-Origin', '*');  
  res.setHeader('Cache-Control', 'no-store');    
  const { id } = req.query;      
  if (!id) return res.status(400).json({ error: 'Missing prediction id' });

  try {  
    const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {  
      headers: {  
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,  
        'Content-Type': 'application/json'  
      }  
    });

    const prediction = await response.json();  
    if (prediction.error) return res.status(500).json({ error: prediction.error });

    const output = prediction.output   
      ? (Array.isArray(prediction.output) ? prediction.output[0] : prediction.output)  
      : null;

    return res.status(200).json({   
      status: prediction.status,  
      imageUrl: output  
    });

  } catch (err) {  
    return res.status(500).json({ error: err.message });  
  }  
}  
