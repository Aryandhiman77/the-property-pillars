"use client";

import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";
import Backdrop from "@mui/material/Backdrop";
import Card from "@mui/material/Card";
import MuiButton from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import {ProjectMetrics} from "@/features/projects/project-metrics";
import {ProjectWorkbench} from "@/features/projects/workbench";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {MarketplaceBreadcrumbs} from "@/components/layout/marketplace-breadcrumbs";
import Image from "next/image";
import {usePathname, useRouter} from "next/navigation";
import type {LucideIcon} from "lucide-react";
import toast, {Toaster} from "react-hot-toast";
import {BrandLogo} from "@/components/layout/brand-logo";
import {LocaleMenu} from "@/components/layout/locale-menu";
import {ManualUatLink} from "@/components/layout/manual-uat-link";
import {ProfileTools} from "@/components/layout/profile-tools";
import {useNow, useTranslations} from "next-intl";
import {BuyerIdentity, BuyerOverview, buyerSummary} from "./buyer-overview";
import {SkeletonStatus} from "@/components/ui/loading-skeleton";
import {
  ArrowUpRight,
  Bell,
  BellRing,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  CreditCard,
  Eye,
  FileText,
  HardHat,
  Heart,
  Landmark,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Megaphone,
  Moon,
  PackageSearch,
  Pencil,
  PanelTop,
  Palette,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Store,
  Sun,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import {ApiClientError, apiRequest} from "@/lib/api/client";
import {imageSource} from "@/lib/image-source";
import {RoleReviews} from "../admin/role-reviews";
import {AdminOperations, AdminRecordReview, adminSections, adminStatusLabel, getAdminSection, isAdminSection} from "@/features/admin";
import {loginHref} from "@/features/auth/login-return";
import type {AuthSession} from "@/features/auth/types";
import {useSession} from "@/features/auth/use-session";
import {MarketplaceSessionScope} from "@/features/auth/marketplace-session";
import {BillingView} from "@/features/billing/billing-view";
import {canPayToFeature} from "@the-property-pillar/contracts";
import {FeaturePlacement} from "./feature-placement";
import {canCreateCollection, getCollectionDescriptor, prettifyKey} from "./collection-config";
import {getRoleConfig} from "./role-config";
import type {MetricDefinition, Workspace, WorkspaceCollection, WorkspaceItem} from "./types";
import {WorkspaceForm, type WorkspaceMutation} from "./workspace-form";
import {NotificationDropdown, NotificationsPage, useNotifications} from "./notifications";
import {HomepageSlidesPanel, PropertyMapLeads} from "./website-panels";
import {SpecificationManager} from "@/features/materials/specification-manager";
import {WebsiteThemePanel} from "@/features/home/website-theme";
import {AdminArticles} from "@/features/articles/admin-articles";
import {PropertyCommentModeration} from "./property-comment-moderation";
import {WorkspaceCharts} from "./workspace-charts";
import {CompletionCard,RoleEditor} from "../profiles/editor";
import {MasterAdmin,ProfileReviews} from "../profiles/admin";
import {profileMenu} from "../profiles/navigation";
import {SavedJobs} from "../profiles/saved-jobs";
import {AccountProfile} from "./account-profile";
import styles from "./dashboard.module.css";

type DashboardAppProps = {
  locale: string;
  initialView?: string;
  initialRecord?: string;
  createProperty?: boolean;
};

type DashboardTheme = "light" | "dark";
const dashboardThemeKey = "tpp-dashboard-theme";

const collectionIcons: Record<string, LucideIcon> = {
  properties: Building2,
  dealerProfiles: UsersRound,
  savedProperties: Heart,
  buyerAlerts: BellRing,
  propertyInquiries: UserRound,
  materialProducts: Store,
  materialRfqs: PackageSearch,
  materialQuotes: FileText,
  serviceProfiles: ShieldCheck,
  serviceInquiries: UserRound,
  jobs: ClipboardList,
  jobApplications: FileText,
  workerProfiles: HardHat,
  builderProjects: Building2,
  adCampaigns: Megaphone,
  loanInquiries: FileText,
  grievances: CircleAlert,
};

function requestMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function countMetric(metric: MetricDefinition, collections: WorkspaceCollection[]) {
  const source = metric.collectionKeys?.length
    ? collections.filter((collection) => metric.collectionKeys?.includes(collection.key))
    : collections;
  const items = source.flatMap((collection) => collection.items);
  if (!metric.statuses?.length) return items.length;
  const statuses = new Set(metric.statuses.map((status) => status.toUpperCase()));
  return items.filter((item) => statuses.has(item.status.toUpperCase())).length;
}

function statusClass(status: string) {
  const normalized = status.toUpperCase();
  if (["ACTIVE", "PUBLISHED", "VERIFIED", "APPROVED", "AVAILABLE", "ACCEPTED", "HIRED", "WON", "RESOLVED"].includes(normalized)) return styles.statusGood;
  if (["PENDING", "PENDING_REVIEW", "NEW", "OPEN", "SUBMITTED", "QUOTING", "SCHEDULED", "IN_REVIEW"].includes(normalized)) return styles.statusWarm;
  if (["REJECTED", "SUSPENDED", "FAILED", "LOST", "CANCELLED", "INELIGIBLE"].includes(normalized)) return styles.statusDanger;
  return styles.statusNeutral;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {day: "2-digit", month: "short", year: "numeric"}).format(parsed);
}

function readableValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return new Intl.NumberFormat("en-IN").format(value);
  if (typeof value === "string") return value.replaceAll("_", " ");
  return "";
}

export function DashboardApp({locale, initialView = "overview", initialRecord, createProperty = false}: DashboardAppProps) {
  const auth = useSession();
  const [theme, setTheme] = useState<DashboardTheme>("light");
  useEffect(() => {
    if (auth.state === "guest") {
      window.location.replace(loginHref(locale, window.location.pathname + window.location.search + window.location.hash));
    }
  }, [auth.state, locale]);
  useEffect(() => {
    try {
      if (localStorage.getItem(dashboardThemeKey) === "dark") setTheme("dark");
    } catch {
      // The toggle remains available when storage is blocked.
    }
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try { localStorage.setItem(dashboardThemeKey, next); } catch {}
  }
  if (!auth.session) {
    if (auth.state !== "error") return (
      <main className={styles.dashboard} data-theme={theme}>
        <div className={styles.content}><DashboardSkeleton label={auth.state === "guest" ? "Opening the sign-in page" : "Checking your secure session"} /></div>
      </main>
    );
    return (
      <main className={`${styles.dashboard} ${styles.loadingPage}`} data-theme={theme}>
        <p role="alert">Could not connect to the workspace</p>
        <MuiButton onClick={() => void auth.refresh()} type="button">Retry</MuiButton>
      </main>
    );
  }

  return (
    <MarketplaceSessionScope auth={auth}><WorkspaceDashboard
      createProperty={createProperty}
      initialView={initialView}
      initialRecord={initialRecord}
      key={auth.session.role}
      locale={locale}
      logoutError={auth.error?.message}
      onLogout={auth.logout}
      onProfileSaved={auth.updateIdentity}
      onSessionExpired={auth.refresh}
      session={auth.session}
      signingOut={auth.accountBusy}
      theme={theme}
      onToggleTheme={toggleTheme}
    /></MarketplaceSessionScope>
  );
}

type WorkspaceDashboardProps = {
  locale: string;
  initialView: string;
  initialRecord?: string;
  createProperty: boolean;
  session: AuthSession;
  logoutError?: string;
  onLogout: () => Promise<void>;
  onProfileSaved: (profile: {fullName: string; logoUrl: string | null}) => void;
  onSessionExpired: () => Promise<void>;
  signingOut: boolean;
  theme: DashboardTheme;
  onToggleTheme: () => void;
};

function WorkspaceDashboard({locale, initialView, initialRecord, createProperty, session, logoutError, onLogout, onProfileSaved, onSessionExpired, signingOut, theme, onToggleTheme}: WorkspaceDashboardProps) {
  const t = useTranslations("Site");
  const config = getRoleConfig(session.role);
  const inbox = useNotifications();
  const isAdmin = session.role === "ADMIN";
  const buyerAccount = config.role === "BUYER";
  const canViewLeads = ["OWNER", "DEALER", "BUILDER"].includes(session.role);
  const logo = imageSource(session.logoUrl);
  const initials = buyerAccount ? session.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("") : session.name.slice(0, 1);
  const avatar = logo ? <Image src={logo} alt="" fill sizes="46px" unoptimized /> : initials.toUpperCase();
  const pathname = usePathname();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeView, setActiveViewState] = useState(!isAdmin && isAdminSection(initialView) ? "overview" : initialView);
  const [openedProject, setOpenedProject]=useState<string>();
  useEffect(()=>{if(initialView==="project-inventory")setOpenedProject(new URLSearchParams(window.location.search).get("project")||undefined);},[initialView]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formState, setFormState] = useState<{collection: WorkspaceCollection; item?: WorkspaceItem | null} | null>(null);
  const [posted, setPosted] = useState<{collection: string; item: WorkspaceItem} | null>(null);
  const listingShortcutHandled = useRef(false);
  const openedRecord = useRef("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenuButtonRef = useRef<HTMLButtonElement>(null);

  const loadWorkspace = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<Workspace>("/workspace");
      if (result.role !== session.role) {window.location.reload();return;}
      setWorkspace(result);
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        await onSessionExpired();
        return;
      }
      setError(requestMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onSessionExpired, session.role]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace, session.role]);

  useEffect(() => {
    setActiveViewState(!isAdmin && isAdminSection(initialView) ? "overview" : initialView);
  }, [initialView, isAdmin]);

  useEffect(() => {
    if (!initialRecord || !workspace || openedRecord.current === initialRecord) return;
    if (initialView !== "properties" && initialView !== "propertyInquiries") return;
    const collection = workspace.collections.find(({key}) => key === initialView);
    if (!collection) return;
    const controller = new AbortController();
    void apiRequest<WorkspaceItem>("/workspace/" + collection.key + "/" + encodeURIComponent(initialRecord), {signal: controller.signal}).then((item) => {
      if (controller.signal.aborted) return;
      openedRecord.current = initialRecord;
      setActiveViewState(collection.key);
      setFormState({collection, item});
    }, () => {
      if (!controller.signal.aborted) {
        openedRecord.current = initialRecord;
        toast.error(initialView === "properties" ? "This property is unavailable in your workspace." : "This enquiry is unavailable in your workspace.");
      }
    });
    return () => controller.abort();
  }, [initialRecord, initialView, workspace]);

  useEffect(() => {
    if (!menuOpen) return;
    closeMenuButtonRef.current?.focus();
    const compact = window.matchMedia("(max-width: 960px)");
    const handleResize = () => { if (!compact.matches) setMenuOpen(false); };
    compact.addEventListener("change", handleResize);
    return () => compact.removeEventListener("change", handleResize);
  }, [menuOpen]);

  useEffect(() => {
    if (!createProperty || !workspace || listingShortcutHandled.current) return;
    listingShortcutHandled.current = true;
    const collection = workspace.collections.find(({key}) => key === "properties");
    if (!collection || !canCreateCollection(getCollectionDescriptor("properties"), session.role)) {
      toast.error("Use an Owner, Dealer, or Builder account to list a property.");
      router.replace(pathname, {scroll: false});
      return;
    }
    setActiveViewState("properties");
    setFormState({collection});
    router.replace(`${pathname}?view=properties`, {scroll: false});
  }, [createProperty, workspace, session.role, pathname, router]);

  const collections = useMemo(() => {
    if (!workspace) return [];
    const order = new Map(config.collectionOrder.map((key, index) => [key, index]));
    return [...workspace.collections].sort((left, right) => (order.get(left.key) ?? 999) - (order.get(right.key) ?? 999));
  }, [config.collectionOrder, workspace]);
  const now = useNow({updateInterval: buyerAccount ? 60_000 : undefined});
  const summary = useMemo(() => buyerSummary(buyerAccount ? collections : [], now), [buyerAccount, collections, now]);

  useEffect(() => {
    if (!workspace || ["overview", "notifications", "billing", "profile"].includes(activeView)) return;
    if (session.role!=="ADMIN" && profileMenu[session.role].some(([key])=>key===activeView)) return;
    if ((isAdmin && ["builderProjects","project-inventory","profile-reviews","master-data","material-specifications","role-reviews", "homepage-slides", "property-comments", "articles", "website-theme"].includes(activeView)) || (canViewLeads && activeView === "property-map-leads")) return;
    if (isAdmin && isAdminSection(activeView)) return;
    if (!workspace.collections.some((collection) => collection.key === activeView)) setActiveViewState("overview");
  }, [activeView, canViewLeads, isAdmin, workspace, session.role]);

  function closeMenu() {
    setMenuOpen(false);
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  }

  function setActiveView(nextView: string) {
    setActiveViewState(nextView);
    setSearchTerm("");
    if (menuOpen) closeMenu();
    const query = nextView === "overview" ? "" : `?view=${encodeURIComponent(nextView)}`;
    router.replace(`${pathname}${query}`, {scroll: false});
  }

  const originalCollection=collections.find(c=>c.key===(activeView==="visits"?"propertyInquiries":activeView));
  const activeCollection=activeView==="visits" && originalCollection?{...originalCollection,label:"Site visits",items:originalCollection.items.filter(i=>i.status==="SITE_VISIT_SCHEDULED" || i.data.inquiryType==="SITE_VISIT")}:originalCollection;
  const adminCollectionSection = activeCollection && adminSections.slice(2).find((section) =>
    section.collectionKeys.some((key) => key === activeCollection.key),
  );
  const adminSection = isAdmin && !["master-data","profile-reviews","role-reviews","notifications", "billing", "profile", "jobs"].includes(activeView)
    ? getAdminSection(adminCollectionSection ? adminCollectionSection.id : activeView)
    : null;
  const menuLabel=session.role==="ADMIN"?({"material-specifications":"Product specifications","master-data":"Master data","profile-reviews":"Profile verification","role-reviews":"Account role reviews"} as Record<string,string>)[activeView]:profileMenu[session.role].find(([k])=>k===activeView)?.[1];
  const viewLabel = menuLabel ?? (activeView === "website-theme" && isAdmin ? "Website theme" : activeView === "homepage-slides" && isAdmin ? "Homepage Carousel"
    : activeView === "articles" && isAdmin ? "Articles"
    : activeView === "property-comments" && isAdmin ? "Property Comments"
    : activeView === "property-map-leads" && canViewLeads ? "Map Leads" : activeView === "billing" ? t("billing")
    : activeView === "profile" ? t("profile")
      : adminSection?.shortLabel ?? (activeView === "notifications" ? t("notifications") : activeCollection?.label ?? t("overview")));
  const configuredPrimary = collections.find((collection) => collection.key === config.primaryCollection);
  const primaryCollection = configuredPrimary && canCreateCollection(getCollectionDescriptor(configuredPrimary.key, configuredPrimary.label), session.role, configuredPrimary.items)
    ? configuredPrimary
    : collections.find((collection) => canCreateCollection(getCollectionDescriptor(collection.key, collection.label), session.role, collection.items)) ?? null;

  async function saveRecord(collection: WorkspaceCollection, item: WorkspaceItem | null | undefined, payload: WorkspaceMutation) {
    const {savedPropertyId,...mutation}=payload;
    if(savedPropertyId && collection.key==="properties" && !item){const record=await apiRequest<WorkspaceItem>("/workspace/properties/"+savedPropertyId,{method:"PATCH",body:mutation});if(canPayToFeature(collection.key,record.status))setPosted({collection:collection.key,item:record});toast.success(record.status==="DRAFT"?"Draft saved":"Property submitted for review.");await loadWorkspace(true);return;}
    let propertySentForReview = false;
    if (item) {
      const updated = await apiRequest<WorkspaceItem>(`/workspace/${encodeURIComponent(collection.key)}/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: payload,
      });
      if (canPayToFeature(collection.key, updated.status) && !canPayToFeature(collection.key, item.status)) setPosted({collection: collection.key, item: updated});
      propertySentForReview = collection.key === "properties" && item.status !== "PENDING_REVIEW" && updated.status === "PENDING_REVIEW";
    } else {
      const createPayload = {requestId: payload.requestId, title: payload.title, description: payload.description, status: payload.status, data: payload.data};
      const created = await apiRequest<WorkspaceItem>(`/workspace/${encodeURIComponent(collection.key)}`, {
        method: "POST",
        body: createPayload,
      });
      if (canPayToFeature(collection.key, created.status)) setPosted({collection: collection.key, item: created});
    }
    const {singular} = getCollectionDescriptor(collection.key, collection.label);
    const recordLabel = singular.charAt(0).toUpperCase() + singular.slice(1);
    toast.success(collection.key === "jobs" && payload.status === "PUBLISHED" ? "Job published." : propertySentForReview ? "Property changes sent for review."
      : !item && payload.status === "PENDING_REVIEW" ? "Listing submitted for review." : isAdmin && item ? "Review saved." : `${recordLabel} ${item ? "updated" : "created"}.`);
    await loadWorkspace(true);
  }

  async function featureProperty(id: string, featured: boolean, order?: number) {
    const result = await apiRequest<{featuredOrder: number | null}>(`/workspace/properties/${encodeURIComponent(id)}/feature`, {method: "PATCH", body: {featured, order}});
    toast.success(featured ? `Featured sort order saved at position ${result.featuredOrder}.` : "Property removed from featured listings.");
    await loadWorkspace(true);
    return result;
  }

  const recentItems = useMemo(() => collections
    .flatMap((collection) => collection.items.map((item) => ({collection, item})))
    .sort((left, right) => new Date(right.item.updatedAt).getTime() - new Date(left.item.updatedAt).getTime())
    .slice(0, 8), [collections]);

  return (
    <div className={styles.dashboard} data-theme={theme} data-role={buyerAccount ? "BUYER" : session.role}>
      {menuOpen && <Backdrop open className={styles.mobileScrim} onClick={closeMenu} />}
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`} id="workspace-sidebar" onKeyDown={(event) => {if (menuOpen && event.key === "Escape") closeMenu();}}>
        {buyerAccount ? <BuyerIdentity key={activeView === "profile" ? "editing" : "summary"} name={session.name} avatar={avatar} ready={Boolean(workspace)} summary={summary} onView={setActiveView}
          close={<MuiButton aria-label="Close menu" className={styles.mobileClose} onClick={closeMenu} ref={closeMenuButtonRef}><X size={19} /></MuiButton>} /> : <div className={styles.sidebarTop}>
          <Link className={styles.brand} href={`/${locale}`}>
            <BrandLogo width={168} />
          </Link>
          <MuiButton aria-label="Close menu" className={styles.mobileClose} onClick={closeMenu} ref={closeMenuButtonRef} type="button"><X size={19} /></MuiButton>
        </div>}

        {!buyerAccount && <div className={styles.roleSignature}>
          <span><config.icon size={19} /></span>
          <div><small>Workspace</small><strong>{config.shortLabel}</strong></div>
        </div>}

        <nav className={styles.navigation} aria-label="Workspace navigation">
          {!buyerAccount && <p>{isAdmin ? "Operations" : "Workspace"}</p>}
          {isAdmin ? adminSections.map((section) => (
            <MuiButton
              aria-current={adminSection?.id === section.id ? "page" : undefined}
              className={adminSection?.id === section.id ? styles.navActive : ""}
              key={section.id}
              onClick={() => setActiveView(section.id === "admin-overview" ? "overview" : section.id)}
              type="button"
            >
              <section.icon size={17} /><span>{section.shortLabel}</span>
            </MuiButton>
          )) : (
            <>
              <MuiButton aria-current={activeView === "overview" ? "page" : undefined} className={activeView === "overview" ? styles.navActive : ""} onClick={() => setActiveView("overview")} type="button">
                <LayoutDashboard size={17} /><span>{t("overview")}</span>
              </MuiButton>
              {session.role!=="ADMIN" && profileMenu[session.role].map(([key,label])=>{
                const Icon=collectionIcons[key]??FileText;
                return <MuiButton key={key} className={activeView===key?styles.navActive:""} aria-current={activeView===key?"page":undefined} type="button" onClick={()=>key==="find-jobs"?router.push("/"+locale+"/jobs"):setActiveView(key)}><Icon size={17}/><span>{label}</span></MuiButton>;
              })}
            </>
          )}
          {isAdmin && <><MuiButton type="button" onClick={()=>{setOpenedProject(undefined);setActiveView("builderProjects")}}><ClipboardList size={17}/><span>Builder projects</span></MuiButton><MuiButton type="button" onClick={()=>setActiveView("master-data")}><ClipboardList size={17}/><span>Master data</span></MuiButton><MuiButton type="button" onClick={()=>setActiveView("material-specifications")}><ClipboardList size={17}/><span>Product specifications</span></MuiButton><MuiButton type="button" onClick={()=>setActiveView("profile-reviews")}><ShieldCheck size={17}/><span>Profile verification</span></MuiButton><MuiButton type="button" onClick={() => setActiveView("role-reviews")}><UserRound size={17}/><span>Account role reviews</span></MuiButton><MuiButton type="button" aria-current={activeView === "jobs" ? "page" : undefined} onClick={() => setActiveView("jobs")}><ClipboardList size={17} /><span>Manage jobs</span></MuiButton><p>Website</p><MuiButton aria-current={activeView === "homepage-slides" ? "page" : undefined} className={activeView === "homepage-slides" ? styles.navActive : ""} onClick={() => setActiveView("homepage-slides")} type="button">
            <PanelTop size={17} /><span>Homepage Carousel</span>
          </MuiButton><MuiButton aria-current={activeView === "property-comments" ? "page" : undefined} className={activeView === "property-comments" ? styles.navActive : ""} onClick={() => setActiveView("property-comments")} type="button">
            <FileText size={17} /><span>Property Comments</span>
          </MuiButton><MuiButton aria-current={activeView === "articles" ? "page" : undefined} className={activeView === "articles" ? styles.navActive : ""} onClick={() => setActiveView("articles")} type="button">
            <FileText size={17} /><span>Articles</span>
          </MuiButton><MuiButton aria-current={activeView === "website-theme" ? "page" : undefined} className={activeView === "website-theme" ? styles.navActive : ""} onClick={() => setActiveView("website-theme")} type="button">
            <Palette size={17} /><span>Website theme</span>
          </MuiButton></>}
          {isAdmin && canViewLeads && <MuiButton aria-current={activeView === "property-map-leads" ? "page" : undefined} className={activeView === "property-map-leads" ? styles.navActive : ""} onClick={() => setActiveView("property-map-leads")} type="button">
            <UserRound size={17} /><span>Map leads</span>
          </MuiButton>}
          {buyerAccount && <a className={styles.buyerNavLink} href={`/${locale}/finance-services#eligibility`}><Landmark size={17} />Home loans &amp; eligibility</a>}
          {!buyerAccount && <p>{t("account")}</p>}
          <MuiButton aria-current={activeView === "profile" ? "page" : undefined} className={activeView === "profile" ? styles.navActive : ""} onClick={() => setActiveView("profile")} type="button">
            <UserRound size={17} /><span>{session.role==="WHITE_COLLAR_SEEKER"?"Resume / Profile":t("profile")}</span>
          </MuiButton>
          {isAdmin && <MuiButton aria-current={activeView === "billing" ? "page" : undefined} className={activeView === "billing" ? styles.navActive : ""} onClick={() => setActiveView("billing")} type="button">
            <CreditCard size={17} /><span>{locale === "en" ? "Plans & billing" : t("billing")}</span>
          </MuiButton>}
          <MuiButton aria-current={activeView === "notifications" ? "page" : undefined} className={activeView === "notifications" ? styles.navActive : ""} onClick={() => setActiveView("notifications")} type="button">
            <Bell size={17} /><span>{t("notifications")}</span>
          </MuiButton>
          {buyerAccount && workspace && <details className={styles.buyerMore}>
            <summary>More workspace tools</summary>
            {collections.filter(c => !profileMenu.BUYER.some(([key]) => key === c.key)).map(c =>
              <MuiButton key={c.key} onClick={() => setActiveView(c.key)} aria-current={activeView === c.key ? "page" : undefined}><FileText size={16} />{c.label}</MuiButton>)}
          </details>}
        </nav>

        <Link className={styles.marketplaceLink} href={`/${locale}`}><PanelTop size={17} /><span>{t("viewMarketplace")}</span><ArrowUpRight size={15} /></Link>
        <div className={styles.sidebarFooter}>
          {buyerAccount ? <small>{t("workspace")}</small> : <><div className={styles.profileAvatar} aria-hidden="true">{avatar}</div>
          <div><strong>{session.name}</strong><small>{config.label}</small></div></>}
          <MuiButton aria-label={signingOut ? "Signing out" : "Sign out"} disabled={signingOut} onClick={() => void onLogout()} title="Sign out" type="button">
            {signingOut ? <LoaderCircle className={styles.spin} size={17} /> : <LogOut size={17} />}
          </MuiButton>
        </div>
      </aside>

      <main className={styles.main} inert={menuOpen}>
        <header className={styles.topbar}>
          <MuiButton aria-controls="workspace-sidebar" aria-expanded={menuOpen} aria-label="Open workspace menu" className={styles.menuButton} onClick={() => setMenuOpen(true)} ref={menuButtonRef} type="button"><Menu size={20} /></MuiButton>
          <div className={styles.breadcrumbs}>
            <MarketplaceBreadcrumbs locale={locale} parent={{title: isAdmin ? "Admin" : t("workspace"), href: `/${locale}/dashboard`}} current={viewLabel} />
          </div>
          <div className={styles.topActions}>
            <LocaleMenu />
            <MuiButton aria-label="Dark mode" aria-pressed={theme === "dark"} className={styles.themeButton}
              onClick={onToggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} type="button">
              {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            </MuiButton>
            <MuiButton aria-label="Refresh workspace" className={styles.iconButton} disabled={loading || refreshing} onClick={() => void loadWorkspace()} title="Refresh workspace" type="button">
              <RefreshCcw className={loading || refreshing ? styles.spin : ""} size={17} />
            </MuiButton>
            <NotificationDropdown inbox={inbox} onViewAll={() => setActiveView("notifications")} />
            <details className={styles.identityMenu} onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;}}
              onKeyDown={event => {if (event.key === "Escape") {event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus();}}}>
            <summary className={styles.topIdentity} aria-label={t("profile")}>
              <span aria-hidden="true" className={styles.userChip}>{avatar}</span>
              <span className={styles.userName}>{session.name}</span>
            </summary>
            <div className={styles.identityLinks}>
              <MuiButton type="button" onClick={event => {event.currentTarget.closest("details")!.open = false; setActiveView("profile");}}>{t("manageProfile")}</MuiButton>
              {!isAdmin && <MuiButton type="button" onClick={()=>setActiveView("billing")}>Plans &amp; billing</MuiButton>}{!isAdmin && canViewLeads && <MuiButton type="button" onClick={()=>setActiveView("property-map-leads")}>Map leads</MuiButton>}
              <ManualUatLink />
              <ProfileTools locale={locale} />
            </div>
            </details>
          </div>
        </header>

        <div className={styles.content}>
          {logoutError ? <p className={styles.signOutError} role="alert"><CircleAlert size={16} aria-hidden="true" /> Sign-out failed. {logoutError}</p> : null}
          {posted && (activeView === "overview" || activeView === posted.collection) &&
            <FeaturePlacement key={posted.item.id} collection={posted.collection} item={posted.item} />}

          {activeView === "profile" || activeView==="portfolio" ? (isAdmin?<AccountProfile onSaved={onProfileSaved} onSessionExpired={onSessionExpired}/>:<><RoleEditor key={activeView} initialSection={activeView==="portfolio"?(session.role==="BLUE_COLLAR_WORKER"?"Contact and portfolio":"Portfolio"):undefined}/><details><summary>Account contact, photo and password</summary><AccountProfile onSaved={onProfileSaved} onSessionExpired={onSessionExpired}/></details></>) : loading ? <DashboardSkeleton /> : error ? (
            <section className={styles.errorState}>
              <CircleAlert size={28} />
              <div><h1>We could not load this workspace</h1><p>{error}</p></div>
              <MuiButton className={styles.secondaryButton} onClick={() => void loadWorkspace()} type="button"><RefreshCcw size={16} /> Try again</MuiButton>
            </section>
          ) : workspace ? (
            <>
              {(activeView==="builderProjects"||activeView==="project-inventory")&&(isAdmin||session.role==="BUILDER") ? <ProjectWorkbench key={activeView+String(openedProject)} initialId={openedProject} locale={locale} admin={isAdmin} inventory={activeView==="project-inventory"}/> : activeView==="master-data" && isAdmin ? <MasterAdmin/> : activeView==="profile-reviews" && isAdmin ? <ProfileReviews/> : activeView==="saved-jobs" && session.role==="WHITE_COLLAR_SEEKER"?<SavedJobs locale={locale}/> : activeView === "billing" ? (
                <BillingView collections={collections} memberName={session.name} onSessionExpired={onSessionExpired} role={session.role} />
              ) : activeView === "material-specifications" && isAdmin ? <SpecificationManager/> : activeView === "role-reviews" && isAdmin ? <RoleReviews /> : activeView === "website-theme" && isAdmin ? <WebsiteThemePanel /> : activeView === "homepage-slides" && isAdmin ? <HomepageSlidesPanel />
                : activeView === "articles" && isAdmin ? <AdminArticles locale={locale} />
                : activeView === "property-comments" && isAdmin ? <PropertyCommentModeration locale={locale} />
                : activeView === "property-map-leads" && canViewLeads ? <PropertyMapLeads locale={locale} />
                : adminSection ? (
                <><AdminOperations
                  collections={collections}
                  initialModule={activeCollection?.key}
                  key={activeView}
                  onInspect={(collection, item) => {if(collection.key==="builderProjects"){setOpenedProject(item.id);setActiveView("builderProjects")}else setFormState({collection,item})}}
                  onNavigate={setActiveView}
                  view={adminSection.id}
                />{adminSection.id === "admin-overview" && <WorkspaceCharts collections={collections} />}</>
              ) : activeView === "overview" && buyerAccount ? (
                <BuyerOverview locale={locale} name={session.name} summary={summary} onView={setActiveView}
                  onVisit={item => {const collection = collections.find(c => c.key === "propertyInquiries"); if (collection) setFormState({collection, item});}} />
              ) : activeView === "overview" ? (
                <><CompletionCard open={()=>setActiveView("profile")}/><Overview
                  collections={collections}
                  config={config}
                  onCreate={() => {if(primaryCollection?.key==="builderProjects"){setOpenedProject(undefined);setActiveView("builderProjects")}else if(primaryCollection)setFormState({collection:primaryCollection})}}
                  onOpenCollection={setActiveView}
                  primaryCollection={primaryCollection}
                  recentItems={recentItems}
                  userName={session.name}
                /></>
              ) : activeView === "notifications" ? (
                <NotificationsPage inbox={inbox} />
              ) : activeCollection ? (
                <CollectionView key={activeCollection.key}
                  canCreate={activeView!=="visits" && canCreateCollection(getCollectionDescriptor(activeCollection.key, activeCollection.label), session.role, activeCollection.items)}
                  collection={activeCollection}
                  onCreate={() => setFormState({collection: activeCollection})}
                  onEdit={(item) => setFormState({collection: activeCollection, item})}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </main>

      {formState ? (
        isAdmin && formState.item && formState.collection.key !== "jobs" ? (
          <AdminRecordReview
            collection={formState.collection}
            item={formState.item}
            key={formState.item.id}
            onReviewProperty={async propertyId => {
              const collection = collections.find(c => c.key === "properties");
              if (!collection) return;
              try {
                const item = await apiRequest<WorkspaceItem>("/workspace/properties/" + encodeURIComponent(propertyId)).catch(async error => {
                  if (!(error instanceof ApiClientError) || error.code !== "ROUTE_NOT_FOUND") throw error;
                  const refreshed = await apiRequest<Workspace>("/workspace");
                  const listing = refreshed.collections.find(c => c.key === "properties")?.items.find(row => row.id === propertyId);
                  if (!listing) throw error;
                  return listing;
                });
                setFormState(current => current === formState ? {collection, item} : current);
              } catch {
                toast.error("Could not open the linked property. Refresh the workspace and try again.");
              }
            }}
            onClose={() => setFormState(null)}
            onSave={(payload) => saveRecord(formState.collection, formState.item, payload)}
            onFeature={featureProperty}
          />
        ) : (
          <WorkspaceForm
            allowLockedPrivacyControl={!isAdmin}
            descriptor={getCollectionDescriptor(formState.collection.key, formState.collection.label)}
            item={formState.item}
            posterRole={session.role}
            onClose={() => setFormState(null)}
            onSave={(payload) => saveRecord(formState.collection, formState.item, payload)}
          />
        )
      ) : null}
      <Toaster
        position="top-right"
        containerStyle={{top: 16, right: 16, zIndex: 120}}
        toastOptions={{
          duration: 4000,
          style: {border: "1px solid var(--dashboard-line)", borderRadius: "0.75rem", color: "var(--dashboard-ink)", background: "var(--dashboard-surface)"},
        }}
      />
    </div>
  );
}

type OverviewProps = {
  collections: WorkspaceCollection[];
  config: ReturnType<typeof getRoleConfig>;
  primaryCollection: WorkspaceCollection | null;
  recentItems: {collection: WorkspaceCollection; item: WorkspaceItem}[];
  userName: string;
  onCreate: () => void;
  onOpenCollection: (key: string) => void;
};

function Overview({collections, config, primaryCollection, recentItems, userName, onCreate, onOpenCollection}: OverviewProps) {
  const firstName = userName.split(" ")[0];
  return (
    <>
      <section className={styles.hero} data-motion="enter">
        <div>
          {config.role !== "BUYER" && <p className={styles.kicker}>{config.shortLabel} overview</p>}
          <h1>Welcome, {firstName}</h1>
          <p>{config.workspaceDescription}</p>
        </div>
        {primaryCollection ? <MuiButton variant="contained" className={styles.primaryButton} onClick={onCreate} type="button"><Plus size={17} /> {config.primaryAction}</MuiButton> : null}
      </section>

      {config.role==="BUILDER"&&<ProjectMetrics/>}
      {config.role !== "BUYER" && config.role!=="BUILDER" && <section className={styles.metrics} aria-label="Workspace metrics" data-motion="stagger">
        {config.metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card component="article" variant="outlined" className={styles.metricCard} key={metric.label}>
              <span aria-hidden="true" className={styles.metricIcon}><Icon size={21} /></span>
              <h2>{metric.label}</h2>
              <strong>{countMetric(metric, collections)}</strong>
            </Card>
          );
        })}
      </section>}

      {config.role !== "BUYER" && <WorkspaceCharts collections={collections} primary={config.primaryCollection} />}
      <div className={styles.overviewGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>{config.role === "BUYER" ? "Your activity" : "Workspace modules"}</h2>
          </div>
          {collections.length ? (
            <div className={styles.collectionGrid}>
              {collections.map((collection) => {
                const Icon = collectionIcons[collection.key] ?? FileText;
                const descriptor = getCollectionDescriptor(collection.key, collection.label);
                return (
                  <MuiButton className={styles.collectionCard} key={collection.key} onClick={() => onOpenCollection(collection.key)} type="button">
                    <span className={styles.collectionIcon}><Icon size={19} /></span>
                    <span><strong>{collection.label}</strong><small>{descriptor.description}</small></span>
                    <em>{collection.items.length}</em>
                    <ArrowUpRight size={16} />
                  </MuiButton>
                );
              })}
            </div>
          ) : <EmptyState title={config.emptyTitle} description={config.emptyDescription} />}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Recent activity</h2>
            <MuiButton onClick={() => onOpenCollection("notifications")} type="button">View all</MuiButton>
          </div>
          {recentItems.length ? <ActivityList items={recentItems.slice(0, 5)} onOpenCollection={onOpenCollection} /> : <EmptyState compact title="Nothing new yet" description={config.notificationsEmpty} />}
        </section>
      </div>
    </>
  );
}

type CollectionViewProps = {
  canCreate: boolean;
  collection: WorkspaceCollection;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  onCreate: () => void;
  onEdit: (item: WorkspaceItem) => void;
};

function CollectionView({canCreate, collection, searchTerm, setSearchTerm, onCreate, onEdit}: CollectionViewProps) {
  const descriptor = getCollectionDescriptor(collection.key, collection.label);
  const [statusFilter, setStatusFilter] = useState("");
  const statuses = [...new Set(collection.items.map(({status}) => status))].sort();
  const filtersApplied = Boolean(searchTerm || statusFilter);
  const filteredItems = collection.items.filter((item) => (!statusFilter || item.status === statusFilter) &&
    `${item.title} ${item.description ?? ""} ${item.status}`.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <section>
      <div className={styles.pageHeading} data-motion="enter">
        <div><h1>{collection.label}</h1><p>{descriptor.description}</p></div>
        {canCreate ? <MuiButton variant="contained" className={styles.primaryButton} onClick={onCreate} type="button"><Plus size={17} /> {descriptor.createLabel}</MuiButton> : null}
      </div>

      <div className={styles.tablePanel}>
        <div className={styles.tableToolbar}>
          <label className={styles.searchBox}>
            <Search size={16} /><span className="sr-only">Search {collection.label}</span>
            <MaterialInput onChange={(event) => setSearchTerm(event.target.value)} placeholder={`Search ${collection.label.toLowerCase()}…`} value={searchTerm} />
          </label>
          <label className={styles.statusFilter}><span className="sr-only">Filter by status</span>
            <MaterialSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((status) => <option value={status} key={status}>{adminStatusLabel(status)}</option>)}
            </MaterialSelect>
          </label>
          <span aria-live="polite">{filteredItems.length} of {collection.items.length} records</span>
        </div>

        {filteredItems.length ? (
          <div className={styles.tableWrap}>
            <Table aria-label={collection.label} className={styles.dataTable} role="table">
              <TableHead role="rowgroup"><TableRow role="row"><TableCell component="th" scope="col">Record</TableCell><TableCell component="th" scope="col">Status</TableCell><TableCell component="th" scope="col">Key details</TableCell><TableCell component="th" scope="col">Updated</TableCell><TableCell component="th" scope="col"><span className="sr-only">Actions</span></TableCell></TableRow></TableHead>
              <TableBody role="rowgroup">
                {filteredItems.map((item) => {
                  const details = Object.entries(item.data ?? {}).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).slice(0, 3);
                  const action = item.canEditContent ? "Edit" : "View details";
                  const ActionIcon = item.canEditContent ? Pencil : Eye;
                  return (
                    <TableRow key={item.id} role="row">
                      <TableCell data-label="Record" role="cell"><strong>{item.title}</strong><small>{item.description || `Reference ${item.id.slice(0, 8)}`}</small></TableCell>
                      <TableCell data-label="Status" role="cell"><span className={`${styles.status} ${statusClass(item.status)}`}>{adminStatusLabel(item.status)}</span></TableCell>
                      <TableCell data-label="Key details" role="cell">
                        <div className={styles.dataPreview}>{details.length ? details.map(([key, value]) => <span key={key}><small>{prettifyKey(key)}</small>{readableValue(value)}</span>) : <em>No extra details</em>}</div>
                      </TableCell>
                      <TableCell data-label="Updated" role="cell"><time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time></TableCell>
                      <TableCell role="cell"><MuiButton aria-label={`${action} ${item.title}`} className={styles.editButton} onClick={() => onEdit(item)} type="button"><ActionIcon size={15} /> {action}</MuiButton></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState action={filtersApplied ? "Clear filters" : canCreate ? descriptor.createLabel : undefined} description={filtersApplied ? "Try a different search or status." : descriptor.description} onAction={filtersApplied ? () => {setSearchTerm("");setStatusFilter("");} : canCreate ? onCreate : undefined} title={filtersApplied ? "No matching records" : `No ${descriptor.label.toLowerCase()} yet`} />
        )}
      </div>
    </section>
  );
}

function ActivityList({items, onOpenCollection}: {items: {collection: WorkspaceCollection; item: WorkspaceItem}[]; onOpenCollection: (key: string) => void}) {
  return (
    <div className={styles.activityList}>
      {items.map(({collection, item}) => (
        <MuiButton key={`${collection.key}-${item.id}`} onClick={() => onOpenCollection(collection.key)} type="button">
          <span className={`${styles.activityDot} ${statusClass(item.status)}`}><CheckCircle2 size={14} /></span>
          <span><strong>{item.title}</strong><small>{collection.label} · {adminStatusLabel(item.status)}</small></span>
          <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
          <ChevronRight size={15} />
        </MuiButton>
      ))}
    </div>
  );
}

function EmptyState({title, description, action, onAction, compact = false}: {title: string; description: string; action?: string; onAction?: () => void; compact?: boolean}) {
  return (
    <div className={`${styles.emptyState} ${compact ? styles.emptyCompact : ""}`}>
      <span><FileText size={21} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && onAction ? <MuiButton className={styles.secondaryButton} onClick={onAction} type="button">{action}</MuiButton> : null}
    </div>
  );
}

function DashboardSkeleton({label = "Loading workspace"}: {label?: string}) {
  return (
    <SkeletonStatus className={styles.skeleton} label={label}>
      <div className={styles.skeletonHero} aria-hidden="true" />
      <div className={styles.skeletonMetrics} aria-hidden="true">{[0, 1, 2, 3].map((value) => <span key={value} />)}</div>
      <div className={styles.skeletonPanels} aria-hidden="true"><span /><span /></div>
    </SkeletonStatus>
  );
}

