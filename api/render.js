const express = require('express');  
const path = require('path');  
const app = express();

app.use(express.json({ limit: '20mb' }));  
app.use(express.static(path.join(__dirname)));

app.post('/api/render', async (req, res) => {  
  const { image, config } = req.body;  
  if (!image || !config) return res.status(400).json({ error: 'Missing image or config' });

  const { implantation, mur1, mur2, mur3, facades, planTravail, poignees, couleurPoignees, meublesHauts, electromenager } = config;

  const prompt = `Interior design renovation photograph. Keep the exact same room: same walls, same floor, same ceiling, same windows, same lighting, same perspective, same camera angle. COMPLETELY REMOVE the existing kitchen furniture and replace it with a brand new custom kitchen. New kitchen specifications: ${implantation} layout, ${mur1}cm main wall${mur2 ? `, ${mur2}cm second wall` : ''}${mur3 ? `, ${mur3}cm third wall` : ''}, ${facades} cabinet doors, ${planTravail} countertop, ${poignees} handles in ${couleurPoignees} finish, ${meublesHauts ? 'with upper wall cabinets' : 'no upper wall cabinets'}, appliances: ${electromenager && electromenager.length ? electromenager.join(', ') : 'none'}. Standard 19mm melamine carcasses with filler strips against walls. Photorealistic, high quality, professional interior photography.`;

  const token = process.env.REPLICATE_API_TOKEN;

  try {  
    const startRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions', {  
      method: 'POST',  
      headers: {  
        'Authorization': `Bearer ${token}`,  
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

    const prediction = await startRes.json();  
    if (prediction.error) return res.status(500).json({ error: prediction.error });

    const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;  
    return res.status(200).json({ imageUrl: output });

  } catch (err) {  
    return res.status(500).json({ error: err.message });  
  }  
});

app.get('*', (req, res) => {  
  res.sendFile(path.join(__dirname, 'index.html'));  
});

const PORT = process.env.PORT || 3000;  
app.listen(PORT, () => console.log(`NOVA Cuisine running on port ${PORT}`));

module.exports = app;  
