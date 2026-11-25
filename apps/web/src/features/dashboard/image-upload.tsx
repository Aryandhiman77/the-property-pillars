"use client";

import {MaterialInput} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";

import Image from "next/image";
import {useEffect, useId, useState, type ComponentProps} from "react";
import {ChevronLeft, ChevronRight, ImagePlus, Play, UploadCloud, X} from "lucide-react";
import {isUploadedVideoUrl} from "@the-property-pillar/contracts";
import {apiRequest} from "@/lib/api/client";
import {imageSource} from "@/lib/image-source";
import type {MediaDrafts} from "./media-drafts";
import styles from "./dashboard.module.css";

const formats = {image: ["image/jpeg", "image/png", "image/webp"], video: ["video/mp4", "video/quicktime", "video/webm"]};
const mixedFormats = [...formats.image, ...formats.video];
const fileKind = (file: File) => formats.video.includes(file.type) ? "video" : "image";
type Limits = Record<"image" | "video", {inputMB: number; savedMB: number}>;
let config: Promise<Limits> | undefined;
export function ImageUpload({label, value, maxFiles, purpose, kind = "image", dropzone = true, logoPicker, drafts, disabled = false, reorderOnly = false, onChange, ...attributes}: {
  label: string;
  value: string;
  maxFiles: number;
  purpose: string;
  kind?: "image" | "video" | "mixed";
  dropzone?: boolean;
  logoPicker?: boolean;
  onChange: (value: string) => void;
  drafts: MediaDrafts;
  disabled?: boolean;
  reorderOnly?: boolean;
} & Pick<ComponentProps<"input">, "name" | "aria-invalid" | "aria-describedby">) {
  const errorId = useId();
  const helpId = useId();
  const [limits, setLimits] = useState<Limits | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const accept = kind === "mixed" ? mixedFormats : formats[kind];
  const selectedUrls = value ? (maxFiles === 1 ? [value] : value.split(", ")) : [];
  const imagePreview = (url: string) => drafts.file(url) ? url : imageSource(url);
  const logoSource = logoPicker ? imagePreview(value) : undefined;
  useEffect(() => {
    if (reorderOnly) return;
    let mounted = true;
    config ??= apiRequest<Limits>("/uploads/limits").catch((error) => {config = undefined; throw error;});
    config.then((value) => {if (mounted) setLimits(value);}, () => {});
    return () => {mounted = false;};
  }, [reorderOnly]);

  function update(next: string[]) {
    for (const url of selectedUrls) if (!next.includes(url)) drafts.discard(url);
    onChange(next.join(", "));
  }

  function stage(files: File[]) {
    setError("");
    if (!files.length || disabled) return;
    if (maxFiles === 1 && files.length > 1) {setError("Choose one file."); return;}
    if (maxFiles > 1 && selectedUrls.length + files.length > maxFiles) {
      setError(kind === "mixed" ? `Choose up to ${maxFiles} photos and videos in total.` : `Choose up to ${maxFiles} files.`);
      return;
    }
    if (files.some((file) => !accept.includes(file.type))) {
      setError(kind === "mixed" ? "Choose JPEG, PNG or WebP photos, or MP4, MOV or WebM videos."
        : kind === "image" ? "Choose JPEG, PNG, or WebP images." : "Choose MP4, MOV, or WebM videos.");
      return;
    }
    const oversized = limits && files.find((file) => file.size > limits[fileKind(file)].inputMB * 1024 * 1024);
    if (limits && oversized) {
      const type = fileKind(oversized);
      setError(`Choose a ${type} up to ${limits[type].inputMB} MB for compression.`);
      return;
    }
    const next = files.map((file) => drafts.stage(file, purpose));
    update(maxFiles === 1 ? next : [...selectedUrls, ...next]);
  }

  function move(index: number, offset: number) {
    const next = [...selectedUrls];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    update(next);
  }

  return <div className={styles.imageUploader}>
    {!reorderOnly && <label className={`${styles.imageSelect} ${dropzone ? styles.imageDropzone : ""} ${logoPicker ? styles.profileLogoPicker : ""}`} data-dragging={dragging || undefined}
      onDragOver={dropzone ? (event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
        setDragging(!disabled);
      } : undefined}
      onDragLeave={dropzone ? (event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      } : undefined}
      onDrop={dropzone ? (event) => {
        event.preventDefault();
        setDragging(false);
        stage(Array.from(event.dataTransfer.files));
      } : undefined}>
      {logoSource
        ? <span className={styles.profileLogoPreview}><Image alt="" src={logoSource} fill sizes="112px" unoptimized /></span>
        : dropzone ? <UploadCloud size={25} aria-hidden="true" /> : <ImagePlus size={logoPicker ? 24 : 17} aria-hidden="true" />}
      <span>{dropzone ? (kind === "mixed" ? "Drop photos and videos or browse" : kind === "video" ? "Drop a video or browse" : logoPicker ? logoSource ? "Replace logo" : "Drop a logo or browse" : "Drop images or browse") : label}</span>
      {dropzone && <small id={helpId}>{kind === "mixed" ? <>JPEG, PNG, WebP, MP4, MOV or WebM{limits && ` · Per file up to ${limits.image.inputMB} MB photos or ${limits.video.inputMB} MB videos`}</>
        : <>{kind === "image" ? "JPEG, PNG or WebP" : "MP4, MOV or WebM"}{limits && ` · Upload up to ${limits[kind].inputMB} MB · Saved up to ${limits[kind].savedMB} MB`}</>}
        {` · ${Math.min(selectedUrls.length, maxFiles)} / ${maxFiles}${kind === "mixed" ? " items" : ""}`}</small>}
      <MaterialInput {...attributes} aria-label={dropzone || logoPicker ? label : undefined} aria-describedby={[attributes["aria-describedby"], dropzone && helpId, error && errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={Boolean(error) || attributes["aria-invalid"]} type="file" multiple={maxFiles > 1}
        accept={accept.join(",")} disabled={disabled} onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          stage(files);
        }} />
    </label>}
    {kind === "video" && value && <div><video src={value} controls preload="metadata" style={{maxWidth: "100%", maxHeight: "12rem"}} />
      <MuiButton className={styles.secondaryButton} type="button" onClick={() => update([])} disabled={disabled}>Remove video</MuiButton></div>}
    {error && <small className={styles.fieldError} id={errorId} role="alert">{error}</small>}
    {selectedUrls.length > maxFiles && <div className={styles.imageOverflow}>
      <small>{selectedUrls.length - maxFiles} files exceed the {maxFiles}-item limit.</small>
      <MuiButton className={styles.secondaryButton} type="button" disabled={disabled} onClick={() => update(selectedUrls.slice(0, maxFiles))}>Remove extra files</MuiButton>
    </div>}
    {kind !== "video" && !logoPicker && selectedUrls.length > 0 && <ul className={styles.imagePreviews}>
      {selectedUrls.slice(0, maxFiles).map((url, index) => {
        const local = drafts.file(url);
        const video = kind === "mixed" && (local ? fileKind(local) === "video" : isUploadedVideoUrl(url));
        const source = video ? "" : imagePreview(url);
        return <li key={url}>
          {video && <a className={styles.uploadVideoPreview} href={url} target="_blank" rel="noreferrer" aria-label={`Open video ${index + 1}`}><Play size={19} aria-hidden="true" /> Video</a>}
          {source && <Image alt={`Selected image ${index + 1}`} src={source} fill sizes="88px" unoptimized />}
          {!reorderOnly && <MuiButton aria-label={`Remove ${video ? "video" : "image"} ${index + 1}`} disabled={disabled} type="button" onClick={() => update(selectedUrls.filter((_, position) => position !== index))}><X size={15} /></MuiButton>}
          {kind === "mixed" && selectedUrls.length > 1 && <span className={styles.mediaOrder}>
            <MuiButton type="button" aria-label={`Move item ${index + 1} earlier`} disabled={disabled || index === 0} onClick={() => move(index, -1)}><ChevronLeft size={15} /></MuiButton>
            <MuiButton type="button" aria-label={`Move item ${index + 1} later`} disabled={disabled || index === selectedUrls.length - 1} onClick={() => move(index, 1)}><ChevronRight size={15} /></MuiButton>
          </span>}
        </li>;
      })}
    </ul>}
    {logoPicker && value && <MuiButton className={styles.secondaryButton} type="button" disabled={disabled} onClick={() => update([])}>Remove logo</MuiButton>}
  </div>;
}
