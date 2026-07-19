export default {
  async fetch(request) {
    const headers = { "content-type": "application/json; charset=utf-8" };
    const token = process.env.REPLICATE_API_TOKEN;

    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Méthode non autorisée." }), { status: 405, headers });
    }
    if (!token) {
      return new Response(JSON.stringify({ error: "La variable REPLICATE_API_TOKEN n’est pas configurée dans Vercel." }), { status: 500, headers });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id || !/^[a-z0-9]+$/i.test(id)) {
      return new Response(JSON.stringify({ error: "Identifiant de rendu invalide." }), { status: 400, headers });
    }

    try {
      const upstream = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const prediction = await upstream.json();

      if (!upstream.ok) {
        return new Response(JSON.stringify({ error: prediction.detail || prediction.error || "Impossible de suivre le rendu." }), { status: upstream.status, headers });
      }

      return new Response(JSON.stringify({
        status: prediction.status,
        error: prediction.error || null,
        imageUrl: Array.isArray(prediction.output) ? prediction.output[0] : prediction.output || null
      }), { status: 200, headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message || "Erreur serveur." }), { status: 500, headers });
    }
  }
};
