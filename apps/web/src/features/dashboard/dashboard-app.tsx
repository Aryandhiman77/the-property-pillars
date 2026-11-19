"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import Image from "next/image";
import {usePathname, useRouter} from "next/navigation";
import type {LucideIcon} from "lucide-react";
import toast, {Toaster} from "react-hot-toast";
import {BrandLogo} from "@/components/layout/brand-logo";
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
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Megaphone,
  Moon,
  PackageSearch,
  Pencil,
  PanelTop,
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
import {AdminOperations, AdminRecordReview, adminSections, adminStatusLabel, getAdminSection, isAdminSection} from "@/features/admin";
import {loginHref} from "@/features/auth/login-return";
import type {AuthSession} from "@/features/auth/types";
import {useSession} from "@/features/auth/use-session";
import {BillingView} from "@/features/billing/billing-view";
import {canCreateCollection, getCollectionDescriptor, prettifyKey} from "./collection-config";
import {getRoleConfig} from "./role-config";
import type {MetricDefinition, Workspace, WorkspaceCollection, WorkspaceItem} from "./types";
import {WorkspaceForm, type WorkspaceMutation} from "./workspace-form";
import {NotificationDropdown, NotificationsPage, useNotifications} from "./notifications";
import {WorkspaceCharts} from "./workspace-charts";
import {AccountProfile} from "./account-profile";
import styles from "./dashboard.module.css";

type DashboardAppProps = {
  locale: string;
  initialView?: string;
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

export function DashboardApp({locale, initialView = "overview", createProperty = false}: DashboardAppProps) {
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
    return (
      <main className={`${styles.dashboard} ${styles.loadingPage}`} data-theme={theme}>
        <span className={styles.loadingMark} aria-hidden="true"><LoaderCircle size={23} /></span>
        <p>{auth.state === "error" ? "Could not connect to the workspace" : "Preparing your workspace"}</p>
        {auth.state === "error" ? <button onClick={() => void auth.refresh()} type="button">Retry</button>
          : <small>{auth.state === "guest" ? "Opening the sign-in page…" : "Checking your secure session…"}</small>}
      </main>
    );
  }

  return (
    <WorkspaceDashboard
      createProperty={createProperty}
      initialView={initialView}
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
    />
  );
}

type WorkspaceDashboardProps = {
  locale: string;
  initialView: string;
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

function WorkspaceDashboard({locale, initialView, createProperty, session, logoutError, onLogout, onProfileSaved, onSessionExpired, signingOut, theme, onToggleTheme}: WorkspaceDashboardProps) {
  const config = getRoleConfig(session.role);
  const inbox = useNotifications();
  const isAdmin = session.role === "ADMIN";
  const logo = imageSource(session.logoUrl);
  const avatar = logo ? <Image src={logo} alt="" fill sizes="38px" unoptimized /> : session.name.slice(0, 1).toUpperCase();
  const pathname = usePathname();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeView, setActiveViewState] = useState(!isAdmin && isAdminSection(initialView) ? "overview" : initialView);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formState, setFormState] = useState<{collection: WorkspaceCollection; item?: WorkspaceItem | null} | null>(null);
  const listingShortcutHandled = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenuButtonRef = useRef<HTMLButtonElement>(null);

  const loadWorkspace = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<Workspace>("/workspace");
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
  }, [onSessionExpired]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace, session.role]);

  useEffect(() => {
    if (menuOpen) closeMenuButtonRef.current?.focus();
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

  useEffect(() => {
    if (!workspace || ["overview", "notifications", "billing", "profile"].includes(activeView)) return;
    if (isAdmin && isAdminSection(activeView)) return;
    if (!workspace.collections.some((collection) => collection.key === activeView)) setActiveViewState("overview");
  }, [activeView, isAdmin, workspace]);

  function closeMenu() {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }

  function setActiveView(nextView: string) {
    setActiveViewState(nextView);
    setSearchTerm("");
    if (menuOpen) closeMenu();
    const query = nextView === "overview" ? "" : `?view=${encodeURIComponent(nextView)}`;
    router.replace(`${pathname}${query}`, {scroll: false});
  }

  const activeCollection = collections.find((collection) => collection.key === activeView) ?? null;
  const adminCollectionSection = activeCollection && adminSections.slice(2).find((section) =>
    section.collectionKeys.some((key) => key === activeCollection.key),
  );
  const adminSection = isAdmin && !["notifications", "billing", "profile"].includes(activeView)
    ? getAdminSection(adminCollectionSection ? adminCollectionSection.id : activeView)
    : null;
  const viewLabel = activeView === "billing"
    ? "Payments & invoices"
    : activeView === "profile" ? "Profile"
      : adminSection?.shortLabel ?? (activeView === "notifications" ? "Notifications" : activeCollection?.label ?? "Overview");
  const configuredPrimary = collections.find((collection) => collection.key === config.primaryCollection);
  const primaryCollection = configuredPrimary && canCreateCollection(getCollectionDescriptor(configuredPrimary.key, configuredPrimary.label), session.role, configuredPrimary.items)
    ? configuredPrimary
    : collections.find((collection) => canCreateCollection(getCollectionDescriptor(collection.key, collection.label), session.role, collection.items)) ?? null;

  async function saveRecord(collection: WorkspaceCollection, item: WorkspaceItem | null | undefined, payload: WorkspaceMutation) {
    if (item) {
      await apiRequest(`/workspace/${encodeURIComponent(collection.key)}/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: payload,
      });
    } else {
      const createPayload = {title: payload.title, description: payload.description, status: payload.status, data: payload.data};
      await apiRequest(`/workspace/${encodeURIComponent(collection.key)}`, {
        method: "POST",
        body: createPayload,
      });
    }
    const {singular} = getCollectionDescriptor(collection.key, collection.label);
    const recordLabel = singular.charAt(0).toUpperCase() + singular.slice(1);
    toast.success(!item && payload.status === "PENDING_REVIEW" ? "Listing submitted for review." : isAdmin && item ? "Review saved." : `${recordLabel} ${item ? "updated" : "created"}.`);
    await loadWorkspace(true);
  }

  const recentItems = useMemo(() => collections
    .flatMap((collection) => collection.items.map((item) => ({collection, item})))
    .sort((left, right) => new Date(right.item.updatedAt).getTime() - new Date(left.item.updatedAt).getTime())
    .slice(0, 8), [collections]);

  return (
    <div className={styles.dashboard} data-theme={theme} data-role={session.role}>
      <button aria-hidden="true" className={`${styles.mobileScrim} ${menuOpen ? styles.mobileScrimVisible : ""}`} onClick={closeMenu} tabIndex={-1} type="button" />
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`} id="workspace-sidebar" onKeyDown={(event) => {if (menuOpen && event.key === "Escape") closeMenu();}}>
        <div className={styles.sidebarTop}>
          <Link className={styles.brand} href={`/${locale}`}>
            <BrandLogo width={168} />
          </Link>
          <button aria-label="Close menu" className={styles.mobileClose} onClick={closeMenu} ref={closeMenuButtonRef} type="button"><X size={19} /></button>
        </div>

        <div className={styles.roleSignature}>
          <span><config.icon size={19} /></span>
          <div><small>Workspace</small><strong>{config.shortLabel}</strong></div>
        </div>

        <nav className={styles.navigation} aria-label="Workspace navigation">
          <p>{isAdmin ? "Operations" : "Workspace"}</p>
          {isAdmin ? adminSections.map((section) => (
            <button
              aria-current={adminSection?.id === section.id ? "page" : undefined}
              className={adminSection?.id === section.id ? styles.navActive : ""}
              key={section.id}
              onClick={() => setActiveView(section.id === "admin-overview" ? "overview" : section.id)}
              type="button"
            >
              <section.icon size={17} /><span>{section.shortLabel}</span>
            </button>
          )) : (
            <>
              <button aria-current={activeView === "overview" ? "page" : undefined} className={activeView === "overview" ? styles.navActive : ""} onClick={() => setActiveView("overview")} type="button">
                <LayoutDashboard size={17} /><span>Overview</span>
              </button>
              {collections.map((collection) => {
                const Icon = collectionIcons[collection.key] ?? FileText;
                return (
                  <button aria-current={activeView === collection.key ? "page" : undefined} className={activeView === collection.key ? styles.navActive : ""} key={collection.key} onClick={() => setActiveView(collection.key)} type="button">
                    <Icon size={17} /><span>{collection.label}</span><b>{collection.items.length}</b>
                  </button>
                );
              })}
            </>
          )}
          <p>Account</p>
          <button aria-current={activeView === "profile" ? "page" : undefined} className={activeView === "profile" ? styles.navActive : ""} onClick={() => setActiveView("profile")} type="button">
            <UserRound size={17} /><span>Profile</span>
          </button>
          <button aria-current={activeView === "billing" ? "page" : undefined} className={activeView === "billing" ? styles.navActive : ""} onClick={() => setActiveView("billing")} type="button">
            <CreditCard size={17} /><span>Payments &amp; invoices</span>
          </button>
          <button aria-current={activeView === "notifications" ? "page" : undefined} className={activeView === "notifications" ? styles.navActive : ""} onClick={() => setActiveView("notifications")} type="button">
            <Bell size={17} /><span>Notifications</span>
          </button>
        </nav>

        <Link className={styles.marketplaceLink} href={`/${locale}`}><PanelTop size={17} /><span>View marketplace</span><ArrowUpRight size={15} /></Link>
        <div className={styles.sidebarFooter}>
          <div className={styles.profileAvatar} aria-hidden="true">{avatar}</div>
          <div><strong>{session.name}</strong><small>{config.label}</small></div>
          <button aria-label={signingOut ? "Signing out" : "Sign out"} disabled={signingOut} onClick={() => void onLogout()} title="Sign out" type="button">
            {signingOut ? <LoaderCircle className={styles.spin} size={17} /> : <LogOut size={17} />}
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button aria-controls="workspace-sidebar" aria-expanded={menuOpen} aria-label="Open workspace menu" className={styles.menuButton} onClick={() => setMenuOpen(true)} ref={menuButtonRef} type="button"><Menu size={20} /></button>
          <div className={styles.breadcrumbs}>
            <span>{isAdmin ? "Admin" : "Workspace"}</span><ChevronRight size={14} />
            <strong>{viewLabel}</strong>
          </div>
          <div className={styles.topActions}>
            <button aria-label="Dark mode" aria-pressed={theme === "dark"} className={styles.themeButton}
              onClick={onToggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} type="button">
              {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            </button>
            <button aria-label="Refresh workspace" className={styles.iconButton} disabled={refreshing} onClick={() => void loadWorkspace(true)} title="Refresh workspace" type="button">
              <RefreshCcw className={refreshing ? styles.spin : ""} size={17} />
            </button>
            <NotificationDropdown inbox={inbox} onViewAll={() => setActiveView("notifications")} />
            <button className={styles.topIdentity} aria-label="Open profile" aria-current={activeView === "profile" ? "page" : undefined} onClick={() => setActiveView("profile")} type="button">
              <span aria-hidden="true" className={styles.userChip}>{avatar}</span>
              <span className={styles.userName}>{session.name}</span>
            </button>
          </div>
        </header>

        <div className={styles.content}>
          {logoutError ? <p className={styles.signOutError} role="alert"><CircleAlert size={16} aria-hidden="true" /> Sign-out failed. {logoutError}</p> : null}

          {activeView === "profile" ? <AccountProfile onSaved={onProfileSaved} onSessionExpired={onSessionExpired} /> : loading ? <DashboardSkeleton /> : error ? (
            <section className={styles.errorState}>
              <CircleAlert size={28} />
              <div><h1>We could not load this workspace</h1><p>{error}</p></div>
              <button className={styles.secondaryButton} onClick={() => void loadWorkspace()} type="button"><RefreshCcw size={16} /> Try again</button>
            </section>
          ) : workspace ? (
            <>
              {activeView === "billing" ? (
                <BillingView collections={collections} memberName={session.name} onSessionExpired={onSessionExpired} role={session.role} />
              ) : adminSection ? (
                <><AdminOperations
                  collections={collections}
                  initialModule={activeCollection?.key}
                  key={activeView}
                  onInspect={(collection, item) => setFormState({collection, item})}
                  onNavigate={setActiveView}
                  view={adminSection.id}
                />{adminSection.id === "admin-overview" && <WorkspaceCharts collections={collections} />}</>
              ) : activeView === "overview" ? (
                <Overview
                  collections={collections}
                  config={config}
                  onCreate={() => primaryCollection && setFormState({collection: primaryCollection})}
                  onOpenCollection={setActiveView}
                  primaryCollection={primaryCollection}
                  recentItems={recentItems}
                  userName={session.name}
                />
              ) : activeView === "notifications" ? (
                <NotificationsPage inbox={inbox} />
              ) : activeCollection ? (
                <CollectionView key={activeCollection.key}
                  canCreate={canCreateCollection(getCollectionDescriptor(activeCollection.key, activeCollection.label), session.role, activeCollection.items)}
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
        isAdmin && formState.item ? (
          <AdminRecordReview
            collection={formState.collection}
            item={formState.item}
            key={formState.item.id}
            onClose={() => setFormState(null)}
            onSave={(payload) => saveRecord(formState.collection, formState.item, payload)}
          />
        ) : (
          <WorkspaceForm
            allowLockedPrivacyControl={!isAdmin}
            descriptor={getCollectionDescriptor(formState.collection.key, formState.collection.label)}
            item={formState.item}
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
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{config.shortLabel} overview</p>
          <h1>Welcome, {firstName}</h1>
          <p>{config.workspaceDescription}</p>
        </div>
        {primaryCollection ? <button className={styles.primaryButton} onClick={onCreate} type="button"><Plus size={17} /> {config.primaryAction}</button> : null}
      </section>

      <section className={styles.metrics} aria-label="Workspace metrics">
        {config.metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className={styles.metricCard} key={metric.label}>
              <span aria-hidden="true" className={styles.metricIcon}><Icon size={21} /></span>
              <h2>{metric.label}</h2>
              <strong>{countMetric(metric, collections)}</strong>
            </article>
          );
        })}
      </section>

      <WorkspaceCharts collections={collections} primary={config.primaryCollection} />
      <div className={styles.overviewGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Workspace modules</h2>
          </div>
          {collections.length ? (
            <div className={styles.collectionGrid}>
              {collections.map((collection) => {
                const Icon = collectionIcons[collection.key] ?? FileText;
                const descriptor = getCollectionDescriptor(collection.key, collection.label);
                return (
                  <button className={styles.collectionCard} key={collection.key} onClick={() => onOpenCollection(collection.key)} type="button">
                    <span className={styles.collectionIcon}><Icon size={19} /></span>
                    <span><strong>{collection.label}</strong><small>{descriptor.description}</small></span>
                    <em>{collection.items.length}</em>
                    <ArrowUpRight size={16} />
                  </button>
                );
              })}
            </div>
          ) : <EmptyState title={config.emptyTitle} description={config.emptyDescription} />}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Recent activity</h2>
            <button onClick={() => onOpenCollection("notifications")} type="button">View all</button>
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
      <div className={styles.pageHeading}>
        <div><h1>{collection.label}</h1><p>{descriptor.description}</p></div>
        {canCreate ? <button className={styles.primaryButton} onClick={onCreate} type="button"><Plus size={17} /> {descriptor.createLabel}</button> : null}
      </div>

      <div className={styles.tablePanel}>
        <div className={styles.tableToolbar}>
          <label className={styles.searchBox}>
            <Search size={16} /><span className="sr-only">Search {collection.label}</span>
            <input onChange={(event) => setSearchTerm(event.target.value)} placeholder={`Search ${collection.label.toLowerCase()}…`} value={searchTerm} />
          </label>
          <label className={styles.statusFilter}><span className="sr-only">Filter by status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((status) => <option value={status} key={status}>{adminStatusLabel(status)}</option>)}
            </select>
          </label>
          <span aria-live="polite">{filteredItems.length} of {collection.items.length} records</span>
        </div>

        {filteredItems.length ? (
          <div className={styles.tableWrap}>
            <table aria-label={collection.label} className={styles.dataTable} role="table">
              <thead role="rowgroup"><tr role="row"><th scope="col">Record</th><th scope="col">Status</th><th scope="col">Key details</th><th scope="col">Updated</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody role="rowgroup">
                {filteredItems.map((item) => {
                  const details = Object.entries(item.data ?? {}).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).slice(0, 3);
                  const action = item.canEditContent ? "Edit" : "View details";
                  const ActionIcon = item.canEditContent ? Pencil : Eye;
                  return (
                    <tr key={item.id} role="row">
                      <td data-label="Record" role="cell"><strong>{item.title}</strong><small>{item.description || `Reference ${item.id.slice(0, 8)}`}</small></td>
                      <td data-label="Status" role="cell"><span className={`${styles.status} ${statusClass(item.status)}`}>{adminStatusLabel(item.status)}</span></td>
                      <td data-label="Key details" role="cell">
                        <div className={styles.dataPreview}>{details.length ? details.map(([key, value]) => <span key={key}><small>{prettifyKey(key)}</small>{readableValue(value)}</span>) : <em>No extra details</em>}</div>
                      </td>
                      <td data-label="Updated" role="cell"><time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time></td>
                      <td role="cell"><button aria-label={`${action} ${item.title}`} className={styles.editButton} onClick={() => onEdit(item)} type="button"><ActionIcon size={15} /> {action}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
        <button key={`${collection.key}-${item.id}`} onClick={() => onOpenCollection(collection.key)} type="button">
          <span className={`${styles.activityDot} ${statusClass(item.status)}`}><CheckCircle2 size={14} /></span>
          <span><strong>{item.title}</strong><small>{collection.label} · {adminStatusLabel(item.status)}</small></span>
          <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
          <ChevronRight size={15} />
        </button>
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
      {action && onAction ? <button className={styles.secondaryButton} onClick={onAction} type="button">{action}</button> : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className={styles.skeleton} aria-label="Loading workspace" aria-live="polite">
      <div className={styles.skeletonHero} />
      <div className={styles.skeletonMetrics}>{[0, 1, 2, 3].map((value) => <span key={value} />)}</div>
      <div className={styles.skeletonPanels}><span /><span /></div>
    </div>
  );
}

