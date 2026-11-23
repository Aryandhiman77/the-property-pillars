import {discoveryMarkets} from "@/config/discovery";
import {publicTasks, type PublicTaskPath} from "@/config/public-tasks";
import {locales} from "@/i18n/config";
import english from "@/messages/en.json";

const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thepropertypillar.com").replace(/\/+$/, "");

const pillars = [
  ["Properties and dealer profiles", ["properties", "dealers"]],
  ["Construction materials and quotes", ["materials"]],
  ["Home loan estimates and enquiries", ["finance-services"]],
  ["Property and construction professionals", ["professionals"]],
  ["Jobs and skilled workers", ["jobs", "workers"]]
] as const;

const sellerTasks: PublicTaskPath[] = ["post-property", "dealers/register", "projects/new", "materials/add-product", "workers/register"];

export function GET() {
  const sections = [
    "# ThePropertyPillar",
    "> A marketplace for property listings, materials and quotes, loan planning, professional services, and hiring.",
    "## Public directories",
    ...pillars.map(([label, sections]) => `- ${label}: ${sections.map((section) => `${site}/en/${section}`).join(", ")}`),
    "## Seller and professional onboarding",
    ...sellerTasks.map((task) => `- [${english.Site[publicTasks[task].title]}](${site}/en/${task})`),
    "Create an account with the corresponding role, complete the form, and follow its review status in your workspace. Public directories show published records.",
    "## Supported languages",
    locales.join(", ") + ". Arabic uses right-to-left layout. User-submitted descriptions retain their original language.",
    "## Indexed property markets",
    ...discoveryMarkets.map(({name, slug}) => `- [${name}](${site}/en/buy/${slug})`),
    "## Units and record details",
    "Properties can be listed with square feet, square metres, Gaj, Marla, Kanal, Bigha, Biswa, Murabba, acres and hectares. Published records are the source for the currency, listed measurements, availability and price.",
    "An enquiry is a request for follow-up. A calculator result is an estimate. Check listing, professional and registration details independently.",
    `## Sitemap\n${site}/sitemap.xml`,
  ];
  return new Response(sections.join("\n\n") + "\n", {headers: {"Content-Type": "text/plain; charset=utf-8"}});
}
