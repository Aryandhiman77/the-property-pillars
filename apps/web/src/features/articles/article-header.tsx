"use client";

import {useEffect, useState, type ReactNode} from "react";
import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {LocaleMenu} from "@/components/layout/locale-menu";
import styles from "./articles.module.css";

export const articleHeadingEvent = "tpp:article-heading";
export type ActiveArticle = {title: string; slug: string; contentLocale: string};

export function ArticleHeader({locale, children, readerNavigation}: {locale: string; children: ReactNode; readerNavigation: ReactNode}) {
  const [active, setActive] = useState<ActiveArticle | null>(null);
  useEffect(() => {
    const update = (event: Event) => setActive((event as CustomEvent<ActiveArticle | null>).detail);
    window.addEventListener(articleHeadingEvent, update);
    return () => window.removeEventListener(articleHeadingEvent, update);
  }, []);
  return active ? <div className={`market-width ${styles.readerHeader}`} data-motion="enter">
      <Link aria-label="Browse articles" href={`/${locale}/articles`}><ArrowLeft size={20} aria-hidden="true" /></Link>
      <span lang={active.contentLocale} dir="auto">{active.title}</span>
      <LocaleMenu articleSlug={active.slug} />
      {readerNavigation}
    </div> : children;
}
