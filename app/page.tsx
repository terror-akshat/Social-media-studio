"use client";

import html2canvas from "html2canvas";
import JSZip from "jszip";
import { useState } from "react";

type Slide = { id: string; title: string; content: string };
type SlidePayload = { title: string; content: string };
type ThemeName =
  | "purple"
  | "blue"
  | "green"
  | "orange"
  | "dark"
  | "sunset"
  | "ocean"
  | "berry"
  | "custom";
type FormatName = "carousel" | "post" | "story";
type ToneName = "bold" | "professional" | "casual" | "educational";
type AudienceName = "founders" | "parents" | "students" | "creators";
type CtaStyleName = "soft" | "direct" | "community" | "urgent";
type LayoutTemplate = "balanced" | "hero" | "split" | "minimal";
type Notice = { tone: "error" | "success"; message: string } | null;

const TITLE_LIMIT = 90;
const CONTENT_LIMIT = 280;
const CAPTION_LIMIT = 400;

const createSlideId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const cleanSlideText = (text: string, idea: string) => {
  let cleaned = text?.trim() || "";
  if (!cleaned) return cleaned;
  cleaned = cleaned.replace(/^[\s\n]*Slide\s*\d+\s*[:.\-–—]*\s*/i, "");
  if (idea) {
    const ideaPrefix = new RegExp(`^\\s*${escapeRegExp(idea)}[\\s:.\\-–—]*`, "i");
    cleaned = cleaned.replace(ideaPrefix, "");
  }
  return cleaned.trim();
};

const normalizeSlide = (slide: SlidePayload, idea: string): Slide => ({
  id: createSlideId(),
  title: cleanSlideText(slide.title, idea).slice(0, TITLE_LIMIT),
  content: cleanSlideText(slide.content, idea).slice(0, CONTENT_LIMIT),
});

const parseAPIError = async (response: Response) => {
  try {
    const data = await response.json();
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
  } catch {}
  return `Request failed with status ${response.status}`;
};

const hexToRgb = (value: string) => {
  const normalized = value.replace("#", "");
  const hex =
    normalized.length === 3
      ? normalized.split("").map((char) => char + char).join("")
      : normalized;
  const parsed = Number.parseInt(hex, 16);
  if (Number.isNaN(parsed) || hex.length !== 6) return { r: 99, g: 102, b: 241 };
  return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 };
};

const toRgba = (value: string, alpha: number) => {
  const { r, g, b } = hexToRgb(value);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
  "social-media-slides";

const getFormatDimensions = (format: FormatName) =>
  format === "story"
    ? {
        width: 1080,
        height: 1920,
        editClass: "w-full max-w-[360px] aspect-[9/16] self-center",
        previewClass: "w-full max-w-[320px] aspect-[9/16] mx-auto",
        label: "story",
      }
    : {
        width: 1080,
        height: 1080,
        editClass: "w-full aspect-square",
        previewClass: "w-full aspect-square",
        label: format,
      };

const getFontStyles = (font: string) => {
  if (font === "serif") return { className: "font-serif", family: "Georgia, Times New Roman, serif" };
  if (font === "mono") return { className: "font-mono", family: "Consolas, Courier New, monospace" };
  if (font === "display") return { className: "font-serif uppercase tracking-wide", family: "Georgia, Times New Roman, serif" };
  if (font === "editorial") return { className: "font-serif italic", family: "Georgia, Times New Roman, serif" };
  return { className: "font-sans", family: "Segoe UI, Helvetica Neue, Arial, sans-serif" };
};

const getAlignmentStyles = (alignment: string) =>
  alignment === "left"
    ? { className: "text-left items-start", textAlign: "left" as const, alignItems: "flex-start" as const }
    : { className: "text-center items-center", textAlign: "center" as const, alignItems: "center" as const };

export default function Home() {
  const [idea, setIdea] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [hooks, setHooks] = useState<string[]>([]);
  const [selectedHook, setSelectedHook] = useState("");
  const [format, setFormat] = useState<FormatName>("carousel");
  const [tone, setTone] = useState<ToneName>("professional");
  const [audience, setAudience] = useState<AudienceName>("creators");
  const [ctaStyle, setCtaStyle] = useState<CtaStyleName>("soft");
  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplate>("balanced");
  const [theme, setTheme] = useState<ThemeName>("purple");
  const [customColor, setCustomColor] = useState("#6366f1");
  const [font, setFont] = useState("sans");
  const [fontSize, setFontSize] = useState(100);
  const [lineHeight, setLineHeight] = useState(100);
  const [alignment, setAlignment] = useState("center");
  const [padding, setPadding] = useState(24);
  const [previewMode, setPreviewMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);

  const setError = (message: string) => setNotice({ tone: "error", message });
  const clearNotice = () => setNotice(null);

  const getThemeStyles = () => {
    if (theme === "purple") return { background: "linear-gradient(135deg, #667eea 0%, #764ba2 40%, #ff758c 100%)", overlay: "radial-gradient(circle at top, rgba(255,255,255,0.25), transparent 60%)" };
    if (theme === "blue") return { background: "linear-gradient(135deg, #00c6ff 0%, #0072ff 40%, #3a7bd5 100%)", overlay: "radial-gradient(circle at top right, rgba(255,255,255,0.2), transparent 60%)" };
    if (theme === "green") return { background: "linear-gradient(135deg, #11998e 0%, #38ef7d 50%, #00ff87 100%)", overlay: "radial-gradient(circle at bottom, rgba(255,255,255,0.2), transparent 60%)" };
    if (theme === "orange") return { background: "linear-gradient(135deg, #ff8008 0%, #ffc837 50%, #ff512f 100%)", overlay: "radial-gradient(circle at center, rgba(255,255,255,0.15), transparent 60%)" };
    if (theme === "dark") return { background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)", overlay: "radial-gradient(circle at top, rgba(255,255,255,0.1), transparent 60%)" };
    if (theme === "sunset") return { background: "linear-gradient(135deg, #f97316 0%, #fb7185 45%, #facc15 100%)", overlay: "radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 55%)" };
    if (theme === "ocean") return { background: "linear-gradient(135deg, #0f766e 0%, #0891b2 45%, #38bdf8 100%)", overlay: "radial-gradient(circle at bottom right, rgba(255,255,255,0.16), transparent 55%)" };
    if (theme === "berry") return { background: "linear-gradient(135deg, #7e22ce 0%, #db2777 50%, #fb7185 100%)", overlay: "radial-gradient(circle at top, rgba(255,255,255,0.16), transparent 58%)" };
    return { background: `linear-gradient(135deg, ${customColor}, ${toRgba(customColor, 0.45)})`, overlay: "radial-gradient(circle at top left, rgba(255,255,255,0.2), transparent 60%)" };
  };

  const themeStyles = getThemeStyles();
  const formatStyles = getFormatDimensions(format);
  const fontStyles = getFontStyles(font);
  const alignmentStyles = getAlignmentStyles(alignment);
  const themeOptions: ThemeName[] = ["purple", "blue", "green", "orange", "dark", "sunset", "ocean", "berry", "custom"];
  const titleScale = fontSize / 100;
  const bodyScale = Math.max(0.85, fontSize / 110);
  const bodyLineHeight = 1.45 * (lineHeight / 100);
  const layoutClasses =
    layoutTemplate === "hero"
      ? "justify-end"
      : layoutTemplate === "split"
        ? "justify-between"
        : layoutTemplate === "minimal"
          ? "justify-center"
          : "justify-center";
  const contentMaxWidth =
    layoutTemplate === "minimal"
      ? "max-w-[20rem]"
      : layoutTemplate === "hero"
        ? "max-w-[28rem]"
        : "max-w-full";

  const updateSlide = (id: string, field: "title" | "content", value: string) => {
    const limit = field === "title" ? TITLE_LIMIT : CONTENT_LIMIT;
    setSlides((current) => current.map((slide) => (slide.id === id ? { ...slide, [field]: value.slice(0, limit) } : slide)));
  };

  const addSlide = (index?: number) => {
    const nextSlide: Slide = { id: createSlideId(), title: "", content: "" };
    setSlides((current) => {
      const insertAt = index === undefined ? current.length : index + 1;
      const next = [...current];
      next.splice(insertAt, 0, nextSlide);
      return next;
    });
  };

  const duplicateSlide = (index: number) => setSlides((current) => {
    const source = current[index];
    if (!source) return current;
    const next = [...current];
    next.splice(index + 1, 0, { ...source, id: createSlideId() });
    return next;
  });

  const deleteSlide = (index: number) => setSlides((current) => current.filter((_, currentIndex) => currentIndex !== index));

  const moveSlide = (index: number, direction: -1 | 1) => setSlides((current) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= current.length) return current;
    const next = [...current];
    const [slide] = next.splice(index, 1);
    next.splice(targetIndex, 0, slide);
    return next;
  });

  const applyCoverPreset = () => {
    if (slides.length === 0) {
      setSlides([
        {
          id: createSlideId(),
          title: idea.trim() || "New post",
          content: `A ${tone} opener for ${audience} that makes them want to keep reading.`,
        },
      ]);
      return;
    }

    setSlides((current) => {
      const next = [...current];
      const fallbackTitle = idea.trim() || "New post";
      next[0] = {
        ...next[0],
        title: next[0].title || fallbackTitle,
        content:
          next[0].content ||
          `A ${tone} opener for ${audience} that makes them want to keep reading.`,
      };
      return next;
    });
  };

  const applyCtaPreset = () => {
    if (slides.length === 0) {
      setSlides([
        {
          id: createSlideId(),
          title: "Your next step",
          content: `Close with a ${ctaStyle} CTA that feels right for ${audience}.`,
        },
      ]);
      return;
    }

    setSlides((current) => {
      const next = [...current];
      const lastIndex = next.length - 1;
      next[lastIndex] = {
        ...next[lastIndex],
        title: next[lastIndex].title || "Your next step",
        content:
          next[lastIndex].content ||
          `Close with a ${ctaStyle} CTA that feels right for ${audience}.`,
      };
      return next;
    });
  };

  const generateCaption = async () => {
    if (!idea.trim() || slides.length === 0) {
      setError("Generate slides first, then create the caption and hashtags.");
      return;
    }

    clearNotice();
    setCaptionLoading(true);

    try {
      const res = await fetch("/api/caption", {
        method: "POST",
        body: JSON.stringify({
          idea,
          format,
          tone,
          audience,
          ctaStyle,
          slides: slides.map(({ title, content }) => ({ title, content })),
        }),
      });

      if (!res.ok) throw new Error(await parseAPIError(res));
      const data = await res.json();
      setCaption(typeof data.caption === "string" ? data.caption.slice(0, CAPTION_LIMIT) : "");
      setHashtags(Array.isArray(data.hashtags) ? data.hashtags : []);
    } catch (error) {
      console.error("Caption generation failed", error);
      setError(error instanceof Error ? error.message : "Caption generation failed");
    } finally {
      setCaptionLoading(false);
    }
  };

  const createExportCard = (slide: Slide, index: number) => {
    const exportNode = document.createElement("div");
    const exportPadding = Math.max(padding * 4, 72);
    const titleFontSize = (format === "story" ? 88 : 72) * titleScale;
    const bodyFontSize = (format === "story" ? 44 : 40) * bodyScale;

    exportNode.style.position = "fixed";
    exportNode.style.left = "-99999px";
    exportNode.style.top = "0";
    exportNode.style.width = `${formatStyles.width}px`;
    exportNode.style.height = `${formatStyles.height}px`;
    exportNode.style.overflow = "hidden";
    exportNode.style.borderRadius = "72px";
    exportNode.style.display = "flex";
    exportNode.style.flexDirection = "column";
    exportNode.style.justifyContent = "center";
    exportNode.style.padding = `${exportPadding}px`;
    exportNode.style.background = themeStyles.background;
    exportNode.style.color = "#ffffff";
    exportNode.style.fontFamily = fontStyles.family;
    exportNode.style.textAlign = alignmentStyles.textAlign;
    exportNode.style.alignItems = alignmentStyles.alignItems;
    exportNode.style.boxSizing = "border-box";
    exportNode.innerHTML = `
      <div style="position:absolute; inset:0; background:${themeStyles.overlay};"></div>
      <div style="position:relative; z-index:1; display:flex; flex-direction:column; justify-content:${layoutTemplate === "hero" ? "flex-end" : layoutTemplate === "split" ? "space-between" : "center"}; align-items:${alignmentStyles.alignItems}; text-align:${alignmentStyles.textAlign}; height:100%;">
        <span style="display:inline-flex; align-self:${alignment === "left" ? "flex-start" : "center"}; padding:18px 30px; border-radius:999px; background:rgba(255,255,255,0.15); font-size:28px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase;">
          ${escapeHtml(format === "post" ? "post" : format === "story" ? "story" : `slide ${index + 1}`)}
        </span>
        <h2 style="margin:48px 0 0; font-size:${titleFontSize}px; line-height:1.05; font-weight:800; letter-spacing:-0.03em; white-space:pre-wrap;">
          ${escapeHtml(slide.title || "Untitled slide")}
        </h2>
        <p style="margin:36px 0 0; max-width:${layoutTemplate === "minimal" ? "720px" : layoutTemplate === "hero" ? "840px" : "100%"}; font-size:${bodyFontSize}px; line-height:${bodyLineHeight}; color:rgba(255,255,255,0.92); white-space:pre-wrap;">
          ${escapeHtml(slide.content || "Add your supporting copy here.")}
        </p>
      </div>
    `;

    return exportNode;
  };

  const downloadZIP = async () => {
    if (slides.length === 0) {
      setError("Generate or add slides before exporting.");
      return;
    }

    clearNotice();
    setExporting(true);

    try {
      const zip = new JSZip();
      const baseName = `${slugify(idea || "social-media-studio")}-${format}`;

      for (let i = 0; i < slides.length; i++) {
        const exportNode = createExportCard(slides[i], i);
        document.body.appendChild(exportNode);
        const canvas = await html2canvas(exportNode, { backgroundColor: null, scale: 2 });
        document.body.removeChild(exportNode);
        const imgData = canvas.toDataURL("image/png");
        const imgBlob = await (await fetch(imgData)).blob();
        zip.file(`${String(i + 1).padStart(2, "0")}-${baseName}.png`, imgBlob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const objectUrl = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${baseName}.zip`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error("Export failed", error);
      setError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const generateHooks = async () => {
    if (!idea.trim()) {
      setError("Enter an idea first.");
      return;
    }

    clearNotice();
    setHooksLoading(true);

    try {
      const res = await fetch("/api/hooks", { method: "POST", body: JSON.stringify({ idea }) });
      if (!res.ok) throw new Error(await parseAPIError(res));
      const data = await res.json();
      setHooks(Array.isArray(data.hooks) ? data.hooks : []);
    } catch (error) {
      console.error("Hook generation failed", error);
      setError(error instanceof Error ? error.message : "Hook generation failed");
    } finally {
      setHooksLoading(false);
    }
  };

  const regenerateSlide = async (index: number) => {
    clearNotice();
    setRegeneratingIndex(index);

    try {
      const res = await fetch("/api/regenerate", {
        method: "POST",
        body: JSON.stringify({ idea, index, format, tone, audience, ctaStyle, layoutTemplate }),
      });
      if (!res.ok) throw new Error(await parseAPIError(res));
      const data = await res.json();
      if (!data.slide) throw new Error("No regenerated slide was returned.");
      const nextSlide = normalizeSlide(data.slide as SlidePayload, idea);
      setSlides((current) => {
        const next = [...current];
        next[index] = nextSlide;
        return next;
      });
    } catch (error) {
      console.error("Regenerate failed", error);
      setError(error instanceof Error ? error.message : "Regenerate failed");
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError("Please enter an idea.");
      return;
    }

    clearNotice();
    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({ idea, format, hook: selectedHook, tone, audience, ctaStyle, layoutTemplate }),
      });
      if (!res.ok) throw new Error(await parseAPIError(res));
      const data = await res.json();
      if (!Array.isArray(data.slides) || data.slides.length === 0) {
        throw new Error("No slides were returned.");
      }
      setSlides((data.slides as SlidePayload[]).map((slide) => normalizeSlide(slide, idea)));
    } catch (error) {
      console.error("Slide generation failed", error);
      setError(error instanceof Error ? error.message : "Slide generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-y-auto bg-[linear-gradient(135deg,_#fff7ed_0%,_#fdf2f8_24%,_#eff6ff_58%,_#eef2ff_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.30)_0%,_transparent_24%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.24)_0%,_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(236,72,153,0.18)_0%,_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.20)_0%,_transparent_28%)]" />
      <div className="pointer-events-none absolute left-[8%] top-[10%] h-56 w-56 rounded-full bg-orange-300/30 blur-3xl" />
      <div className="pointer-events-none absolute right-[10%] top-[14%] h-64 w-64 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[8%] left-[30%] h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />

      <div className="border-b border-white/50 bg-white/65 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white">Studio</span>
              <span className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Creator Workspace</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Social Media Studio</h1>
            <p className="mt-2 text-base font-semibold tracking-wide text-fuchsia-600 animate-pulse">{"\u2728 Build. Design. Export."}</p>
            <p className="mt-1 text-sm text-slate-500">Build, refine, and export content like a presentation deck.</p>
          </div>

          <button
            onClick={downloadZIP}
            disabled={exporting || slides.length === 0}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? "Exporting..." : "Download ZIP"}
          </button>
        </div>
      </div>

      <div className="mx-auto grid h-[calc(100vh-93px)] max-w-[1800px] gap-6 overflow-hidden px-6 py-6 lg:grid-cols-[340px_minmax(0,1fr)_320px]">
        <aside className="h-full overflow-y-auto rounded-[28px] border border-white/30 bg-white/20 px-6 pt-6 pb-10 shadow-xl backdrop-blur-lg">
          <div className="mt-6 rounded-[24px] border border-orange-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.95)_0%,_rgba(255,247,237,0.92)_100%)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Format</h3>
            <p className="mt-1 text-xs text-slate-500">Choose the output structure before generating.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(["carousel", "post", "story"] as FormatName[]).map((currentFormat) => (
                <button
                  key={currentFormat}
                  onClick={() => setFormat(currentFormat)}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${format === currentFormat ? "bg-slate-950 text-white shadow-lg" : "bg-white text-slate-700 shadow-sm hover:bg-slate-100"}`}
                >
                  {currentFormat[0].toUpperCase() + currentFormat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Topic</h3>
            <p className="mt-1 text-xs text-slate-500">Describe the idea you want turned into slides.</p>
          </div>

          <textarea
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            placeholder="Enter your idea..."
            className="mt-3 h-36 w-full rounded-[24px] border border-orange-100 bg-white/90 p-4 text-slate-800 shadow-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white"
          />

          <div className="mt-6 rounded-[24px] border border-indigo-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(238,242,255,0.96)_100%)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Content Controls</h3>
            <div className="mt-4 grid gap-4">
              <label className="text-sm font-medium text-slate-600">
                Tone
                <select value={tone} onChange={(event) => setTone(event.target.value as ToneName)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <option value="bold">Bold</option>
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="educational">Educational</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-600">
                Audience
                <select value={audience} onChange={(event) => setAudience(event.target.value as AudienceName)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <option value="founders">Founders</option>
                  <option value="parents">Parents</option>
                  <option value="students">Students</option>
                  <option value="creators">Creators</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-600">
                CTA Style
                <select value={ctaStyle} onChange={(event) => setCtaStyle(event.target.value as CtaStyleName)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <option value="soft">Soft</option>
                  <option value="direct">Direct</option>
                  <option value="community">Community</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={generateHooks}
              disabled={hooksLoading || loading}
              className="rounded-2xl bg-[linear-gradient(135deg,_#f59e0b,_#f97316)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(245,158,11,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {hooksLoading ? "Loading..." : "Generate Hooks"}
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading || hooksLoading}
              className="flex-1 rounded-2xl bg-[linear-gradient(135deg,_#2563eb,_#4338ca)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(59,130,246,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Generating..." : "Generate Slides"}
            </button>
          </div>

          <div className="mt-6 rounded-[24px] border border-sky-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(239,246,255,0.96)_100%)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Hook Options</h3>
              {selectedHook ? <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Selected</span> : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">Pick a hook to steer the tone of the generated slides.</p>

            {hooks.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm text-slate-500">
                {hooksLoading ? "Generating hooks..." : "No hooks yet. Generate a few options to choose from."}
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {hooks.map((hook, index) => (
                  <button
                    key={`${hook}-${index}`}
                    onClick={() => setSelectedHook(hook)}
                    className={`rounded-[20px] border p-4 text-left text-sm leading-6 transition ${selectedHook === hook ? "border-blue-500 bg-[linear-gradient(135deg,_#eff6ff,_#eef2ff)] shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                  >
                    {hook}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(236,253,245,0.96)_100%)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Caption Kit</h3>
              <button
                onClick={generateCaption}
                disabled={captionLoading || slides.length === 0}
                className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {captionLoading ? "Generating..." : "Generate"}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Create a ready-to-post caption and hashtag set from the current slides.</p>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value.slice(0, CAPTION_LIMIT))}
              placeholder="Your caption will appear here."
              className="mt-3 h-32 w-full rounded-[20px] border border-emerald-100 bg-white/90 p-4 text-sm text-slate-700 shadow-sm outline-none"
            />
            <div className="mt-2 text-xs text-slate-500">{caption.length}/{CAPTION_LIMIT} characters</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {hashtags.length === 0 ? <span className="text-xs text-slate-500">No hashtags yet.</span> : hashtags.map((tag) => (
                <span key={tag} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{tag}</span>
              ))}
            </div>
          </div>
        </aside>

        <section className="relative flex h-full flex-col overflow-hidden rounded-[30px] border border-white/30 bg-[linear-gradient(180deg,_rgba(255,255,255,0.18)_0%,_rgba(254,242,242,0.14)_45%,_rgba(239,246,255,0.18)_100%)] p-6 shadow-xl backdrop-blur-lg">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.12),_transparent_32%),radial-gradient(circle_at_center,_rgba(168,85,247,0.08),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(14,165,233,0.10),_transparent_28%)]" />
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">{previewMode ? "Live Preview" : "Slide Workspace"}</h2>
              <p className="mt-1 text-sm text-slate-500">{previewMode ? "Preview the final presentation-style output." : "Edit slide content, structure, and order from one workspace."}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-500 shadow-sm backdrop-blur">{slides.length} slide{slides.length === 1 ? "" : "s"}</div>
              <button onClick={() => addSlide()} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100">Add Slide</button>
              <button onClick={() => setPreviewMode((current) => !current)} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">{previewMode ? "Edit" : "Preview"}</button>
            </div>
          </div>

          {notice ? (
            <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm shadow-sm ${notice.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {notice.message}
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto pr-2">
            {slides.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-full max-w-2xl rounded-[36px] border border-white/70 bg-[linear-gradient(135deg,_rgba(255,255,255,0.92)_0%,_rgba(238,242,255,0.92)_45%,_rgba(254,242,242,0.92)_100%)] p-10 text-center shadow-[0_28px_60px_rgba(15,23,42,0.10)]">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,_#7c3aed,_#ec4899)] text-3xl text-white shadow-[0_16px_40px_rgba(168,85,247,0.35)]">{"\u2728"}</div>
                  <h3 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">Start creating your content</h3>
                  <p className="mt-3 text-base leading-7 text-slate-500">Generate a starter deck or add a blank slide manually to begin shaping your content.</p>
                  <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <button onClick={generateHooks} disabled={hooksLoading || loading} className="rounded-2xl bg-[linear-gradient(135deg,_#f59e0b,_#f97316)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(245,158,11,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">{hooksLoading ? "Loading..." : "Generate Hooks"}</button>
                    <button onClick={handleGenerate} disabled={loading || hooksLoading} className="rounded-2xl bg-[linear-gradient(135deg,_#2563eb,_#4338ca)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(59,130,246,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Generating..." : "Generate Slides"}</button>
                    <button onClick={() => addSlide()} className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50">Add Blank Slide</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-8">
                {previewMode ? slides.map((slide, index) => (
                  <div key={slide.id} className="mx-auto w-full max-w-[420px] rounded-[40px] border border-white/40 bg-white/35 p-4 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#fb7185,_#8b5cf6,_#3b82f6)] text-sm font-bold text-white">SM</div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">socialmediastudio</p>
                          <p className="text-xs text-slate-500">Slide {index + 1} preview</p>
                        </div>
                      </div>
                      <span className="text-slate-400">•••</span>
                    </div>

                    <div className={`${formatStyles.previewClass} ${fontStyles.className} ${alignmentStyles.className} ${layoutClasses} relative overflow-hidden rounded-[32px] border border-white/20 shadow-xl flex flex-col text-white`} style={{ padding: `${padding}px`, background: themeStyles.background }}>
                      <div className="absolute inset-0" style={{ background: themeStyles.overlay }} />
                      <div className={`relative z-10 flex h-full flex-col ${layoutClasses}`}>
                        <span className="self-start rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/90 backdrop-blur">{formatStyles.label}</span>
                        <h3 className={`mt-6 font-bold tracking-tight ${contentMaxWidth}`} style={{ fontSize: `${1.875 * titleScale}rem`, lineHeight: 1.05 }}>{slide.title || "Untitled slide"}</h3>
                        <p className={`mt-4 pb-6 text-white/90 whitespace-pre-wrap ${contentMaxWidth}`} style={{ fontSize: `${1 * bodyScale}rem`, lineHeight: bodyLineHeight }}>{slide.content || "No content added yet."}</p>
                      </div>
                    </div>
                  </div>
                )) : slides.map((slide, index) => (
                  <div key={slide.id} data-slide-index={index} className={`${formatStyles.editClass} ${fontStyles.className} ${alignmentStyles.className} relative overflow-hidden rounded-[36px] border border-white/30 bg-white/20 shadow-xl backdrop-blur-lg flex flex-col text-white`} style={{ padding: `${padding}px`, background: themeStyles.background }}>
                    <div className="absolute inset-0" style={{ background: themeStyles.overlay }} />
                    <div className={`relative z-10 flex h-full flex-col ${layoutTemplate === "split" ? "justify-between" : layoutTemplate === "hero" ? "justify-end" : "justify-between"} gap-4 pb-4`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/90 backdrop-blur">Slide {index + 1}</span>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => moveSlide(index, -1)} disabled={index === 0} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Up</button>
                          <button onClick={() => moveSlide(index, 1)} disabled={index === slides.length - 1} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Down</button>
                          <button onClick={() => duplicateSlide(index)} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100">Duplicate</button>
                          <button onClick={() => addSlide(index)} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100">Add Below</button>
                          <button onClick={() => regenerateSlide(index)} disabled={regeneratingIndex === index} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">{regeneratingIndex === index ? "Regenerating..." : "Regenerate"}</button>
                          <button onClick={() => deleteSlide(index)} disabled={slides.length === 1} className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50">Delete</button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <textarea rows={2} maxLength={TITLE_LIMIT} value={slide.title} onChange={(event) => updateSlide(slide.id, "title", event.target.value)} placeholder="Slide title" className={`w-full resize-none bg-transparent font-bold outline-none placeholder:text-white/70 ${contentMaxWidth}`} style={{ fontSize: `${1.875 * titleScale}rem`, lineHeight: 1.05 }} />
                        <div className="text-xs text-white/70">{slide.title.length}/{TITLE_LIMIT} characters</div>
                      </div>

                      <div className="flex min-h-0 flex-1 flex-col gap-2">
                        <textarea maxLength={CONTENT_LIMIT} value={slide.content} onChange={(event) => updateSlide(slide.id, "content", event.target.value)} placeholder="Add the supporting content for this slide." className={`min-h-[220px] w-full flex-1 resize-none break-words bg-transparent outline-none placeholder:text-white/70 ${contentMaxWidth}`} style={{ fontSize: `${1 * bodyScale}rem`, lineHeight: bodyLineHeight }} />
                        <div className="text-xs text-white/70">{slide.content.length}/{CONTENT_LIMIT} characters</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="h-full overflow-y-auto rounded-[28px] border border-white/30 bg-white/20 px-6 pt-6 pb-10 shadow-xl backdrop-blur-lg">
          <div className="rounded-[24px] bg-[linear-gradient(135deg,_#ffffff_0%,_#eff6ff_45%,_#fdf2f8_100%)] p-5 shadow-sm ring-1 ring-slate-100">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">Design</span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">Customize</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Adjust the theme, type, spacing, and presentation feel.</p>
          </div>

          <div className="mt-6 rounded-[24px] border border-fuchsia-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(250,245,255,0.96)_100%)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Theme</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {themeOptions.map((option) => (
                <button key={option} onClick={() => setTheme(option)} className={`rounded-2xl px-4 py-3 text-sm font-semibold capitalize text-white shadow-sm transition hover:-translate-y-0.5 ${option === "purple" ? "bg-purple-500" : option === "blue" ? "bg-blue-500" : option === "green" ? "bg-green-500" : option === "orange" ? "bg-orange-500" : option === "sunset" ? "bg-amber-500" : option === "ocean" ? "bg-cyan-600" : option === "berry" ? "bg-pink-600" : option === "custom" ? "bg-pink-500" : "bg-slate-900"} ${theme === option ? "ring-2 ring-slate-900 ring-offset-2 ring-offset-white" : ""}`}>{option}</button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-pink-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(253,242,248,0.96)_100%)] p-4 shadow-sm">
            <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Custom Color</label>
            <input type="color" value={customColor} onChange={(event) => { setCustomColor(event.target.value); setTheme("custom"); }} className="mt-3 block h-12 w-full rounded-2xl border border-slate-200 bg-white p-1" />
          </div>

          <div className="mt-6 rounded-[24px] border border-sky-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(239,246,255,0.96)_100%)] p-4 shadow-sm">
            <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Font</label>
            <select value={font} onChange={(event) => setFont(event.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option><option value="display">Display</option><option value="editorial">Editorial</option>
            </select>
          </div>

          <div className="mt-6 rounded-[24px] border border-violet-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(245,243,255,0.96)_100%)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Font Size</label>
              <span className="text-sm text-slate-500">{fontSize}%</span>
            </div>
            <input type="range" min="80" max="140" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} className="mt-3 w-full" />
          </div>

          <div className="mt-6 rounded-[24px] border border-violet-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(245,243,255,0.96)_100%)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Line Height</label>
              <span className="text-sm text-slate-500">{lineHeight}%</span>
            </div>
            <input type="range" min="85" max="140" value={lineHeight} onChange={(event) => setLineHeight(Number(event.target.value))} className="mt-3 w-full" />
          </div>

          <div className="mt-6 rounded-[24px] border border-amber-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(255,251,235,0.96)_100%)] p-4 shadow-sm">
            <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Alignment</label>
            <select value={alignment} onChange={(event) => setAlignment(event.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <option value="center">Center</option>
              <option value="left">Left</option>
            </select>
          </div>

          <div className="mt-6 rounded-[24px] border border-rose-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(255,241,242,0.96)_100%)] p-4 shadow-sm">
            <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Layout Template</label>
            <select value={layoutTemplate} onChange={(event) => setLayoutTemplate(event.target.value as LayoutTemplate)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <option value="balanced">Balanced</option>
              <option value="hero">Hero</option>
              <option value="split">Split</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>

          <div className="mt-6 rounded-[24px] border border-rose-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(255,241,242,0.96)_100%)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Slide Presets</h3>
            <div className="mt-3 flex gap-3">
              <button onClick={applyCoverPreset} className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">Cover Slide</button>
              <button onClick={applyCtaPreset} className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">CTA Slide</button>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(248,250,252,0.96)_100%)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Padding</label>
              <span className="text-sm text-slate-500">{padding}px</span>
            </div>
            <input type="range" min="10" max="60" value={padding} onChange={(event) => setPadding(Number(event.target.value))} className="mt-3 w-full" />
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(248,250,252,0.96)_100%)] p-4 shadow-sm text-sm text-slate-500">
            <p className="font-semibold uppercase tracking-[0.18em] text-slate-500">Export Size</p>
            <p className="mt-2">{formatStyles.width} × {formatStyles.height} px</p>
            <p className="mt-1">ZIP files use the idea name and selected format for easier organization.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
