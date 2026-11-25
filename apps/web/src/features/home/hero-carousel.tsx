"use client";

import Image from "next/image";
import Link from "next/link";
import {ArrowUpRight} from "lucide-react";
import {useEffect, useState, type ReactNode} from "react";
import {apiRequest} from "@/lib/api/client";
import {marketplaceArtwork} from "@/config/marketplace";

type Slide = {id: string; title: string; description: string | null; imageUrl: string; videoUrl: string | null; imageAlt: string; ctaLabel: string | null; ctaHref: string | null};

export function HeroCarousel({fallback}: {fallback: ReactNode}) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<Slide[]>("/public/homepage-slides", {signal: abort.signal}).then((rows) => {if (!abort.signal.aborted) setSlides(rows);}, () => {});
    return () => abort.abort();
  }, []);
  const slide = slides[index];
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(false);
  function selectSlide(next: number) {
    setIndex(next);
    setPlayingVideo(false);
  }
  useEffect(() => {
    if (slides.length < 2 || focused || hovered || playingVideo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setIndex((index + 1) % slides.length), 4000);
    return () => window.clearTimeout(timer);
  }, [index, slides.length, focused, hovered, playingVideo]);
  return <section className="market-hero" aria-label="Homepage spotlight"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);}}>
    <div className="market-hero-visual">
      {slide?.videoUrl ? <video key={slide.id} className="market-hero-image market-hero-video" src={slide.videoUrl} poster={slide.imageUrl} onPlay={() => setPlayingVideo(true)} onPause={() => setPlayingVideo(false)} onEnded={() => setPlayingVideo(false)} controls playsInline preload="none" aria-label={slide.title} />
        : <Image key={slide?.id ?? "default"} className="market-hero-image" src={slide?.imageUrl ?? marketplaceArtwork.hero} alt={slide?.imageAlt ?? ""} fill priority={!slide} sizes="100vw" unoptimized={Boolean(slide)} />}
    </div>
    <div className="market-width market-hero-content">
      <div key={slide?.id ?? "fallback"} className="market-hero-copy">{slide ?
        <><h1>{slide.title}</h1>{slide.description && <p className="market-lead">{slide.description}</p>}
          {slide.ctaHref && slide.ctaLabel && <Link className="market-button market-hero-cta" href={slide.ctaHref}>{slide.ctaLabel} <ArrowUpRight size={16} aria-hidden="true" /></Link>}</>
        : fallback}</div>
    </div>
    {slides.length > 1 && <div className="market-slide-pagination" role="group" aria-label="Carousel controls">
      {slides.map((item, position) => <button key={item.id} type="button"
        aria-label={`Slide ${position + 1}: ${item.title}`} aria-current={position === index ? "true" : undefined}
        onClick={() => selectSlide(position)}><span /></button>)}
    </div>}
  </section>;
}
