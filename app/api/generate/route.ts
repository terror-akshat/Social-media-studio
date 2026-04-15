export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return Response.json(
        { error: "Missing GROQ_API_KEY configuration" },
        { status: 500 },
      );
    }

    const { idea, format, hook } = await req.json();

    const slideCount = format === "post" ? 1 : format === "story" ? 3 : 5;
    const formatName = format === "post" ? "post" : format === "story" ? "story" : "carousel";

    const prompt = `
You are a social media content expert.

Create a HIGH-ENGAGEMENT Instagram ${formatName}.

Topic: ${idea}
Hook: ${hook}

Follow this structure:

1. Hook (scroll-stopping, emotional)
2. Relatable problem (parent pain)
3. Why it happens (simple explanation)
4. Key insight (aha moment)
5. Practical solution
6. Strong takeaway (memorable)

Rules:
- Each slide must feel connected
- Conversational tone
- Short, punchy lines
- Parent-friendly language

Return JSON array with ${slideCount} slide${slideCount === 1 ? "" : "s"}:
[
 ${Array(slideCount).fill('{ "title": "", "content": "" }').join(',\n ')}
]
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
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
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
        { error: "Groq returned an empty generation response" },
        { status: 502 },
      );
    }

    return Response.json({ result: text });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
