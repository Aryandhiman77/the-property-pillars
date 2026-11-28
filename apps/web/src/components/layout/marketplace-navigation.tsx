"use client";

import MuiButton from "@mui/material/Button";

import {FreeBadge} from "@/components/ui/free-badge";
import Link from "next/link";
import Image from "next/image";
import {usePathname} from "next/navigation";
import { ArrowRight, ArrowUpRight, BrickWall, ChartNoAxesCombined, ChevronDown, CircleCheck, DraftingCompass, Menu, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useId } from "react";

import { useTranslations } from "next-intl";
import {propertyListingHref} from "@/config/marketplace";
import { useSiteLocation } from "@/features/location/site-location";
import type { AppLocale } from "@/i18n/config";
import { audienceMenus, type AudienceMenu } from "./audience-menus";
import ui from "./audience-menu.module.css";
import {MarketSidebar} from "./market-sidebar";

function Destination({link, close}: {link: {href: string; label: string}; close: () => void}) {
  return link.href === "#loan-enquiry" ? <a href={link.href} aria-haspopup="dialog" onClick={close}>{link.label}</a> :
    <Link href={link.href} onClick={close}>{link.label} {link.href.endsWith("/post-property") && <FreeBadge />}</Link>;
}

function MenuPanel({ menu, close }: { menu: AudienceMenu; close: () => void }) {
  const [current, setCurrent] = useState(0);
  const panelId = useId();
  const active = menu.categories[current] ?? menu.categories[0];
  return (
    <div className={ui.panel}>
      <div className={ui.categories}>
        {menu.categories.map((category, index) => (
          <MuiButton
            type="button"
            key={category.label}
            aria-pressed={current === index}
            aria-controls={panelId}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setCurrent(index);
            }}
            onFocus={() => setCurrent(index)}
            onClick={() => setCurrent(index)}
          >
            {category.label}
          </MuiButton>
        ))}
      </div>
      <div className={ui.columns} id={panelId}>
        {active.columns.map((col) => (
          <section key={col.label}>
            <h2>{col.label}</h2>
            {col.links.map((link) => (
              <Destination key={link.href} link={link} close={close} />
            ))}
          </section>
        ))}
      </div>
      {menu.feature.links ? (
        <aside className={ui.insights}>
          <Link href={menu.feature.link.href} onClick={close}>
            <ChartNoAxesCombined size={28} />
            <strong>{menu.feature.title}</strong>
            <ArrowUpRight size={17} />
          </Link>
          {menu.feature.links.map((link) => (
            <Link key={link.href} href={link.href} onClick={close}>
              <CircleCheck size={15} />
              {link.label}
            </Link>
          ))}
        </aside>
      ) : (
        menu.feature.image && (
          <Link className={ui.offer} href={menu.feature.link.href} onClick={close}>
            <Image alt="" src={menu.feature.image} width={290} height={155} sizes="240px" />
            <strong>{menu.feature.title}</strong>
            <span>
              {menu.feature.link.label} {menu.feature.link.href.endsWith("/post-property") && <FreeBadge />} <ArrowRight aria-hidden="true" size={16} />
            </span>
          </Link>
        )
      )}
    </div>
  );
}

export function MarketplaceNavigation({ locale, compact = false }: { locale: AppLocale; compact?: boolean }) {
  const t = useTranslations("Site");
  const articles = useTranslations("Articles");
  const pathname = usePathname();
  const directories = [
    {href: `/${locale}/materials`, drawerLabel: t("buildingMaterials"), Icon: BrickWall},
    {href: `/${locale}/professionals`, drawerLabel: t("professionals"), Icon: DraftingCompass},
  ];
  const { place } = useSiteLocation();
  const menus = audienceMenus(locale, t, articles("title"), place?.city, place?.countryCode);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const openedByPointer = useRef<HTMLDetailsElement | null>(null);
  const hoverClose = useRef<number | undefined>(undefined);

  useEffect(() => {
    const header = root.current?.closest("header");
    const market = header?.closest<HTMLElement>(".market");
    if (!header || !market) return;
    const update = () => market.style.setProperty("--market-header-height", header.offsetHeight + "px");
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!sidebar) return;
    const desktop = window.matchMedia("(min-width: 801px)");
    const closeOnDesktop = () => { if (desktop.matches) setSidebar(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [sidebar]);

  const closeMenus = useCallback(() => {
    window.clearTimeout(hoverClose.current);
    openedByPointer.current = null;
    root.current?.querySelectorAll("details[open]").forEach((item) => item.removeAttribute("open"));
  }, []);

  useEffect(() => {
    closeMenus();
    setSidebar(false);
  }, [pathname, closeMenus]);

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

  return (
    <div
      ref={root}
      className={`market-navigation${compact ? " market-navigation--compact" : ""}`}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !(event.target instanceof HTMLElement)) return;
        const menu = event.target.closest<HTMLDetailsElement>("details[open]");
        if (menu) {
          window.clearTimeout(hoverClose.current);
          openedByPointer.current = null;
          menu.open = false;
          menu.querySelector("summary")?.focus();
        }
      }}
    >
      <nav className="market-nav-links" aria-label="Main navigation">
        {menus.map((menu) => (
          <details
            className="market-nav-dropdown"
            name="marketplace-header-menus"
            key={menu.label}
            onToggle={event => {
              const open = event.currentTarget.open;
              setOpenMenu(current => open ? menu.label : current === menu.label ? null : current);
            }}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") window.clearTimeout(hoverClose.current);
            }}
            onPointerLeave={(event) => {
              const menu = event.currentTarget;
              if (event.pointerType !== "mouse" || openedByPointer.current !== menu) return;
              hoverClose.current = window.setTimeout(() => {
                if (
                  openedByPointer.current !== menu ||
                  menu.querySelector(".market-mega-panel")?.contains(document.activeElement)
                )
                  return;
                menu.open = false;
                openedByPointer.current = null;
              }, 180);
            }}
          >
            <summary
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse") return;
                const menu = event.currentTarget.closest("details");
                if (menu && !menu.open) {
                  openedByPointer.current = menu;
                  menu.open = true;
                }
              }}
              onClick={(event) => {
                const menu = openedByPointer.current;
                if (event.detail > 0 && menu?.open && menu === event.currentTarget.parentElement) event.preventDefault();
                openedByPointer.current = null;
              }}
            >
              {menu.label}
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <div className="market-mega-panel" data-motion="popover">
              {openMenu === menu.label && <MenuPanel menu={menu} close={closeMenus} />}
            </div>
          </details>
        ))}
      </nav>
      <button type="button" className="market-mobile-menu" aria-label={t("quickLinks")} aria-haspopup="dialog" aria-expanded={sidebar} onClick={() => setSidebar(true)}>
        <Menu size={22} aria-hidden="true" />
      </button>
      {sidebar && <MarketSidebar compact label={t("quickLinks")} closeLabel={t("close")} close={() => setSidebar(false)}>
        <nav className={ui.mobileNav} aria-label={t("quickLinks")}>
          {directories.map(({href, drawerLabel, Icon}) => (
            <Link key={href} className={ui.directLink} href={href} onClick={() => setSidebar(false)} aria-current={pathname === href ? "page" : undefined}>
              <Icon size={18} aria-hidden="true" />{drawerLabel}
            </Link>
          ))}
          <Link data-shine="true" className={ui.directLink} href={propertyListingHref(locale)} onClick={() => setSidebar(false)}>
            <Plus size={18} aria-hidden="true" />{t("listProperty")} <FreeBadge />
          </Link>
          <a className={ui.loanAction} href="#loan-enquiry" aria-haspopup="dialog" onClick={() => setSidebar(false)}>
            {t("loanEnquiry")} <ArrowRight size={16} aria-hidden="true" />
          </a>
          {menus.map((menu) => (
            <details name="marketplace-mobile-navigation" key={menu.label}>
              <summary>
                {menu.label}
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              {menu.categories.map((category) => (
                <details key={category.label}>
                  <summary>
                    {category.label}
                    <ChevronDown size={13} />
                  </summary>
                  {category.columns.map((col) => (
                    <div className="market-menu-group" key={col.label}>
                      <p>{col.label}</p>
                      {col.links.map((link) => (
                        <Destination key={link.href} link={link} close={() => setSidebar(false)} />
                      ))}
                    </div>
                  ))}
                </details>
              ))}
            </details>
          ))}
        </nav>
      </MarketSidebar>}
    </div>
  );
}
