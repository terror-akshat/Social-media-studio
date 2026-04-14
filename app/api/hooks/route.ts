export async function POST(req: Request) {
  try {
    const { idea } = await req.json();

    const prompt = `
Generate 3 highly engaging social media hooks.

Topic: ${idea}

Rules:
- Short
- Attention grabbing
- Parent-friendly tone
- Return ONLY JSON array

Format:
[
  "Hook 1",
  "Hook 2",
  "Hook 3"
]
`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    const text = data.choices?.[0]?.message?.content || "";

    return Response.json({ result: text });

  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to generate hooks" });
  }
}