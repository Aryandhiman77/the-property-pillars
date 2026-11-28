import {PropertyFilterPanel} from "@/features/marketplace/property-filter-panel";
import {ListingGridSkeleton} from "@/features/marketplace/listing-grid-skeleton";
import {ProjectResultsView} from "./project-results-view";
import design from "@/features/marketplace/listing-results.module.css";
import directory from "@/features/marketplace/directory.module.css";

import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";
import Image from "next/image";
import Form from "next/form";
import {PropertyContact} from "@/features/marketplace/property-contact";
import Link from "next/link";
import {LoadingRows} from "@/components/ui/loading-skeleton";
import { Suspense, type ReactNode } from "react";
import { MarketplaceBreadcrumbs } from "@/features/marketplace/marketplace-shell";
import {
  projectFetch,
  detail,
  price,
  builderName,
  human,
  type ProjectCard,
} from "./public-data";
import { ProjectDrawings, type ProjectDrawing } from "./project-drawings";
import { ProjectReport } from "./project-report";
import { ProjectEnquiry } from "./project-enquiry";
import styles from "./projects.module.css";

type Query = Record<string, string | string[] | undefined>;
const filters = {
  q: "Project or location",
  city: "City",
  locality: "Locality",
  category: "Project category",
  type: "Property type",
  configuration: "Configuration",
  builder: "Builder",
  amenity: "Amenity",
  possession: "Possession by",
  min: "Minimum price",
  max: "Maximum price",
  currency: "Currency",
  verified: "Registration",
  status: "Construction stage",
  sort: "Sort by",
};
const fixedOptions: Record<string, string[]> = {
  sort: ["relevance", "newest", "price-low", "price-high", "possession"],
  verified: ["1"],
};
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export async function ProjectsDirectory({
  locale,
  query,
}: {
  locale: string;
  query: Query;
}) {
  const params = new URLSearchParams();
  for (const key of [...Object.keys(filters), "page", "builderId"]) {
    const value = query[key];
    if (typeof value === "string" && value.trim())
      params.set(key, value.trim());
  }
  const builderId = params.get("builderId");
  const root = "/" + locale + "/projects";
  return (
    <div className={styles.directoryPage}>
      <MarketplaceBreadcrumbs locale={locale} current="Builder projects" />
      <header className={design.heading}>
        <div><h1>Builder projects</h1><p>Browse new developments by location, construction stage and budget.</p></div>
        <Link className="market-button" href={"/" + locale + "/projects/new"}>List a project</Link>
      </header>
      {builderId && <Suspense key={builderId} fallback={<LoadingRows label="Loading builder" count={1}/>}><BuilderProfile builderId={builderId}/></Suspense>}
      <div className={`${directory.resultsLayout} ${design.layout}`}>
        <aside aria-label="Refine listings"><PropertyFilterPanel count={[...params.keys()].filter(key => key !== "page").length} resetHref={root}>
          <Suspense fallback={<LoadingRows label="Loading project filters" count={4}/>}>
            <ProjectFilters root={root} params={params}/>
          </Suspense>
        </PropertyFilterPanel></aside>
        <div className={directory.resultBody}>
          <Suspense key={params.toString()} fallback={<ListingGridSkeleton kind="projects"/>}>
            <ProjectResults params={params} locale={locale}/>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
async function ProjectFilters({root,params}:{root:string;params:URLSearchParams}) {
  const facets: Record<string,string[]> = await projectFetch("public/new-projects/facets");
  const options = {...facets, ...fixedOptions};
  const builderId = params.get("builderId");
  function field(key: keyof typeof filters) {
    return (
      <label key={key}>
        {filters[key]}
        {options[key] ? (
          <MaterialSelect form="project-search" name={key} defaultValue={params.get(key) ?? ""}>
            <option value="">Any</option>
            {[...new Set([...options[key], ...(params.get(key) ? [params.get(key)!] : [])])].map((v) => (
              <option key={v} value={v}>
                {key === "verified" ? "Verified registration" : human(v)}
              </option>
            ))}
          </MaterialSelect>
        ) : (
          <MaterialInput form="project-search"
            name={key}
            type={
              key === "possession"
                ? "date"
                : key === "min" || key === "max"
                  ? "number"
                  : "text"
            }
            defaultValue={params.get(key) ?? ""}
            min={0}
            maxLength={160}
          />
        )}
      </label>
    );
  }
  return (
          <Form id="project-search" action={root}>
            {builderId && <input type="hidden" name="builderId" value={builderId} />}
            <div className={design.filterScroll}>
              {([
                ["Search", ["q","city","status","sort"]],
                ["Project details", ["category","type","configuration","builder","verified"]],
                ["Location & amenities", ["locality","amenity","possession"]],
                ["Budget", ["currency","min","max"]],
              ] as const).map(([label,keys],index) => <details key={label} open={index === 0 || keys.some(key => params.has(key))}>
                <summary>{label}</summary><div className={styles.filterControls}>{keys.map(field)}</div>
              </details>)}
            </div>
            <div><MuiButton variant="contained" type="submit">Show projects</MuiButton></div>
          </Form>
  );
}
async function BuilderProfile({builderId}: {builderId: string}) {
  const profile: {
    name: string;
    about?: string;
    logo?: string;
    website?: string;
    specializations: string[];
  } | null = builderId
    ? await projectFetch(
        "public/project-builders/" + encodeURIComponent(builderId),
      )
    : null;
  return <>{profile && (
        <section id="builder-profile" className={styles.panel}>
          {profile.logo && (
            <Image
              unoptimized
              src={profile.logo}
              alt=""
              width={64}
              height={64}
            />
          )}
          <small>Builder profile</small>
          <h2>{profile.name}</h2>
          {profile.about && <p>{profile.about}</p>}
          {profile.specializations.length > 0 && (
            <p>{profile.specializations.join(" · ")}</p>
          )}
          {profile.website && /^https?:\/\//i.test(profile.website) && (
            <a href={profile.website} rel="noreferrer" target="_blank">
              Builder website
            </a>
          )}
        </section>
      )}</>;
}

async function ProjectResults({params, locale}: {params: URLSearchParams; locale: string}) {
  const result: {
    items?: ProjectCard[];
    total?: number;
    page?: number;
    error?: string;
  } = await projectFetch("public/new-projects?" + params);
  const root = "/" + locale + "/projects",
    page = result.page ?? 1;
  function pageLink(n: number) {
    const qs = new URLSearchParams(params);
    qs.set("page", String(n));
    return root + "?" + qs;
  }
  return <>{result.error ? (
        <p role="alert">{result.error}</p>
      ) : (
        <>
          <ProjectResultsView total={result.total ?? 0}>
            {result.items?.map((p) => (
              <article key={p.id} className={styles.tile}>
                {!p.media.length && <PropertyContact photos photoKind="projects" id={p.id} locale={locale} contactRole="builder" />}
                <Link href={root + "/" + p.slug}>
                  {p.media[0] && (
                    <Image
                      unoptimized
                      src={p.media[0].url}
                      alt={p.media[0].alt ?? p.name}
                      width={540}
                      height={300}
                    />
                  )}
                  <small>
                    {[
                      p.sponsored && "Sponsored project",
                      p.media[0]?.classification,
                      human(p.constructionStatus),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  <h2>{p.name}</h2>
                </Link>
                <p>{[p.localityName, p.cityName].filter(Boolean).join(", ")}</p>
                <p>{builderName(p)}</p>
                <strong>{price(p, locale)}</strong>
                <p>{p.configurations.map((c) => c.name).join(" · ")}</p>
                {p.possession && <p>Possession {p.possession}</p>}
                {p.regulatoryVerified && <small>Registration verified</small>}
                <div className={styles.actions}>
                  <Link href={root + "/" + p.slug}>View project</Link>
                  <Link href={root + "/" + p.slug + "#enquiry"}>Enquire</Link>
                </div>
              </article>
            ))}
          </ProjectResultsView>
          {!result.total && (
            <p>Try another location or broaden your filters.</p>
          )}
          <nav className={styles.actions} aria-label="Project pages">
            {page > 1 && <Link href={pageLink(page - 1)}>Previous page</Link>}
            {page * 20 < (result.total ?? 0) && (
              <Link href={pageLink(page + 1)}>Next page</Link>
            )}
          </nav>
        </>
      )}</>;
}

function Film({ url, title }: { url: string; title: string }) {
  return url.startsWith("/api/v1/uploads/") ? (
    <video controls preload="metadata" aria-label={title} src={url} />
  ) : /^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//i.test(
      url,
    ) ? (
    <a href={url} target="_blank" rel="noreferrer">
      Watch {title}
    </a>
  ) : null;
}
type ProjectFiles = {
  plans:ProjectDrawing[];
  documents:{id:string;title:string;category:string;version?:string;documentDate?:string;url:string}[];
  error?:string;
};
const master = (drawing:ProjectDrawing) => ["Master Plan","Site Plan"].includes(drawing.planType);

async function FloorPlanLink({files,configuration,name}:{files:Promise<ProjectFiles>;configuration:string;name:string}) {
  const drawing = (await files).plans?.find(plan=>plan.configurationId===configuration && !master(plan));
  return drawing ? <p><a href={"#drawing-" + drawing.id}>View floor plan for {name}</a></p> : null;
}

async function ProjectFileSections({files}:{files:Promise<ProjectFiles>}) {
  const assets = await files;
  if (assets.error) return <p role="alert">{assets.error}</p>;
  return <>
          {assets.plans.some(master) && (
            <Section title="Master and site plans">
              <ProjectDrawings plans={assets.plans.filter(master)} />
            </Section>
          )}
          {assets.plans.some((d) => !master(d)) && (
            <Section title="Floor plans">
              <ProjectDrawings plans={assets.plans.filter((d) => !master(d))} />
            </Section>
          )}
          {assets.documents.length > 0 && (
            <Section title="Documents">
              {assets.documents.map((d) => (
                <p key={d.id}>
                  <a href={d.url}>{d.title}</a> ·{" "}
                  {[d.category, d.version, d.documentDate]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ))}
            </Section>
          )}
  </>;
}

export async function ProjectPage({
  locale,
  slug,
  query,
}: {
  locale: string;
  slug: string;
  query: Query;
}) {
  const p = await detail(slug),
    root = "/" + locale + "/projects",
    url = root + "/" + p.slug,
    place = [p.localityName, p.cityName].filter(Boolean).join(", "),
    builder = builderName(p);
  const assets: Promise<ProjectFiles> = projectFetch("projects/" + p.id + "/assets").catch(() => ({
    plans:[], documents:[], error:"Project plans and documents could not be loaded.",
  }));
  const config =
    typeof query.configuration === "string" &&
    p.configurations.some((c) => c.id === query.configuration)
      ? query.configuration
      : undefined;
  const structured = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: p.name,
    description: p.shortDescription ?? undefined,
    address: place || undefined,
    url: new URL(
      url,
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://thepropertypillar.com",
    ).href,
    image: p.media.map((m) => m.url),
  };
  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      <MarketplaceBreadcrumbs
        locale={locale}
        parent={{ title: "New projects", href: root }}
        current={p.name}
      />
      <header className={styles.panel}>
        <small>
          {[
            p.sponsored && "Sponsored project",
            p.category,
            human(p.constructionStatus),
          ]
            .filter(Boolean)
            .join(" · ")}
        </small>
        <h1>{p.name}</h1>
        <p>{place}</p>
        {builder && (
          <Link
            href={
              p.builderProfile?.profile.verification === "VERIFIED"
                ? root +
                  "?builderId=" +
                  encodeURIComponent(p.builderProfile.profileId) +
                  "#builder-profile"
                : root + "?builder=" + encodeURIComponent(builder)
            }
          >
            {p.builderProfile?.profile.verification === "VERIFIED"
              ? "Builder profile"
              : "Projects by"}{" "}
            · {builder}
          </Link>
        )}
        <h2>{price(p, locale)}</h2>
        {p.shortDescription && <p>{p.shortDescription}</p>}
      </header>
      <div className={styles.layout}>
        <div className={styles.column}>
          {!p.media.length && <PropertyContact photos photoKind="projects" id={p.id} locale={locale} contactRole="builder" />}
          {p.media.length > 0 && (
            <Section title="Project gallery">
              <div className={styles.gallery}>
                {p.media.map((m, i) => (
                  <figure key={m.id ?? i}>
                    <a href={m.url} target="_blank" rel="noreferrer">
                      <Image
                        unoptimized
                        width={680}
                        height={420}
                        alt={m.alt || m.caption || p.name}
                        src={m.url}
                      />
                    </a>
                    <figcaption>
                      {[m.classification, m.caption]
                        .filter(Boolean)
                        .join(" · ")}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Section>
          )}
          <Section title="Project overview">
            <dl className={styles.facts}>
              {Object.entries({
                "Project type": p.projectType,
                Launch: p.launch,
                Possession: p.possession,
                "Project area":
                  p.projectArea && [p.projectArea, p.areaUnit?.code].join(" "),
                "Planned units": p.declaredUnits,
                "Registration number": p.registrationNumber,
                Authority: p.authority,
              })
                .filter(([, v]) => v != null)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
            {p.regulatoryVerified && <strong>Registration verified</strong>}
            {p.verificationUrl && (
              <p>
                <a href={p.verificationUrl} rel="noreferrer" target="_blank">
                  View registration reference
                </a>
              </p>
            )}
            {p.aboutHtml && (
              <div dangerouslySetInnerHTML={{ __html: p.aboutHtml }} />
            )}
            {p.highlights.length > 0 && (
              <ul>
                {p.highlights.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            )}
          </Section>
          {p.configurations.length > 0 && (
            <Section title="Configurations">
              <div className={styles.grid}>
                {p.configurations.map((c) => (
                  <article className={styles.tile} key={c.id}>
                    <small>{c.type.name}</small>
                    <h3>{c.name}</h3>
                    <p>
                      {[
                        c.bedrooms != null && c.bedrooms + " bedrooms",
                        c.bathrooms != null && c.bathrooms + " bathrooms",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {Object.entries({
                      Carpet: c.carpetArea,
                      "Built-up": c.builtUpArea,
                      "Super built-up": c.superBuiltUpArea,
                      Plot: c.plotArea,
                    })
                      .filter(([, v]) => v != null)
                      .map(([k, v]) => (
                        <p key={k}>
                          {k} area · {v} {c.areaUnit.code}
                        </p>
                      ))}
                    <strong>{price(c, locale)}</strong>
                    {c.fitOut && <p>Fit-out · {c.fitOut}</p>}
                    {c.priceMode === "EXACT" &&
                      c.startingPrice &&
                      c.currency &&
                      (c.carpetArea || c.plotArea) && (
                        <p>
                          {new Intl.NumberFormat(locale, {
                            style: "currency",
                            currency: c.currency,
                            maximumFractionDigits: 2,
                          }).format(
                            Number(c.startingPrice) /
                              Number(c.carpetArea || c.plotArea),
                          )}{" "}
                          per {c.areaUnit.code} of{" "}
                          {c.carpetArea ? "carpet" : "plot"} area
                        </p>
                      )}
                    <p>
                      {c.available == null
                        ? "Contact for availability"
                        : c.available + " available"}
                    </p>
                    {c.description && <p>{c.description}</p>}
                    <Suspense fallback={null}><FloorPlanLink files={assets} configuration={c.id} name={c.name}/></Suspense>
                    <Link href={url + "?configuration=" + c.id + "#enquiry"}>
                      Enquire about {c.name}
                    </Link>
                  </article>
                ))}
              </div>
            </Section>
          )}
          <Suspense fallback={<LoadingRows label="Loading project plans and documents" count={2}/>}>
            <ProjectFileSections files={assets}/>
          </Suspense>
          {!!(p.phases.length + p.towers.length) && (
            <Section title="Phases and towers">
              <ul>
                {p.phases.map((v) => (
                  <li key={v.id}>
                    {[v.name, human(v.status), v.possession]
                      .filter(Boolean)
                      .join(" · ")}
                  </li>
                ))}
                {p.towers.map((v) => (
                  <li key={v.id}>
                    {[v.name, v.floors != null && v.floors + " floors"]
                      .filter(Boolean)
                      .join(" · ")}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {p.amenities.length > 0 && (
            <Section title="Amenities">
              <ul>
                {p.amenities.map((a) => (
                  <li key={a.master.name}>
                    {a.master.name} · {a.status}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {p.specifications.length > 0 && (
            <Section title="Specifications">
              {p.specifications.map((s) => (
                <p key={s.id}>
                  <strong>{s.name}</strong> · {s.description}
                </p>
              ))}
            </Section>
          )}
          {p.paymentPlans.length > 0 && (
            <Section title="Payment plans">
              {p.paymentPlans.map((v) => (
                <div key={v.id}>
                  <h3>{v.name}</h3>
                  {v.description && <p>{v.description}</p>}
                  <ol>
                    {v.milestones.map((m) => (
                      <li key={m.id}>
                        {m.name} · {m.amount}
                        {v.mode === "FIXED" ? " " + v.currency : "%"}{" "}
                        {m.trigger} {m.timing}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </Section>
          )}
          {p.updates.length > 0 && (
            <Section title="Construction updates">
              {p.updates.map((u) => (
                <article key={u.id}>
                  <time>{u.date}</time>
                  <h3>{u.title}</h3>
                  <p>{u.description}</p>
                  {u.percentage != null && (
                    <p>{u.percentage}% construction complete</p>
                  )}
                  <div className={styles.gallery}>
                    {u.mediaUrls.map((src) => (
                      <Image
                        unoptimized
                        key={src}
                        width={400}
                        height={260}
                        alt={u.title}
                        src={src}
                      />
                    ))}
                  </div>
                  {u.videoUrl && <Film url={u.videoUrl} title={u.title} />}
                </article>
              ))}
            </Section>
          )}
          {p.videos.length > 0 && (
            <Section title="Project videos">
              {p.videos.map((v) => (
                <article key={v.id}>
                  <h3>{v.title}</h3>
                  <p>{[v.kind, v.caption].filter(Boolean).join(" · ")}</p>
                  <Film url={v.url} title={v.title} />
                </article>
              ))}
            </Section>
          )}
          {(p.places.length > 0 ||
            (p.latitude != null && p.longitude != null)) && (
            <Section title="Location and connectivity">
              {p.latitude != null && p.longitude != null && (
                <a
                  href={
                    "https://www.openstreetmap.org/?mlat=" +
                    p.latitude +
                    "&mlon=" +
                    p.longitude
                  }
                >
                  Open{" "}
                  {p.precision === "APPROXIMATE" ? "approximate" : "project"}{" "}
                  location on map
                </a>
              )}
              {p.places.map((v) => (
                <p key={v.id}>
                  {[
                    v.name,
                    v.category,
                    v.distance != null && [v.distance, v.unit].join(" "),
                    v.travelMinutes != null && v.travelMinutes + " min",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ))}
            </Section>
          )}
          {p.listings.length > 0 && (
            <Section title="Properties in this project">
              {p.listings.map((v) => (
                <p key={v.id}>
                  <Link href={"/" + locale + "/properties/" + v.id}>
                    {v.title}
                  </Link>
                </p>
              ))}
            </Section>
          )}
          <ProjectReport id={p.id} locale={locale} slug={p.slug} />
        </div>
        <aside>
          <ProjectEnquiry
            key={config ?? "general"}
            id={p.id}
            slug={p.slug}
            locale={locale}
            contactMethod={p.contactMethod}
            initialConfiguration={config}
            configurations={p.configurations.map(({ id, name }) => ({
              id,
              name,
            }))}
          />
        </aside>
      </div>
    </div>
  );
}
