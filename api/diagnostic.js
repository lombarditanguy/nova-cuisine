export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: "REPLICATE_API_TOKEN est absente." });

  try {
    const upstream = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro",
      { headers: { "Authorization": `Bearer ${token}` } }
    );
    const raw = await upstream.text();
    let body;
    try { body = JSON.parse(raw); } catch { body = { raw: raw.slice(0, 300) }; }

    return res.status(upstream.status).json({
      ok: upstream.ok,
      upstreamStatus: upstream.status,
      model: upstream.ok ? "black-forest-labs/flux-kontext-pro" : null,
      response: upstream.ok ? { name: body.name, owner: body.owner } : body
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
