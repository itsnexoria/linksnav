import { getDatabase } from "@netlify/database";

export default async (req) => {
  const db = getDatabase();

  if (req.method === "GET") {
    const result = await db.sql`SELECT site_url, click_count FROM site_stats`;
    return Response.json(result.rows);
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { url } = body;
    if (!url || typeof url !== "string") {
      return new Response("Missing or invalid url", { status: 400 });
    }

    await db.sql`
      INSERT INTO site_stats (site_url, click_count)
      VALUES (${url}, 1)
      ON CONFLICT (site_url)
      DO UPDATE SET
        click_count = site_stats.click_count + 1,
        updated_at  = NOW()
    `;

    const result = await db.sql`SELECT click_count FROM site_stats WHERE site_url = ${url}`;
    return Response.json({ click_count: result.rows[0]?.click_count ?? 1 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/site-stats",
};
