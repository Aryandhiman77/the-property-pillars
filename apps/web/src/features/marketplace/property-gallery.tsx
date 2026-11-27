"use client";

import MuiButton from "@mui/material/Button";

import {useId, useRef, useState, type KeyboardEvent, type MouseEvent} from "react";
import Image from "next/image";
import {ChevronLeft, ChevronRight, Expand, ImageOff, Play, X} from "lucide-react";
import {isUploadedVideoUrl} from "@the-property-pillar/contracts";
import {floorPlanLabel} from "./floor-plan-label";
import styles from "./property-gallery.module.css";

const collageLimit = 5;
type PhotoShape = "landscape" | "portrait" | "square";

export function PropertyGallery({sources, title,metadata=[]}: {sources: string[]; title: string;metadata?:{url:string;caption?:string;alt?:string;classification?:string;category?:string;floor?:number}[]}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [shapes, setShapes] = useState<Record<string, PhotoShape>>({});
  const [unavailable, setUnavailable] = useState<Set<string>>(() => new Set());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const viewerId = useId();
  const [leadIndex, setLeadIndex] = useState(0);
  const previewIndices = Array.from({length: Math.min(sources.length, collageLimit)}, (_, offset) => (leadIndex + offset) % sources.length);
  const changeLead = (offset: number) => setLeadIndex(current => (current + offset + sources.length) % sources.length);
  const activeSource = sources[activeIndex];
  const details=metadata.find(m=>m.url===activeSource);
  const activeVideo = isUploadedVideoUrl(activeSource);
  const hasVideos = sources.some(isUploadedVideoUrl);
  const galleryLabel = hasVideos ? "Property gallery" : "Property photos";
  const descriptionFor = (source: string) => isUploadedVideoUrl(source) ? "video" : "photo";
  const total = sources.length;

  function rememberShape(source: string, image: HTMLImageElement) {
    if (!image.naturalHeight) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    const shape = ratio < 0.9 ? "portrait" : ratio > 1.2 ? "landscape" : "square";
    setShapes((current) => current[source] === shape ? current : {...current, [source]: shape});
  }

  function markUnavailable(source: string) {
    setUnavailable((current) => current.has(source) ? current : new Set([...current, source]));
  }

  function openMedia(event: MouseEvent<HTMLButtonElement>, index: number) {
    opener.current = event.currentTarget;
    setActiveIndex(index);
    dialogRef.current?.showModal();
    setIsOpen(true);
  }

  function changeMedia(offset: number) {
    setActiveIndex((current) => (current + offset + total) % total);
  }

  function handleKeys(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.target instanceof HTMLVideoElement || total < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    changeMedia(event.key === "ArrowLeft" ? -1 : 1);
  }

  if (!total) return null;

  return (
    <section aria-label={galleryLabel} className={styles.gallery}>
      <div className={styles.collage} data-count={previewIndices.length} style={{gridTemplateRows:`repeat(${Math.max(1,previewIndices.length - 1)},minmax(0,1fr))`}} data-lead={shapes[sources[leadIndex]] ?? "landscape"}>
        {previewIndices.map((index, position) => {
          const source = sources[index];
          return (
          <MuiButton aria-haspopup="dialog" aria-label={`Open ${descriptionFor(source)} ${index + 1} of ${total}`} className={styles.tile}
            key={source} onClick={(event) => openMedia(event, index)} type="button">
            {unavailable.has(source) ? <ImageOff size={24} aria-hidden="true" /> : isUploadedVideoUrl(source)
              ? <span className={styles.videoTile}><Play size={26} aria-hidden="true" /> Video</span> : <Image alt="" fill src={source} unoptimized
              loading={position === 0 ? "eager" : "lazy"}
              sizes={total === 1 ? "(max-width: 760px) 100vw, 1240px" : position === 0 ? "(max-width: 760px) 100vw, 680px" : "(max-width: 760px) 50vw, 420px"}
              onError={() => markUnavailable(source)} onLoad={({currentTarget}) => rememberShape(source, currentTarget)} />}
            {position === 0 && <span className={styles.expand}><Expand size={16}/></span>}
            {position === collageLimit - 1 && total > collageLimit && <span className={styles.more}>+{total - collageLimit}</span>}
          </MuiButton>
        )})}
        {total > 1 && <div className={styles.galleryControls}>
          <MuiButton type="button" aria-label="Previous gallery preview" onClick={()=>changeLead(-1)}><ChevronLeft size={17}/></MuiButton>
          <MuiButton type="button" aria-label="Next gallery preview" onClick={()=>changeLead(1)}><ChevronRight size={17}/></MuiButton>
        </div>}
      </div>
      <dialog aria-labelledby={viewerId} className={styles.viewer} data-motion="dialog" data-shape={shapes[activeSource]} ref={dialogRef} onKeyDown={handleKeys}
        onClose={() => {setIsOpen(false); opener.current?.focus();}} onClick={(event) => {if (event.target === event.currentTarget) event.currentTarget.close();}}>
        <div className={styles.viewerContent}>
          <header className={styles.viewerBar}>
            <h2 id={viewerId}>{galleryLabel}</h2>
            <span aria-live="polite" className={styles.counter}>{hasVideos ? "Item" : "Photo"} {activeIndex + 1} of {total}</span>
            <MuiButton aria-label={hasVideos ? "Close gallery" : "Close photo viewer"} className={styles.viewerButton} onClick={() => dialogRef.current?.close()} type="button"><X size={22} aria-hidden="true" /></MuiButton>
          </header>
          <div className={styles.stage}>
            {isOpen && activeSource && !unavailable.has(activeSource) ? activeVideo
              ? <video key={activeSource} src={activeSource} aria-label={`${title} video`} controls playsInline preload="metadata" onError={() => markUnavailable(activeSource)} />
              : <Image key={activeSource} alt={details?.alt||`${title} — photo ${activeIndex + 1}`} fill src={activeSource} unoptimized
                sizes="(max-width: 1100px) 100vw, 1100px" onError={() => markUnavailable(activeSource)}
                onLoad={({currentTarget}) => rememberShape(activeSource, currentTarget)} />
              : unavailable.has(activeSource) ? <p className={styles.missing}><ImageOff size={24} aria-hidden="true" /> {activeVideo ? "Video" : "Photo"} unavailable</p> : null}
            {total > 1 && <>
              <MuiButton aria-label={hasVideos ? "Previous item" : "Previous photo"} className={`${styles.viewerButton} ${styles.previous}`} onClick={() => changeMedia(-1)} type="button"><ChevronLeft size={24} aria-hidden="true" /></MuiButton>
              <MuiButton aria-label={hasVideos ? "Next item" : "Next photo"} className={`${styles.viewerButton} ${styles.next}`} onClick={() => changeMedia(1)} type="button"><ChevronRight size={24} aria-hidden="true" /></MuiButton>
            </>}
          </div>
          {details && <p>{[details.category === "Floor plan" && floorPlanLabel(details.floor),details.classification,details.caption].filter(Boolean).join(" · ")}</p>}
          {total > 1 && isOpen && <ul aria-label={hasVideos ? "Choose a gallery item" : "Choose a photo"} className={styles.thumbnails}>
            {sources.map((source, index) => <li key={source}><MuiButton aria-current={index === activeIndex ? "true" : undefined}
              aria-label={`Show ${descriptionFor(source)} ${index + 1}`} onClick={() => setActiveIndex(index)} type="button">
              {unavailable.has(source) ? <ImageOff size={17} aria-hidden="true" /> : isUploadedVideoUrl(source)
                ? <Play size={17} aria-hidden="true" /> : <Image alt="" fill sizes="64px" src={source} unoptimized onError={() => markUnavailable(source)} />}
            </MuiButton></li>)}
          </ul>}
        </div>
      </dialog>
    </section>
  );
}
