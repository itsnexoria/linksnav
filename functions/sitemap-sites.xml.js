export async function onRequest() {
  const response = await fetch(
    "https://tiupkpabwuefclbrpaef.supabase.co/functions/v1/sitemap-sites"
  );

  const xml = await response.text();

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}