const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
require("dotenv").config();

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const TOKEN = process.env.VISUAL_RENDER_TOKEN;
const ENDPOINT = process.env.VISUAL_RENDER_ENDPOINT;

/* La clé reste uniquement côté serveur. Ne jamais l’ajouter au HTML. */
function send(res, status, body, type="application/json") {
  res.writeHead(status, {"Content-Type": type});
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}
function promptFrom(c) {
  const walls = [c.length1, ...(c.layout !== "Linéaire" ? [c.length2] : []), ...(c.layout === "En U" ? [c.length3] : [])].join(", ");
  return `Rénovation photoréaliste d'une cuisine dans la photo fournie. Conserver exactement la pièce, le cadrage, les murs, le sol, les ouvertures et la lumière. Remplacer uniquement la cuisine existante par une cuisine ${c.layout}, murs ${walls} cm, façades ${c.front}, plan de travail ${c.worktop}, poignées ${c.handle} ${c.metal}, meubles hauts ${c.upper}, électroménager ${c.appliances.join(", ")}. Utiliser des caissons standard en mélaminé 19 mm, ajouter discrètement fileurs contre murs et joues de finition sur les côtés ouverts. Image intérieure haut de gamme réaliste, sans texte, sans interface.`;
}
async function callVisualEngine(payload) {
  /* Ce connecteur attend un point d'accès sécurisé compatible avec :
     POST JSON { input: { image, prompt } } -> JSON { output: "url-ou-data-url" }.
     Ajustez seulement l'adaptateur ici si votre moteur retourne un format différent. */
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {"Content-Type":"application/json", "Authorization":`Bearer ${TOKEN}`},
    body: JSON.stringify({input:{image:payload.photo, prompt:promptFrom(payload.configuration)}})
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.detail || data.error || "Le moteur visuel a refusé la demande.");
  const image = Array.isArray(data.output) ? data.output[0] : (data.output || data.image || data.url);
  if (!image) throw new Error("Le moteur visuel n’a pas retourné d’image.");
  return image;
}
const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET") {
    const file = url.pathname === "/" ? path.join(PUBLIC,"index.html") : path.join(PUBLIC,url.pathname);
    if (!file.startsWith(PUBLIC)) return send(res,403,{error:"Accès refusé."});
    fs.readFile(file,(err,data)=>{ if(err) return send(res,404,{error:"Page introuvable."}); const ext=path.extname(file); send(res,200,data,ext===".html"?"text/html":"application/octet-stream");});
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/render") {
    let raw=""; req.on("data",chunk=>{raw+=chunk; if(raw.length>18*1024*1024) req.destroy();});
    req.on("end",async()=>{
      if (!TOKEN || !ENDPOINT) return send(res,503,{error:"Le moteur de rendu n’est pas encore configuré côté serveur."});
      try { const payload=JSON.parse(raw); if(!payload.photo || !payload.configuration) throw new Error("Photo ou configuration manquante."); const image=await callVisualEngine(payload); send(res,200,{image}); }
      catch(e){send(res,500,{error:e.message || "Erreur de génération."});}
    }); return;
  }
  send(res,404,{error:"Route introuvable."});
});
server.listen(PORT,()=>console.log(`NOVA Cuisine test disponible sur http://localhost:${PORT}`));