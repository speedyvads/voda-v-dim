// Повертає гео відвідувача з Netlify (context.geo) — без сторонніх сервісів.
export default async (req, context) => {
  const g = context.geo || {};
  const body = {
    city: g.city || null,
    country: g.country?.code || null,
    subdivision: g.subdivision?.code || null,
    subdivisionName: g.subdivision?.name || null,
    lat: g.latitude ?? null,
    lng: g.longitude ?? null,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
