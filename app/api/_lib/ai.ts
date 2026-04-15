type SlidePayload = {
  title?: unknown;
  content?: unknown;
};

type CaptionPayload = {
  caption?: unknown;
  hashtags?: unknown;
};

const stripCodeFences = (text: string) =>
  text.replace(/```json/g, "").replace(/```/g, "").trim();

const extractBalancedJSON = (text: string, opener: "[" | "{") => {
  const closer = opener === "[" ? "]" : "}";
  const start = text.indexOf(opener);

  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === opener) depth++;
    if (char === closer) depth--;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }

  return null;
};

export const parseAIJSON = (text: string) => {
  const cleaned = stripCodeFences(text);
  const candidates = [
    cleaned,
    extractBalancedJSON(cleaned, "["),
    extractBalancedJSON(cleaned, "{"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  return null;
};

export const validateHooks = (value: unknown) => {
  if (!Array.isArray(value)) return null;

  const hooks = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  return hooks.length ? hooks : null;
};

const normalizeSlide = (slide: SlidePayload) => {
  if (typeof slide.title !== "string" || typeof slide.content !== "string") {
    return null;
  }

  const title = slide.title.trim();
  const content = slide.content.trim();

  if (!title && !content) return null;

  return { title, content };
};

export const validateSlides = (value: unknown, expectedCount: number) => {
  const rawSlides = Array.isArray(value) ? value : [value];
  const slides = rawSlides
    .map((slide) =>
      slide && typeof slide === "object" ? normalizeSlide(slide as SlidePayload) : null,
    )
    .filter(Boolean) as Array<{ title: string; content: string }>;

  if (!slides.length) return null;

  return slides.slice(0, expectedCount);
};

export const validateSingleSlide = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  return normalizeSlide(value as SlidePayload);
};

export const validateCaptionResult = (value: unknown) => {
  if (!value || typeof value !== "object") return null;

  const payload = value as CaptionPayload;

  if (typeof payload.caption !== "string" || !Array.isArray(payload.hashtags)) {
    return null;
  }

  const caption = payload.caption.trim();
  const hashtags = payload.hashtags
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);

  if (!caption || hashtags.length === 0) {
    return null;
  }

  return { caption, hashtags };
};
