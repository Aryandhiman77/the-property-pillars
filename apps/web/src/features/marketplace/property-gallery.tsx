"use client";

import {useId, useRef, useState, type KeyboardEvent, type MouseEvent} from "react";
import Image from "next/image";
import {ChevronLeft, ChevronRight, ImageOff, Images, X} from "lucide-react";
import styles from "./property-gallery.module.css";

const collageLimit = 5;
type PhotoShape = "landscape" | "portrait" | "square";

export function PropertyGallery({sources, title}: {sources: string[]; title: string}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [shapes, setShapes] = useState<Record<string, PhotoShape>>({});
  const [unavailable, setUnavailable] = useState<Set<string>>(() => new Set());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const viewerId = useId();
  const visibleImages = sources.slice(0, collageLimit);
  const activeImage = sources[activeIndex];
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

  function openPhoto(event: MouseEvent<HTMLButtonElement>, index: number) {
    opener.current = event.currentTarget;
    setActiveIndex(index);
    dialogRef.current?.showModal();
    setIsOpen(true);
  }

  function changePhoto(offset: number) {
    setActiveIndex((current) => (current + offset + total) % total);
  }

  function handleKeys(event: KeyboardEvent<HTMLDialogElement>) {
    if (total < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    changePhoto(event.key === "ArrowLeft" ? -1 : 1);
  }

  if (!total) return null;

  return (
    <section aria-label="Property photos" className={styles.gallery}>
      <div className={styles.collage} data-count={visibleImages.length} data-lead={shapes[sources[0]] ?? "landscape"}>
        {visibleImages.map((source, index) => (
          <button aria-haspopup="dialog" aria-label={`Open photo ${index + 1} of ${total}`} className={styles.tile}
            key={source} onClick={(event) => openPhoto(event, index)} type="button">
            {unavailable.has(source) ? <ImageOff size={24} aria-hidden="true" /> : <Image alt="" fill src={source} unoptimized
              loading={index === 0 ? "eager" : "lazy"}
              sizes={total === 1 ? "(max-width: 760px) 100vw, 1240px" : index === 0 ? "(max-width: 760px) 100vw, 680px" : "(max-width: 760px) 50vw, 420px"}
              onError={() => markUnavailable(source)} onLoad={({currentTarget}) => rememberShape(source, currentTarget)} />}
          </button>
        ))}
      </div>
      {total > collageLimit && <button aria-haspopup="dialog" className={styles.viewAll} onClick={(event) => openPhoto(event, 0)} type="button">
        <Images size={17} aria-hidden="true" /> View all {total} photos
      </button>}

      <dialog aria-labelledby={viewerId} className={styles.viewer} data-shape={shapes[activeImage]} ref={dialogRef} onKeyDown={handleKeys}
        onClose={() => {setIsOpen(false); opener.current?.focus();}} onClick={(event) => {if (event.target === event.currentTarget) event.currentTarget.close();}}>
        <div className={styles.viewerContent}>
          <header className={styles.viewerBar}>
            <h2 id={viewerId}>Property photos</h2>
            <span aria-live="polite" className={styles.counter}>Photo {activeIndex + 1} of {total}</span>
            <button aria-label="Close photo viewer" className={styles.viewerButton} onClick={() => dialogRef.current?.close()} type="button"><X size={22} aria-hidden="true" /></button>
          </header>
          <div className={styles.stage}>
            {isOpen && activeImage && !unavailable.has(activeImage) ? (
              <Image key={activeImage} alt={`${title} — photo ${activeIndex + 1}`} fill src={activeImage} unoptimized
                sizes="(max-width: 1100px) 100vw, 1100px" onError={() => markUnavailable(activeImage)}
                onLoad={({currentTarget}) => rememberShape(activeImage, currentTarget)} />
            ) : unavailable.has(activeImage) ? <p className={styles.missing}><ImageOff size={24} aria-hidden="true" /> Photo unavailable</p> : null}
            {total > 1 && <>
              <button aria-label="Previous photo" className={`${styles.viewerButton} ${styles.previous}`} onClick={() => changePhoto(-1)} type="button"><ChevronLeft size={24} aria-hidden="true" /></button>
              <button aria-label="Next photo" className={`${styles.viewerButton} ${styles.next}`} onClick={() => changePhoto(1)} type="button"><ChevronRight size={24} aria-hidden="true" /></button>
            </>}
          </div>
          {total > 1 && isOpen && <ul aria-label="Choose a photo" className={styles.thumbnails}>
            {sources.map((source, index) => <li key={source}><button aria-current={index === activeIndex ? "true" : undefined}
              aria-label={`Show photo ${index + 1}`} onClick={() => setActiveIndex(index)} type="button">
              {unavailable.has(source) ? <ImageOff size={17} aria-hidden="true" /> : <Image alt="" fill sizes="64px" src={source} unoptimized onError={() => markUnavailable(source)} />}
            </button></li>)}
          </ul>}
        </div>
      </dialog>
    </section>
  );
}
