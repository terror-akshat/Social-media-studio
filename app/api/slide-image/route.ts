const createFallbackSvg = (prompt: string) => {
  const label = prompt.slice(0, 120).replace(/[<>&"]/g, "");

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="55%" stop-color="#7c3aed" />
      <stop offset="100%" stop-color="#db2777" />
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)" />
  <circle cx="220" cy="220" r="120" fill="rgba(255,255,255,0.08)" />
  <circle cx="980" cy="300" r="180" fill="rgba(255,255,255,0.08)" />
  <circle cx="860" cy="920" r="140" fill="rgba(255,255,255,0.08)" />
  <text x="80" y="980" fill="white" font-size="42" font-family="Arial, sans-serif" opacity="0.9">
    ${label}
  </text>
</svg>`.trim();
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get("prompt");

  if (!prompt) {
    return new Response("Missing prompt", { status: 400 });
  }

  try {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}`;

    const response = await fetch(imageUrl, {
      headers: {
        Accept: "image/*",
      },
      cache: "force-cache",
    });

    if (!response.ok) {
      const fallbackSvg = createFallbackSvg(prompt);

      return new Response(fallbackSvg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();

    return new Response(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error(error);

    const fallbackSvg = createFallbackSvg(prompt);

    return new Response(fallbackSvg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
}
