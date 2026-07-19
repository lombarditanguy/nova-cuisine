export default async function handler(req, res) {  
  res.setHeader('Access-Control-Allow-Origin', '*');  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');  
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, config } = req.body;  
  if (!image || !config) return res.status(400).json({ error: 'Missing data' });

  const { implantation, mur1, mur2, mur3, facades, planTravail, poignees, couleurPoignees, meublesHauts, electromenager } = config;

  const prompt = `Interior design renovation. Keep the exact same room, walls, floor, ceiling, windows, lighting and perspective. COMPLETELY REMOVE existing kitchen and replace with brand new kitchen: ${implantation} layout, ${mur1}cm main wall${mur2 ? `, ${mur2}cm second wall` : ''}${mur3 ? `, ${mur3}cm third wall` : ''}, ${facades} cabinet fronts, ${planTravail} worktop, ${poignees} handles in ${couleurPoignees}, ${meublesHauts ? 'with upper cabinets' : 'no upper cabinets'}, appliances: ${electromenager && electromenager.length ? electromenager.join(', ') : 'none'}. 19mm melamine carcasses, filler strips against walls. Photorealistic professional interior photo.`;

  try {  
    const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions', {  
      method: 'POST',  
      headers: {  
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,  
        'Content-Type': 'application/json',  
        'Prefer': 'wait'  
      },  
      body: JSON.stringify({  
        input: {  
          prompt,  
          input_image: image,  
          output_format: 'jpg',  
          safety_tolerance: 5  
        }  
      })  
    });

    const prediction = await response.json();  
    if (prediction.error) return res.status(500).json({ error: prediction.error });

    const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;  
    return res.status(200).json({ imageUrl: output });

  } catch (err) {  
    return res.status(500).json({ error: err.message });  
  }  
}  
