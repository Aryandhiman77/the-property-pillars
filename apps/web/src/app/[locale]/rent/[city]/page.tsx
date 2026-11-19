import {
  buildPropertyIntentMetadata,
  PropertyIntentPage,
  propertyCityStaticParams
} from "@/features/marketplace/property-intent-page";

type PageParams = {locale: string; city: string};

export const generateStaticParams = propertyCityStaticParams;

export async function generateMetadata({params}: {params: Promise<PageParams>}) {
  const {locale, city} = await params;
  return buildPropertyIntentMetadata({locale, intent: "rent", city});
}

export default async function RentCityPage({params}: {params: Promise<PageParams>}) {
  const {locale, city} = await params;
  return <PropertyIntentPage locale={locale} intent="rent" city={city} />;
}
