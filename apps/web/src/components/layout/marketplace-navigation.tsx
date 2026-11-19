"use client";

import Link from "next/link";
import Image from "next/image";
import {ArrowRight, ChevronDown, Menu} from "lucide-react";
import {useCallback, useEffect, useRef} from "react";

type Group = {label: string; links: {label: string; href: string; detail?: string}[]};
export type MarketplaceMenu = {
  label: string;
  feature: {title: string; image: string; href: string; linkLabel: string};
  groups: Group[];
};

export function MarketplaceNavigation({menus}: {menus: MarketplaceMenu[]}) {
  const root = useRef<HTMLDivElement>(null);
  const openedByPointer = useRef<HTMLDetailsElement | null>(null);
  const hoverClose = useRef<number | undefined>(undefined);

  const closeMenus = useCallback(() => {
    window.clearTimeout(hoverClose.current);
    openedByPointer.current = null;
    root.current?.querySelectorAll("details[open]").forEach((item) => item.removeAttribute("open"));
  }, []);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        closeMenus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.clearTimeout(hoverClose.current);
    };
  }, [closeMenus]);

  const renderGroup = (group: Group) => (
    <div className="market-menu-group" key={group.label}>
      <p>{group.label}</p>
      {group.links.map(({label, href, detail}) => (
        <Link key={href} href={href} onClick={closeMenus}>
          <span>{label}{detail && <small>{detail}</small>}</span><ArrowRight size={15} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );

  return (
    <div ref={root} className="market-navigation" onKeyDown={(event) => {
      if (event.key !== "Escape" || !(event.target instanceof HTMLElement)) return;
      const menu = event.target.closest<HTMLDetailsElement>("details[open]");
      if (menu) {
        window.clearTimeout(hoverClose.current);
        openedByPointer.current = null;
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    }}>
      <nav className="market-nav-links" aria-label="Main navigation">
        {menus.map(({label, feature, groups}) => (
          <details className="market-nav-dropdown" name="marketplace-header-menus" key={label}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") window.clearTimeout(hoverClose.current);
            }} onPointerLeave={(event) => {
              const menu = event.currentTarget;
              if (event.pointerType !== "mouse" || openedByPointer.current !== menu) return;
              hoverClose.current = window.setTimeout(() => {
                if (openedByPointer.current !== menu || menu.querySelector(".market-mega-panel")?.contains(document.activeElement)) return;
                menu.open = false;
                openedByPointer.current = null;
              }, 180);
            }}>
            <summary onPointerEnter={(event) => {
              if (event.pointerType !== "mouse") return;
              const menu = event.currentTarget.closest("details");
              if (menu && !menu.open) {
                openedByPointer.current = menu;
                menu.open = true;
              }
            }} onClick={(event) => {
              const menu = openedByPointer.current;
              if (event.detail > 0 && menu?.open && menu === event.currentTarget.parentElement) event.preventDefault();
              openedByPointer.current = null;
            }}>{label}<ChevronDown size={14} aria-hidden="true" /></summary>
            <div className="market-mega-panel">
              <div className="market-width market-mega-menu">
                <Link className="market-mega-feature" href={feature.href} onClick={closeMenus}>
                  <span className="market-mega-photo"><Image src={feature.image} alt="" fill sizes="(min-width: 1141px) 390px, 1px" /></span>
                  <span className="market-mega-feature-copy"><strong>{feature.title}</strong><span>{feature.linkLabel}<ArrowRight size={15} aria-hidden="true" /></span></span>
                </Link>
                {groups.map(renderGroup)}
              </div>
            </div>
          </details>
        ))}
      </nav>
      <details className="market-popover market-mobile-menu" name="marketplace-header-menus">
        <summary aria-label="Open navigation"><Menu size={22} aria-hidden="true" /></summary>
        <nav className="market-popover-menu market-mobile-popover" aria-label="Mobile navigation">
          {menus.map(({label, feature, groups}) => (
            <details name="marketplace-mobile-navigation" key={label}>
              <summary>{label}<ChevronDown size={14} aria-hidden="true" /></summary>
              <Link className="market-mobile-feature" href={feature.href} onClick={closeMenus}>{feature.linkLabel}<ArrowRight size={15} aria-hidden="true" /></Link>
              {groups.map(renderGroup)}
            </details>
          ))}
        </nav>
      </details>
    </div>
  );
}
