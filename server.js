const express = require('express');  
const path = require('path');  
const app = express();

app.use(express.json({ limit: '10mb' }));  
app.use(express.static(path.join(__dirname)));

app.use('/api/render', require('./api/render'));

app.get('*', (req, res) => {  
  res.sendFile(path.join(__dirname, 'index.html'));  
});

const PORT = process.env.PORT || 3000;  
app.listen(PORT, () => console.log(`NOVA Cuisine running on port ${PORT}`));

module.exports = app;  
