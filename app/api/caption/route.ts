import { parseAIJSON, validateCaptionResult } from "../_lib/ai";

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return Response.json(
        { error: "Missing GROQ_API_KEY configuration" },
        { status: 500 },
      );
    }

    const {
      idea,
      format,
      tone = "professional",
      audience = "creators",
      ctaStyle = "soft",
      slides = [],
    } = await req.json();

    const slidesSummary = Array.isArray(slides)
      ? slides
          .map((slide, index) =>
            slide && typeof slide === "object"
              ? `Slide ${index + 1}: ${(slide as { title?: string }).title || ""} | ${(slide as { content?: string }).content || ""}`
              : null,
          )
          .filter(Boolean)
          .join("\n")
      : "";

    const prompt = `
Create one social media caption and a hashtag set.

Topic: ${idea}
Format: ${format}
Tone: ${tone}
Audience: ${audience}
CTA style: ${ctaStyle}

Slides:
${slidesSummary}

Rules:
- Caption should feel natural and ready to post
- Keep it concise but useful
- Match the requested tone and audience
- Include a CTA that matches the requested CTA style
- Return ONLY JSON

Format:
{
  "caption": "",
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}
`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      const message =
        data?.error?.message || data?.error || "Groq request failed";
      return Response.json({ error: message }, { status: response.status });
    }

    const text: string = data.choices?.[0]?.message?.content || "";

    if (!text) {
      return Response.json(
        { error: "Groq returned an empty caption response" },
        { status: 502 },
      );
    }

    const parsed = parseAIJSON(text);
    const result = validateCaptionResult(parsed);

    if (!result) {
      return Response.json(
        { error: "Groq returned invalid caption data" },
        { status: 502 },
      );
    }

    return Response.json(result);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to generate caption" }, { status: 500 });
  }
}
