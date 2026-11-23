"use client";

import Image from "next/image";
import Link from "next/link";
import {ArrowUpRight, ChevronLeft, ChevronRight} from "lucide-react";
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
  function move(offset: number) {setIndex((current) => (current + offset + slides.length) % slides.length);}
  return <section className="market-hero" aria-label="Homepage spotlight">
    <div className="market-hero-visual">
      {slide?.videoUrl ? <video key={slide.id} className="market-hero-image market-hero-video" src={slide.videoUrl} poster={slide.imageUrl} controls playsInline preload="none" aria-label={slide.title} />
        : <Image key={slide?.id ?? "default"} className="market-hero-image" src={slide?.imageUrl ?? marketplaceArtwork.hero} alt={slide?.imageAlt ?? ""} fill priority={!slide} sizes="100vw" unoptimized={Boolean(slide)} />}
    </div>
    <div className="market-width market-hero-content">
      <div className="market-hero-copy" aria-live="polite">{slide ?
        <><h1>{slide.title}</h1>{slide.description && <p className="market-lead">{slide.description}</p>}
          {slide.ctaHref && slide.ctaLabel && <Link className="market-button market-hero-cta" href={slide.ctaHref}>{slide.ctaLabel} <ArrowUpRight size={16} aria-hidden="true" /></Link>}</>
        : fallback}</div>
      {slides.length > 1 && <div className="market-hero-controls" aria-label="Carousel controls">
        <button aria-label="Previous slide" type="button" onClick={() => move(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
        <span>{index + 1} / {slides.length}</span>
        <button aria-label="Next slide" type="button" onClick={() => move(1)}><ChevronRight size={20} aria-hidden="true" /></button>
      </div>}
    </div>
  </section>;
}
