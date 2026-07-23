import { useState, useEffect } from "react";
import mammoth from "mammoth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Copy,
  Check,
  Loader2,
  FileText,
  Image as ImageIcon,
  FileCode,
  Film,
  Music,
  File,
  AlertCircle,
  X,
  FileCheck,
  Lock,
  Unlock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id?: string;
    name: string;
    file_path: string;
    mime_type?: string;
    file_size?: number;
    is_downloadable?: boolean;
  } | null;
  bucketName?: string;
  canEdit?: boolean;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function getFileTypeCategory(name: string, mimeType?: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const mime = mimeType?.toLowerCase() ?? "";

  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) {
    return "image";
  }
  if (mime === "application/pdf" || ext === "pdf") {
    return "pdf";
  }
  if (ext === "docx" || ext === "doc" || mime.includes("wordprocessingml") || mime.includes("msword")) {
    return "docx";
  }
  if (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("javascript") ||
    mime.includes("xml") ||
    ["txt", "csv", "json", "md", "html", "js", "ts", "css", "xml", "log", "yaml", "yml"].includes(ext)
  ) {
    return "text";
  }
  if (mime.startsWith("video/") || ["mp4", "webm", "ogg", "mov", "mkv", "avi"].includes(ext)) {
    return "video";
  }
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "aac", "m4a", "flac"].includes(ext)) {
    return "audio";
  }
  if (["xls", "xlsx", "ppt", "pptx"].includes(ext)) {
    return "office";
  }
  return "other";
}

export function DocumentViewerModal({
  open,
  onOpenChange,
  document,
  bucketName = "documents",
  canEdit = false,
}: DocumentViewerModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [loadingDocx, setLoadingDocx] = useState(false);
  const [copied, setCopied] = useState(false);

  // Image controls
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!open || !document) {
      setSignedUrl(null);
      setLoading(false);
      setError(null);
      setTextContent(null);
      setDocxHtml(null);
      setZoom(1);
      setRotation(0);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setDocxHtml(null);
    setTextContent(null);

    async function fetchSignedUrl() {
      try {
        const { data, error: urlError } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(document!.file_path, 3600);

        if (urlError) throw urlError;
        if (!isMounted) return;

        if (!data?.signedUrl) {
          throw new Error("Could not generate access URL for this file");
        }

        setSignedUrl(data.signedUrl);

        const category = getFileTypeCategory(document!.name, document!.mime_type);
        if (category === "text") {
          setLoadingText(true);
          try {
            const res = await fetch(data.signedUrl);
            const text = await res.text();
            if (isMounted) setTextContent(text);
          } catch {
            if (isMounted) setTextContent("Failed to load text content.");
          } finally {
            if (isMounted) setLoadingText(false);
          }
        } else if (category === "docx") {
          setLoadingDocx(true);
          try {
            const res = await fetch(data.signedUrl);
            const arrayBuffer = await res.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            if (isMounted) {
              setDocxHtml(result.value || "<p>Document content is empty or contains non-text elements.</p>");
            }
          } catch (docxErr: any) {
            console.error("Failed to render Word document with mammoth:", docxErr);
            if (isMounted) {
              setDocxHtml(null);
            }
          } finally {
            if (isMounted) setLoadingDocx(false);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to load document preview");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSignedUrl();

    return () => {
      isMounted = false;
    };
  }, [open, document, bucketName]);

  if (!document) return null;

  const category = getFileTypeCategory(document.name, document.mime_type);
  const isViewOnly = document.is_downloadable === false;
  const isDownloadAllowed = !isViewOnly || canEdit;

  const handleDownload = () => {
    if (!signedUrl || !isDownloadAllowed) return;
    const link = window.document.createElement("a");
    link.href = signedUrl;
    link.download = document.name;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const handleCopyText = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    toast.success("Text copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenExternal = () => {
    if (signedUrl && isDownloadAllowed) {
      window.open(signedUrl, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border/80 shadow-2xl rounded-2xl [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="p-4 px-6 border-b border-border/60 flex flex-row items-center justify-between gap-4 shrink-0 bg-muted/20">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {category === "image" && <ImageIcon className="h-5 w-5 text-emerald-500 shrink-0" />}
            {category === "pdf" && <FileText className="h-5 w-5 text-rose-500 shrink-0" />}
            {category === "docx" && <FileCheck className="h-5 w-5 text-blue-600 shrink-0" />}
            {category === "text" && <FileCode className="h-5 w-5 text-blue-500 shrink-0" />}
            {category === "video" && <Film className="h-5 w-5 text-purple-500 shrink-0" />}
            {category === "audio" && <Music className="h-5 w-5 text-amber-500 shrink-0" />}
            {category === "office" && <FileCheck className="h-5 w-5 text-sky-500 shrink-0" />}
            {category === "other" && <File className="h-5 w-5 text-muted-foreground shrink-0" />}

            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold truncate max-w-xs sm:max-w-md md:max-w-lg">
                {document.name}
              </DialogTitle>
              {document.file_size ? (
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(document.file_size)}
                </p>
              ) : null}
            </div>

            {isViewOnly && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-medium text-[11px] shrink-0">
                <Lock className="h-3 w-3" /> {canEdit ? "View Only (Employees Locked)" : "View Only"}
              </Badge>
            )}

            <Badge variant="outline" className="uppercase text-[10px] tracking-wider shrink-0 hidden sm:inline-flex">
              {document.name.split(".").pop() || "file"}
            </Badge>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {category === "image" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-8 text-center font-mono">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="Rotate"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </>
            )}

            {category === "text" && textContent && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={handleCopyText}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            )}

            {isDownloadAllowed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleOpenExternal}
                disabled={!signedUrl}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}

            {isDownloadAllowed && (
              <Button
                variant="default"
                size="sm"
                className="h-8 gap-1.5 bg-terracotta hover:bg-terracotta/90 text-white"
                onClick={handleDownload}
                disabled={!signedUrl}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            )}

            {/* Explicit Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted ml-1"
              onClick={() => onOpenChange(false)}
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content Viewer Body */}
        <div className="flex-1 min-h-0 relative bg-muted/10 overflow-auto flex items-center justify-center p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-16">
              <Loader2 className="h-8 w-8 animate-spin text-terracotta" />
              <p className="text-sm font-medium">Preparing document preview...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center max-w-md py-12">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm font-semibold">Unable to display document preview</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button size="sm" onClick={handleDownload} className="mt-2 bg-terracotta text-white">
                <Download className="h-4 w-4 mr-2" /> Download File Instead
              </Button>
            </div>
          ) : !signedUrl ? null : (
            <>
              {/* PDF Viewer */}
              {category === "pdf" && (
                <iframe
                  src={`${signedUrl}#toolbar=1&navpanes=0`}
                  title={document.name}
                  className="w-full h-full rounded-lg border border-border/40 shadow-inner bg-white"
                />
              )}

              {/* Word Document (.docx / .doc) Viewer */}
              {category === "docx" && (
                <div className="w-full h-full overflow-auto p-2 sm:p-6 bg-slate-200/50 dark:bg-slate-900/50 rounded-lg">
                  {loadingDocx ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-terracotta mb-2" />
                      <p className="text-sm font-medium">Rendering Word document...</p>
                    </div>
                  ) : docxHtml ? (
                    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-8 sm:p-14 rounded-xl shadow-xl border border-border/80 min-h-full font-sans text-sm leading-relaxed overflow-x-auto">
                      <div
                        className="[&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mt-6 [&>h2]:mb-3 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mt-4 [&>h3]:mb-2 [&>p]:mb-4 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4 [&>table]:border-collapse [&>table]:w-full [&>table]:my-4 [&>td]:border [&>td]:p-2 [&>th]:border [&>th]:p-2 [&>th]:bg-muted"
                        dangerouslySetInnerHTML={{ __html: docxHtml }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 text-center max-w-md mx-auto py-12 bg-card rounded-xl border border-border/60 p-6 shadow-md my-auto">
                      <FileCheck className="h-16 w-16 text-blue-500" />
                      <div>
                        <h4 className="font-semibold text-base">{document.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Preview is ready. Download to open in Microsoft Word.
                        </p>
                      </div>
                      <Button onClick={handleDownload} className="bg-terracotta hover:bg-terracotta/90 text-white gap-2">
                        <Download className="h-4 w-4" /> Download Word Document
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Image Viewer */}
              {category === "image" && (
                <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                  <img
                    src={signedUrl}
                    alt={document.name}
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: "transform 0.2s ease-in-out",
                    }}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              )}

              {/* Text / Code / JSON / Markdown Viewer */}
              {category === "text" && (
                <div className="w-full h-full bg-slate-950 text-slate-100 rounded-lg overflow-auto p-4 font-mono text-xs leading-relaxed border border-border/40">
                  {loadingText ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading text contents...
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words">{textContent}</pre>
                  )}
                </div>
              )}

              {/* Video Player */}
              {category === "video" && (
                <video
                  controls
                  autoPlay={false}
                  src={signedUrl}
                  className="max-w-full max-h-full rounded-lg shadow-lg border border-border/40"
                >
                  Your browser does not support playing this video.
                </video>
              )}

              {/* Audio Player */}
              {category === "audio" && (
                <div className="flex flex-col items-center justify-center gap-6 p-8 bg-card rounded-2xl border border-border/60 shadow-xl max-w-md w-full">
                  <div className="p-4 rounded-full bg-amber-500/10 text-amber-500">
                    <Music className="h-12 w-12" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-base">{document.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Audio File</p>
                  </div>
                  <audio controls src={signedUrl} className="w-full">
                    Your browser does not support playing this audio file.
                  </audio>
                </div>
              )}

              {/* Excel / PPT Office File Card View */}
              {category === "office" && (
                <div className="flex flex-col items-center justify-center gap-5 text-center max-w-md p-8 bg-card rounded-2xl border border-border/60 shadow-xl my-auto">
                  <div className="p-4 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <FileCheck className="h-14 w-14" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{document.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatFileSize(document.file_size)} • Office Document
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5 w-full mt-2">
                    <Button onClick={handleDownload} className="w-full bg-terracotta hover:bg-terracotta/90 text-white gap-2">
                      <Download className="h-4 w-4" /> Download & Open Document
                    </Button>

                    <Button variant="outline" onClick={handleOpenExternal} className="w-full gap-2">
                      <ExternalLink className="h-4 w-4" /> Open in New Tab
                    </Button>
                  </div>
                </div>
              )}

              {/* Fallback for unsupported file formats */}
              {category === "other" && (
                <div className="flex flex-col items-center justify-center gap-4 text-center max-w-md p-6 bg-card rounded-xl border border-border/60 shadow-md">
                  <File className="h-16 w-16 text-muted-foreground/60" />
                  <div>
                    <h4 className="font-semibold text-base">{document.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Direct in-browser preview is not available for this file type.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button onClick={handleDownload} className="bg-terracotta hover:bg-terracotta/90 text-white">
                      <Download className="h-4 w-4 mr-2" /> Download File
                    </Button>
                    <Button variant="outline" onClick={handleOpenExternal}>
                      <ExternalLink className="h-4 w-4 mr-2" /> Open External
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
