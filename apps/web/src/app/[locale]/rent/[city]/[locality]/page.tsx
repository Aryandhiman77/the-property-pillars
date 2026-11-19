import {
  buildPropertyIntentMetadata,
  PropertyIntentPage,
  propertyLocalityStaticParams
} from "@/features/marketplace/property-intent-page";

type PageParams = {locale: string; city: string; locality: string};

export const generateStaticParams = propertyLocalityStaticParams;

export async function generateMetadata({params}: {params: Promise<PageParams>}) {
  const {locale, city, locality} = await params;
  return buildPropertyIntentMetadata({
    locale,
    intent: "rent",
    city,
    locality
  });
}

export default async function RentLocalityPage({params}: {params: Promise<PageParams>}) {
  const {locale, city, locality} = await params;
  return (
    <PropertyIntentPage
      locale={locale}
      intent="rent"
      city={city}
      locality={locality}
    />
  );
}
