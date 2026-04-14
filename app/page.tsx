"use client";
import html2canvas from "html2canvas";
import { useRef, useState } from "react";
import JSZip from "jszip";

type Slide = {
  title: string;
  content: string;
  imageUrl?: string;
  imagePrompt?: string;
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cleanSlideText = (text: string, idea: string, index: number) => {
  let cleaned = text?.trim() || "";

  if (!cleaned) return cleaned;

  cleaned = cleaned.replace(/^[\s\n]*Slide\s*\d+\s*[:.\-–—]*\s*/i, "");

  if (idea) {
    const ideaPrefix = new RegExp(`^\\s*${escapeRegExp(idea)}[\\s:.\-–—]*`, "i");
    cleaned = cleaned.replace(ideaPrefix, "");
  }

  return cleaned.trim();
};

const sanitizeSlide = (slide: Slide, idea: string, index: number) => ({
  ...slide,
  title: cleanSlideText(slide.title, idea, index),
  content: cleanSlideText(slide.content, idea, index),
});

export default function Home() {
  const [idea, setIdea] = useState<string>("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hooks, setHooks] = useState<string[]>([]);
  const [selectedHook, setSelectedHook] = useState<string>("");
  const [format, setFormat] = useState<"carousel" | "post" | "story">(
    "carousel",
  );
  const [theme, setTheme] = useState("purple");
  const [customColor, setCustomColor] = useState("#6366f1");
  const [font, setFont] = useState("sans");
  const [alignment, setAlignment] = useState("center");
  const [padding, setPadding] = useState(24);
  const [previewMode, setPreviewMode] = useState(false);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const buildImagePrompt = (slide: Slide, index: number) => {
    const formatContext =
      format === "story" ? "vertical Instagram story visual"
      : format === "post" ? "single Instagram post visual"
      : "Instagram carousel slide visual";

    return `Create a modern editorial image for slide ${index + 1} of a ${formatContext} on the theme of ${idea}. Evoke the tone of ${slide.title} without any readable text, labels, or title overlays. Modern composition, premium lighting, clean typography space, social-media-ready creative, thumb-stopping image.`;
  };

  const decorateSlideWithImage = (slide: Slide, index: number): Slide => {
    const imagePrompt = buildImagePrompt(slide, index);

    return {
      ...slide,
      imagePrompt,
      imageUrl: `/api/slide-image?prompt=${encodeURIComponent(imagePrompt)}`,
    };
  };

  const getExportBackground = () => {
    if (theme === "custom") return customColor;
    if (theme === "blue") {
      return "linear-gradient(135deg, rgb(96, 165, 250), rgb(29, 78, 216))";
    }
    if (theme === "green") {
      return "linear-gradient(135deg, rgb(74, 222, 128), rgb(5, 150, 105))";
    }
    if (theme === "orange") {
      return "linear-gradient(135deg, rgb(251, 146, 60), rgb(239, 68, 68))";
    }
    if (theme === "dark") return "rgb(17, 24, 39)";

    return "linear-gradient(135deg, rgb(99, 102, 241), rgb(168, 85, 247) 55%, rgb(236, 72, 153))";
  };

  const downloadZIP = async () => {
    const zip = new JSZip();

    for (let i = 0; i < slideRefs.current.length; i++) {
      const slide = slideRefs.current[i];
      if (!slide) continue;

      const originalBg = slide.style.background;
      slide.style.background = getExportBackground();

      const canvas = await html2canvas(slide);
      slide.style.background = originalBg;

      const imgData = canvas.toDataURL("image/png");
      const imgBlob = await (await fetch(imgData)).blob();

      zip.file(`slide-${i + 1}-${format}.png`, imgBlob);
    }

    const content = await zip.generateAsync({ type: "blob" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "carousel-slides.zip";
    link.click();
  };

  const generateHooks = async () => {
    if (!idea) {
      alert("Enter idea first");
      return;
    }

    try {
      const res = await fetch("/api/hooks", {
        method: "POST",
        body: JSON.stringify({ idea }),
      });

      const data = await res.json();
      const cleaned = data.result
        ?.replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      setHooks(parsed);
    } catch (err) {
      console.error("Hook generation failed", err);
    }
  };

  const regenerateSlide = async (index: number) => {
    try {
      const res = await fetch("/api/regenerate", {
        method: "POST",
        body: JSON.stringify({
          idea,
          index,
          format,
        }),
      });

      const data = await res.json();
      const cleaned = data.result
        ?.replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const parsed = parseAIJSON(cleaned) as Slide | null;
      if (!parsed) return;

      const newSlides = [...slides];
      newSlides[index] = decorateSlideWithImage(sanitizeSlide(parsed, idea, index), index);
      setSlides(newSlides);
    } catch (err) {
      console.error("Regenerate failed", err);
    }
  };

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

  const parseAIJSON = (text: string) => {
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
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

    console.error("Unable to parse AI JSON response");
    return null;
  };

  const getExpectedSlideCount = () => {
    if (format === "post") return 1;
    if (format === "story") return 3;
    return 5;
  };

  const handleGenerate = async () => {
    if (!idea) {
      alert("Please enter an idea");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({ idea, format, hook: selectedHook }),
      });

      const data = await res.json();
      console.log("RAW AI RESPONSE:", data.result);

      let parsed: Slide[] = [];

      try {
        const result = parseAIJSON(data.result);
        if (Array.isArray(result)) {
          parsed = result;
        } else if (result && typeof result === 'object' && 'title' in result && 'content' in result) {
          // Single slide object, wrap in array
          parsed = [result];
        } else {
          console.error("AI response is not a valid slide format");
        }
      } catch {
        console.error("Invalid JSON from AI");
      }

      setSlides(
        parsed
          .slice(0, getExpectedSlideCount())
          .map((slide, index) => decorateSlideWithImage(sanitizeSlide(slide, idea, index), index)),
      );
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  const themes = {
    purple: "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500",
    blue: "bg-gradient-to-br from-blue-400 to-blue-700",
    green: "bg-gradient-to-br from-green-400 to-emerald-600",
    orange: "bg-gradient-to-br from-orange-400 to-red-500",
    dark: "bg-gray-900",
    custom: "",
  };

  const fontClasses = {
    sans: "font-sans",
    serif: "font-serif",
    mono: "font-mono",
    display: "font-serif uppercase tracking-wide",
    editorial: "font-serif italic",
  };

  const alignmentClasses = {
    center: "text-center items-center",
    left: "text-left items-start",
  };

  return (
    <main className="relative h-screen overflow-hidden bg-[linear-gradient(135deg,_#fff7ed_0%,_#fdf2f8_24%,_#eff6ff_58%,_#eef2ff_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.30)_0%,_transparent_24%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.24)_0%,_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(236,72,153,0.18)_0%,_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.20)_0%,_transparent_28%)]" />
      <div className="pointer-events-none absolute left-[8%] top-[10%] h-56 w-56 rounded-full bg-orange-300/30 blur-3xl" />
      <div className="pointer-events-none absolute right-[10%] top-[14%] h-64 w-64 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[8%] left-[30%] h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
      <div className="border-b border-white/50 bg-white/65 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white">
                Studio
              </span>
              <span className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                Creator Workspace
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              Social Media Studio
            </h1>
            <p className="mt-2 text-base font-semibold tracking-wide text-fuchsia-600 animate-pulse">
              {"\u2728 Build. Design. Export."}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Build, refine, and export content like a presentation deck.
            </p>
          </div>

          <button
            onClick={downloadZIP}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            Download ZIP
          </button>
        </div>
      </div>

      <div className="mx-auto grid h-[calc(100vh-93px)] max-w-[1800px] gap-6 overflow-hidden px-6 py-6 lg:grid-cols-[340px_minmax(0,1fr)_320px]">
        <aside className="h-full overflow-y-auto rounded-[28px] border border-white/30 bg-white/20 p-6 shadow-xl backdrop-blur-lg">
          <div className="mt-6 rounded-[24px] border border-orange-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.95)_0%,_rgba(255,247,237,0.92)_100%)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Format
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Choose the output structure before generating.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => setFormat("carousel")}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  format === "carousel" ?
                    "bg-slate-950 text-white shadow-lg"
                  : "bg-white text-slate-700 shadow-sm hover:bg-slate-100"
                }`}
              >
                Carousel
              </button>
              <button
                onClick={() => setFormat("post")}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  format === "post" ?
                    "bg-slate-950 text-white shadow-lg"
                  : "bg-white text-slate-700 shadow-sm hover:bg-slate-100"
                }`}
              >
                Post
              </button>
              <button
                onClick={() => setFormat("story")}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  format === "story" ?
                    "bg-slate-950 text-white shadow-lg"
                  : "bg-white text-slate-700 shadow-sm hover:bg-slate-100"
                }`}
              >
                Story
              </button>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Topic
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Describe the idea you want turned into slides.
            </p>
          </div>

          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Enter your idea..."
            className="mt-3 h-36 w-full rounded-[24px] border border-orange-100 bg-white/90 p-4 text-slate-800 shadow-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white"
          />

          <div className="mt-4 flex gap-3">
            <button
              onClick={generateHooks}
              className="rounded-2xl bg-[linear-gradient(135deg,_#f59e0b,_#f97316)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(245,158,11,0.25)] transition hover:-translate-y-0.5"
            >
              Generate Hooks
            </button>
            <button
              onClick={handleGenerate}
              className="flex-1 rounded-2xl bg-[linear-gradient(135deg,_#2563eb,_#4338ca)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(59,130,246,0.24)] transition hover:-translate-y-0.5"
            >
              {loading ? "Generating..." : "Generate Slides"}
            </button>
          </div>

          <div className="mt-6 rounded-[24px] border border-sky-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(239,246,255,0.96)_100%)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Hook Options
              </h3>
              {selectedHook ?
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  Selected
                </span>
              : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Pick a hook to steer the tone of the generated slides.
            </p>

            <div className="mt-3 flex flex-col gap-3">
              {hooks.map((hook, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedHook(hook)}
                  className={`rounded-[20px] border p-4 text-left text-sm leading-6 transition ${
                    selectedHook === hook ?
                      "border-blue-500 bg-[linear-gradient(135deg,_#eff6ff,_#eef2ff)] shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {hook}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="relative flex h-full flex-col overflow-hidden rounded-[30px] border border-white/30 bg-[linear-gradient(180deg,_rgba(255,255,255,0.18)_0%,_rgba(254,242,242,0.14)_45%,_rgba(239,246,255,0.18)_100%)] p-6 shadow-xl backdrop-blur-lg">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.12),_transparent_32%),radial-gradient(circle_at_center,_rgba(168,85,247,0.08),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(14,165,233,0.10),_transparent_28%)]" />
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                {previewMode ? "Live Preview" : "Slide Workspace"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {previewMode ?
                  "Switch through a polished social preview without editing controls."
                : "Your slides are stacked vertically for easier editing."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-500 shadow-sm backdrop-blur">
                {slides.length} slide{slides.length === 1 ? "" : "s"}
              </div>
              <button
                onClick={() => setPreviewMode((current) => !current)}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                {previewMode ? "Edit" : "Preview"}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {slides.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-full max-w-2xl rounded-[36px] border border-white/70 bg-[linear-gradient(135deg,_rgba(255,255,255,0.92)_0%,_rgba(238,242,255,0.92)_45%,_rgba(254,242,242,0.92)_100%)] p-10 text-center shadow-[0_28px_60px_rgba(15,23,42,0.10)]">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,_#7c3aed,_#ec4899)] text-3xl text-white shadow-[0_16px_40px_rgba(168,85,247,0.35)]">
                    ✨
                  </div>
                  <h3 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">
                    Start creating your content
                  </h3>
                  <p className="mt-3 text-base leading-7 text-slate-500">
                    Enter an idea and generate beautiful slides for your next
                    carousel, post, or story.
                  </p>

                  <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <button
                      onClick={generateHooks}
                      className="rounded-2xl bg-[linear-gradient(135deg,_#f59e0b,_#f97316)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(245,158,11,0.28)] transition hover:-translate-y-0.5"
                    >
                      Generate Hooks
                    </button>
                    <button
                      onClick={handleGenerate}
                      className="rounded-2xl bg-[linear-gradient(135deg,_#2563eb,_#4338ca)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(59,130,246,0.25)] transition hover:-translate-y-0.5"
                    >
                      {loading ? "Generating..." : "Generate Slides"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-8">
                {previewMode
                  ? slides.map((slide, index) => (
                      <div
                        key={index}
                        className="mx-auto w-full max-w-[420px] rounded-[40px] border border-white/40 bg-white/35 p-4 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl"
                      >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#fb7185,_#8b5cf6,_#3b82f6)] text-sm font-bold text-white">
                          SM
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            socialmediastudio
                          </p>
                          <p className="text-xs text-slate-500">
                            Slide {index + 1} preview
                          </p>
                        </div>
                      </div>
                      <span className="text-slate-400">•••</span>
                    </div>

                    <div
                      className={`
                        ${
                          format === "carousel" ? "w-full aspect-square"
                          : format === "story" ?
                            "w-full max-w-[320px] aspect-[9/16] mx-auto"
                          : "w-full aspect-square"
                        }
                        ${themes[theme as keyof typeof themes]}
                        ${fontClasses[font as keyof typeof fontClasses]}
                        ${alignmentClasses[alignment as keyof typeof alignmentClasses]}
                        relative overflow-hidden rounded-[32px] border border-white/20 shadow-xl flex flex-col justify-center text-white
                      `}
                      style={{
                        padding: `${padding}px`,
                        background:
                          theme === "custom" ? customColor : undefined,
                      }}
                    >
                      {theme !== "custom" && slide.imageUrl ?
                        <>
                          <img
                            src={slide.imageUrl}
                            alt={slide.title}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-slate-950/45" />
                        </>
                      : null}
                      <div className="relative z-10 flex h-full flex-col justify-center">
                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/90 backdrop-blur self-start">
                          {format}
                        </span>
                        <h3 className="mt-6 text-3xl font-bold tracking-tight">
                          {slide.title}
                        </h3>
                        <p className="mt-4 text-base leading-7 text-white/90">
                          {slide.content}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between px-2 text-slate-500">
                      <span>♡</span>
                      <span>💬</span>
                      <span>↗</span>
                      <span>🔖</span>
                    </div>
                  </div>
                ))
                  : slides.map((slide, index) => (
                    <div
                      key={index}
                      data-slide-index={index}
                      ref={(el) => {
                        slideRefs.current[index] = el;
                      }}
                    className={`
                      ${
                        format === "carousel" ? "w-full aspect-square"
                        : format === "story" ?
                          "w-full max-w-[360px] aspect-[9/16] self-center"
                        : "w-full aspect-square"
                      }
                      ${themes[theme as keyof typeof themes]}
                      ${fontClasses[font as keyof typeof fontClasses]}
                      ${alignmentClasses[alignment as keyof typeof alignmentClasses]}
                      relative overflow-hidden rounded-[36px] border border-white/30 bg-white/20 shadow-xl backdrop-blur-lg flex flex-col justify-center text-white
                    `}
                    style={{
                      padding: `${padding}px`,
                      background: theme === "custom" ? customColor : undefined,
                    }}
                  >
                    {theme !== "custom" && slide.imageUrl ?
                      <>
                        <img
                          src={slide.imageUrl}
                          alt={slide.title}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/45" />
                      </>
                    : null}
                    <div className="relative z-10 flex h-full flex-col justify-center">
                      <div className="flex w-full items-center justify-between">
                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/90 backdrop-blur">
                          Slide {index + 1}
                        </span>
                        <button
                          onClick={() => regenerateSlide(index)}
                          className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
                        >
                          Regenerate
                        </button>
                      </div>

                      <textarea
                        rows={2}
                        value={slide.title}
                        onChange={(e) => {
                          const updated = [...slides];
                          updated[index].title = e.target.value;
                          setSlides(updated);
                        }}
                        className="mt-6 w-full min-h-[4.5rem] resize-none bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-white/70"
                      />

                      <textarea
                        value={slide.content}
                        onChange={(e) => {
                          const updated = [...slides];
                          updated[index].content = e.target.value;
                          setSlides(updated);
                        }}
                        className="mt-4 w-full flex-1 resize-none break-words bg-transparent text-base leading-7 outline-none placeholder:text-white/70"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="h-full overflow-y-auto rounded-[28px] border border-white/30 bg-white/20 p-6 shadow-xl backdrop-blur-lg">
          <div className="rounded-[24px] bg-[linear-gradient(135deg,_#ffffff_0%,_#eff6ff_45%,_#fdf2f8_100%)] p-5 shadow-sm ring-1 ring-slate-100">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              Design
            </span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">
              Customize
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Adjust the theme, type, spacing, and presentation feel.
            </p>
          </div>

          <div className="mt-6 rounded-[24px] border border-fuchsia-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(250,245,255,0.96)_100%)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Theme
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {Object.keys(themes).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold capitalize text-white shadow-sm transition hover:-translate-y-0.5 ${
                    t === "purple" ? "bg-purple-500"
                    : t === "blue" ? "bg-blue-500"
                    : t === "green" ? "bg-green-500"
                    : t === "orange" ? "bg-orange-500"
                    : t === "custom" ? "bg-pink-500"
                    : "bg-slate-900"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-pink-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(253,242,248,0.96)_100%)] p-4 shadow-sm">
            <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Custom Color
            </label>
            <input
              type="color"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                setTheme("custom");
              }}
              className="mt-3 block h-12 w-full rounded-2xl border border-slate-200 bg-white p-1"
            />
          </div>

          <div className="mt-6 rounded-[24px] border border-sky-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(239,246,255,0.96)_100%)] p-4 shadow-sm">
            <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Font
            </label>
            <select
              value={font}
              onChange={(e) => setFont(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3"
            >
              <option value="sans">Sans</option>
              <option value="serif">Serif</option>
              <option value="mono">Mono</option>
              <option value="display">Display</option>
              <option value="editorial">Editorial</option>
            </select>
          </div>

          <div className="mt-6 rounded-[24px] border border-amber-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(255,251,235,0.96)_100%)] p-4 shadow-sm">
            <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Alignment
            </label>
            <select
              value={alignment}
              onChange={(e) => setAlignment(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3"
            >
              <option value="center">Center</option>
              <option value="left">Left</option>
            </select>
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(248,250,252,0.96)_100%)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Padding
              </label>
              <span className="text-sm text-slate-500">{padding}px</span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              value={padding}
              onChange={(e) => setPadding(Number(e.target.value))}
              className="mt-3 w-full"
            />
          </div>
        </aside>
      </div>
    </main>
  );
}