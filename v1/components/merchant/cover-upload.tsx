"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2 } from "lucide-react";

export function CoverUpload({
  storeId,
  currentUrl,
}: {
  storeId: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setOk(false);
    setFileName(file?.name ?? null);
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Selecciona una imagen primero.");
      return;
    }
    setPending(true);
    setError(null);
    setOk(false);
    try {
      const body = new FormData();
      body.set("storeId", storeId);
      body.set("cover", file);
      const response = await fetch("/api/merchant/cover", {
        method: "POST",
        body,
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "No pudimos subir la portada.");
        return;
      }
      if (data.url) setPreview(data.url);
      setOk(true);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setError("No pudimos subir la portada. Revisa tu conexión.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div
        className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-border bg-surface-3 bg-cover bg-center"
        style={preview ? { backgroundImage: `url(${preview})` } : undefined}
      >
        {!preview && (
          <div className="flex h-full items-center justify-center text-[11px] text-muted">
            Sin portada
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
          Portada del local
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="cover"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        className="sr-only"
        id={`cover-${storeId}`}
      />
      <label
        htmlFor={`cover-${storeId}`}
        className="btn btn-secondary btn-sm w-full cursor-pointer"
      >
        <ImageUp className="h-3.5 w-3.5" />
        Elegir imagen
      </label>

      {fileName && (
        <p className="truncate text-[10px] text-muted" title={fileName}>
          {fileName}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-sm w-full"
      >
        {pending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Subiendo…
          </>
        ) : (
          "Subir portada"
        )}
      </button>

      {error && <p className="text-[11px] text-danger">{error}</p>}
      {ok && <p className="text-[11px] text-success">Portada actualizada.</p>}
      <p className="text-[10px] leading-relaxed text-muted">
        JPG, PNG, WEBP o GIF · máximo 5 MB · recomendado 1200×675 px.
      </p>
    </form>
  );
}
