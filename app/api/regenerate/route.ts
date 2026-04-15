export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return Response.json(
        { error: "Missing GROQ_API_KEY configuration" },
        { status: 500 },
      );
    }

    const body = await req.json();
    const { idea, index, format } = body;

    const prompt = `
Generate ONE improved slide for this topic:

Topic: ${idea}
Slide number: ${index + 1}
Format: ${format}

Return ONLY JSON:
{ "title": "", "content": "" }
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
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const message =
        data?.error?.message || data?.error || "Groq request failed";
      return Response.json({ error: message }, { status: response.status });
    }

    const text = data.choices?.[0]?.message?.content || "";

    if (!text) {
      return Response.json(
        { error: "Groq returned an empty regenerated slide" },
        { status: 502 },
      );
    }

    return Response.json({ result: text });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to regenerate" }, { status: 500 });
  }
}
