"use client";

import Image from "next/image";
import {useId, useRef, useState, type ComponentProps} from "react";
import {ImagePlus, LoaderCircle, UploadCloud, X} from "lucide-react";
import {apiRequest} from "@/lib/api/client";
import {imageSource} from "@/lib/image-source";
import styles from "./dashboard.module.css";

const formats = ["image/jpeg", "image/png", "image/webp"];

export function ImageUpload({label, value, maxFiles, purpose, dropzone, logoPicker, onChange, onBusy, ...attributes}: {
  label: string;
  value: string;
  maxFiles: number;
  purpose: string;
  dropzone?: boolean;
  logoPicker?: boolean;
  onChange: (value: string) => void;
  onBusy: (busy: boolean) => void;
} & Pick<ComponentProps<"input">, "name" | "aria-invalid" | "aria-describedby">) {
  const errorId = useId();
  const helpId = useId();
  const uploading = useRef(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const images = value ? (maxFiles === 1 ? [value] : value.split(", ")) : [];
  const logoSource = logoPicker ? imageSource(value) : undefined;

  async function upload(files: File[]) {
    setError("");
    if (!files.length || uploading.current) return;
    if (maxFiles > 1 && images.length + files.length > maxFiles) {
      setError(`Choose up to ${maxFiles} images.`);
      return;
    }
    if (files.some((file) => !formats.includes(file.type) || file.size > 8 * 1024 * 1024)) {
      setError("Choose JPEG, PNG, or WebP images up to 8 MB each.");
      return;
    }
    uploading.current = true;
    setBusy(true);
    onBusy(true);
    const uploaded: string[] = [];
    try {
      for (const file of files) {
        const {url} = await apiRequest<{url: string}>("/uploads", {method: "POST", body: file, headers: {"X-Upload-Purpose": purpose}});
        uploaded.push(url);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The image could not be uploaded.");
    } finally {
      if (uploaded.length) onChange([...new Set(maxFiles === 1 ? uploaded : [...images, ...uploaded])].join(", "));
      uploading.current = false;
      setBusy(false);
      onBusy(false);
    }
  }

  return <div className={styles.imageUploader}>
    <label className={`${styles.imageSelect} ${dropzone ? styles.imageDropzone : ""} ${logoPicker ? styles.profileLogoPicker : ""}`} data-dragging={dragging || undefined}
      onDragOver={dropzone ? (event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = uploading.current ? "none" : "copy";
        setDragging(!uploading.current);
      } : undefined}
      onDragLeave={dropzone ? (event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      } : undefined}
      onDrop={dropzone ? (event) => {
        event.preventDefault();
        setDragging(false);
        void upload(Array.from(event.dataTransfer.files));
      } : undefined}>
      {busy ? <LoaderCircle className={styles.spin} size={dropzone ? 25 : 17} /> : logoSource
        ? <span className={styles.profileLogoPreview}><Image alt="" src={logoSource} fill sizes="112px" unoptimized /></span>
        : dropzone ? <UploadCloud size={25} aria-hidden="true" /> : <ImagePlus size={logoPicker ? 24 : 17} aria-hidden="true" />}
      <span>{busy ? "Uploading…" : dropzone ? "Drop photos here or browse files" : logoSource ? "Replace logo" : maxFiles === 1 && images.length ? "Replace image" : label}</span>
      {dropzone && <small id={helpId}>JPEG, PNG or WebP · Up to 8 MB each · {Math.min(images.length, maxFiles)} / {maxFiles} photos</small>}
      <input {...attributes} aria-label={dropzone || logoPicker ? label : undefined} aria-describedby={[attributes["aria-describedby"], dropzone && helpId, error && errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={Boolean(error) || attributes["aria-invalid"]} type="file" multiple={maxFiles > 1}
        accept={formats.join(",")} disabled={busy} onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void upload(files);
        }} />
    </label>
    {error && <small className={styles.fieldError} id={errorId} role="alert">{error}</small>}
    {images.length > maxFiles && <div className={styles.imageOverflow}>
      <small>{images.length - maxFiles} more photos exceed the {maxFiles}-photo limit.</small>
      <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => onChange(images.slice(0, maxFiles).join(", "))}>Remove extra photos</button>
    </div>}
    {!logoPicker && images.length > 0 && <ul className={styles.imagePreviews}>
      {images.slice(0, maxFiles).map((url, index) => {
        const source = imageSource(url);
        return <li key={index}>
          {source && <Image alt={`Selected image ${index + 1}`} src={source} fill sizes="88px" unoptimized />}
          <button aria-label={`Remove image ${index + 1}`} disabled={busy} type="button" onClick={() => onChange(images.filter((_, position) => position !== index).join(", "))}><X size={15} /></button>
        </li>;
      })}
    </ul>}
  </div>;
}
