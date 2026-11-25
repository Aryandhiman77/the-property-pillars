import { propertyTypesByCategory, propertyTypeKey } from "@the-property-pillar/contracts";
import { marketplaceArtwork, marketplaceDestinations, propertyListingHref } from "@/config/marketplace";
import type { AppLocale } from "@/i18n/config";

const audienceLabels: Record<AppLocale, string[]> = {
  en: [
    "For Buyers",
    "For Tenants",
    "For Owners",
    "For Dealers / Builders",
    "Popular searches",
    "Owner offerings",
    "Dealer offerings",
    "Plans & billing",
    "View enquiries",
    "PG / Co-living",
    "Insights",
    "Research and advice",
  ],
  hi: [
    "खरीदारों के लिए",
    "किरायेदारों के लिए",
    "मालिकों के लिए",
    "डीलर / बिल्डर",
    "लोकप्रिय खोजें",
    "मालिक सेवाएँ",
    "डीलर सेवाएँ",
    "प्लान और बिलिंग",
    "पूछताछ देखें",
    "पीजी / को-लिविंग",
    "बाज़ार की जानकारी",
    "शोध और सलाह",
  ],
  pa: [
    "ਖਰੀਦਦਾਰਾਂ ਲਈ",
    "ਕਿਰਾਏਦਾਰਾਂ ਲਈ",
    "ਮਾਲਕਾਂ ਲਈ",
    "ਡੀਲਰ / ਬਿਲਡਰ",
    "ਪ੍ਰਸਿੱਧ ਖੋਜਾਂ",
    "ਮਾਲਕ ਸੇਵਾਵਾਂ",
    "ਡੀਲਰ ਸੇਵਾਵਾਂ",
    "ਪਲਾਨ ਅਤੇ ਬਿਲਿੰਗ",
    "ਪੁੱਛਗਿੱਛ ਵੇਖੋ",
    "ਪੀਜੀ / ਸਾਂਝੀ ਰਿਹਾਇਸ਼",
    "ਬਾਜ਼ਾਰ ਦੀ ਜਾਣਕਾਰੀ",
    "ਖੋਜ ਅਤੇ ਸਲਾਹ",
  ],
  gu: [
    "ખરીદદારો માટે",
    "ભાડૂતો માટે",
    "માલિકો માટે",
    "ડીલર / બિલ્ડર",
    "લોકપ્રિય શોધ",
    "માલિક સેવાઓ",
    "ડીલર સેવાઓ",
    "પ્લાન અને બિલિંગ",
    "પૂછપરછ જુઓ",
    "પીજી / સહનિવાસ",
    "બજારની માહિતી",
    "સંશોધન અને સલાહ",
  ],
  mr: [
    "खरेदीदारांसाठी",
    "भाडेकरूंसाठी",
    "मालकांसाठी",
    "डीलर / बिल्डर",
    "लोकप्रिय शोध",
    "मालक सेवा",
    "डीलर सेवा",
    "प्लॅन आणि बिलिंग",
    "चौकशी पहा",
    "पीजी / सहनिवास",
    "बाजाराची माहिती",
    "संशोधन आणि सल्ला",
  ],
  ta: [
    "வாங்குபவர்கள்",
    "வாடகைதாரர்கள்",
    "உரிமையாளர்கள்",
    "முகவர்கள் / கட்டுநர்கள்",
    "பிரபல தேடல்கள்",
    "உரிமையாளர் சேவைகள்",
    "முகவர் சேவைகள்",
    "திட்டங்கள் மற்றும் கட்டணம்",
    "விசாரணைகள்",
    "பகிர்வு விடுதி",
    "சந்தை நிலவரம்",
    "ஆய்வு மற்றும் ஆலோசனை",
  ],
  te: [
    "కొనుగోలుదారులు",
    "అద్దెదారులు",
    "యజమానులు",
    "డీలర్లు / బిల్డర్లు",
    "ప్రసిద్ధ శోధనలు",
    "యజమాని సేవలు",
    "డీలర్ సేవలు",
    "ప్లాన్లు మరియు బిల్లింగ్",
    "విచారణలు",
    "పీజీ / సహనివాసం",
    "మార్కెట్ సమాచారం",
    "పరిశోధన మరియు సలహా",
  ],
  kn: [
    "ಖರೀದಿದಾರರಿಗೆ",
    "ಬಾಡಿಗೆದಾರರಿಗೆ",
    "ಮಾಲೀಕರಿಗೆ",
    "ಡೀಲರ್ / ಬಿಲ್ಡರ್",
    "ಜನಪ್ರಿಯ ಹುಡುಕಾಟಗಳು",
    "ಮಾಲೀಕರ ಸೇವೆಗಳು",
    "ಡೀಲರ್ ಸೇವೆಗಳು",
    "ಯೋಜನೆ ಮತ್ತು ಬಿಲ್ಲಿಂಗ್",
    "ವಿಚಾರಣೆಗಳು",
    "ಪಿಜಿ / ಸಹವಾಸ",
    "ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ",
    "ಸಂಶೋಧನೆ ಮತ್ತು ಸಲಹೆ",
  ],
  bn: [
    "ক্রেতাদের জন্য",
    "ভাড়াটেদের জন্য",
    "মালিকদের জন্য",
    "ডিলার / নির্মাতা",
    "জনপ্রিয় অনুসন্ধান",
    "মালিক পরিষেবা",
    "ডিলার পরিষেবা",
    "প্ল্যান ও বিলিং",
    "অনুসন্ধান দেখুন",
    "পিজি / যৌথ আবাসন",
    "বাজারের তথ্য",
    "গবেষণা ও পরামর্শ",
  ],
  es: [
    "Compradores",
    "Inquilinos",
    "Propietarios",
    "Agentes / promotores",
    "Búsquedas populares",
    "Para propietarios",
    "Servicios para agentes",
    "Planes y facturación",
    "Ver consultas",
    "Alojamiento compartido",
    "Información del mercado",
    "Investigación y consejos",
  ],
  fr: [
    "Acheteurs",
    "Locataires",
    "Propriétaires",
    "Agents / promoteurs",
    "Recherches populaires",
    "Services propriétaires",
    "Services professionnels",
    "Offres et facturation",
    "Demandes reçues",
    "Colocation",
    "Tendances du marché",
    "Études et conseils",
  ],
  de: [
    "Für Käufer",
    "Für Mieter",
    "Für Eigentümer",
    "Makler / Bauträger",
    "Beliebte Suchen",
    "Eigentümerservice",
    "Maklerservice",
    "Tarife und Abrechnung",
    "Anfragen ansehen",
    "Wohngemeinschaften",
    "Markteinblicke",
    "Recherche und Beratung",
  ],
  pt: [
    "Compradores",
    "Inquilinos",
    "Proprietários",
    "Corretores / construtoras",
    "Buscas populares",
    "Serviços ao proprietário",
    "Serviços ao corretor",
    "Planos e faturamento",
    "Ver consultas",
    "Moradia compartilhada",
    "Panorama do mercado",
    "Pesquisa e orientação",
  ],
  zh: [
    "买家",
    "租客",
    "业主",
    "经纪人 / 开发商",
    "热门搜索",
    "业主服务",
    "经纪人服务",
    "套餐与账单",
    "查看咨询",
    "合租房",
    "市场洞察",
    "研究与建议",
  ],
  ja: [
    "購入者向け",
    "入居者向け",
    "オーナー向け",
    "仲介・開発会社向け",
    "人気の検索",
    "オーナーサービス",
    "仲介サービス",
    "プランと請求",
    "問い合わせを見る",
    "シェアハウス",
    "市場動向",
    "調査とアドバイス",
  ],
  ar: [
    "للمشترين",
    "للمستأجرين",
    "للمالكين",
    "للوسطاء والمطورين",
    "عمليات البحث الشائعة",
    "خدمات المالك",
    "خدمات الوسيط",
    "الباقات والفواتير",
    "عرض الاستفسارات",
    "السكن المشترك",
    "رؤى السوق",
    "البحث والمشورة",
  ],
};
type MenuLink = { label: string; href: string };
type Column = { label: string; links: MenuLink[] };
type Category = { label: string; columns: Column[] };
export type AudienceMenu = {
  label: string;
  categories: Category[];
  feature: { title: string; image?: string; link: MenuLink; links?: MenuLink[] };
};

export function audienceMenus(
  locale: AppLocale,
  t: (key: string) => string,
  articles: string,
  city?: string,
  country?: string,
): AudienceMenu[] {
  const [buyers, tenants, owners, dealers, popular, ownerOffers, dealerOffers, plans, enquiries, shared, insights, research] =
    audienceLabels[locale];
  const link = (label: string, path: string): MenuLink => ({ label, href: "/" + locale + path });
  const column = (label: string, links: MenuLink[]): Column => ({ label, links });
  const group = (label: string, ...columns: Column[]): Category => ({ label, columns });
  const workspace = link(t("dashboard"), "/dashboard"),
    post = { label: t("listProperty"), href: propertyListingHref(locale) };
  const responses = link(enquiries, "/dashboard?view=propertyInquiries"),
    billing = link(plans, "/dashboard?view=billing");
  const resources = column(t("resources"), [
    link(articles, "/articles"),
    link(t("loanCalculator"), "/finance-services#emi-calculator"),
    {label: t("loanEnquiry"), href: "#loan-enquiry"},
  ]);
  const people = column(t("findPeople"), [
    link(t("dealers"), "/dealers"),
    link(t("professionals"), "/professionals"),
    link(t("workers"), "/workers"),
  ]);
  const marketplace = column(t("marketplace"), [
    link(t("materials"), "/materials"),
    link(t("jobs"), "/jobs"),
    link(t("projects"), "/projects"),
  ]);
  const services = group(t("services"), people, marketplace);
  const reading = group(articles, column(articles, [link(articles, "/articles")]));
  const marketInsights = group(
    insights,
    resources,
    column(t("properties"), [link(t("featuredProperties"), "/properties?featured=1"), link(t("projects"), "/projects")]),
  );

  function homes(rent: boolean): AudienceMenu {
    const intent = rent ? "RENT" : "SALE";
    const search = (label: string, filters: Record<string, string> = {}) =>
      link(
        label,
        "/properties?" + new URLSearchParams({ intent, ...(country ? { country } : {}), ...(city ? { city } : {}), ...filters }),
      );
    const home = t(rent ? "homesForRent" : "homesForSale");
    const searchTitle = city ? t("properties") + " · " + city : t("propertyTypes");
    const types = (values: readonly string[]) => values.map((value) => search(value, { type: propertyTypeKey(value) }));
    const picks = column(popular, [
      search(home),
      search(t("featuredProperties"), { featured: "1" }),
      search(t("propertyPosterOwner"), { postedBy: "OWNER" }),
      search(t("searchReady"), { construction: "READY_TO_MOVE" }),
      link(t("projects"), "/projects"),
    ]);
    const cities = column(
      t("cities"),
      marketplaceDestinations.map((d) => search(d.city, { city: d.city, country: d.country })),
    );
    return {
      label: rent ? tenants : buyers,
      feature: {
        title: insights,
        link: link(articles, "/articles"),
        links: [
          link(t("projects"), "/projects"),
          link(t("loanCalculator"), "/finance-services#emi-calculator"),
          search(t("featuredProperties"), { featured: "1" }),
        ],
      },
      categories: [
        group(
          home,
          column(
            searchTitle,
            types(propertyTypesByCategory.RESIDENTIAL.filter((v) => v !== "Paying Guest" && v !== "Co-living")),
          ),
          picks,
        ),
        rent
          ? group(shared, column(t("propertyTypes"), types(["Paying Guest", "Co-living"])), cities)
          : group(t("land"), column(t("propertyTypes"), types(propertyTypesByCategory.PLOT_LAND)), cities),
        group(t("commercial"), column(t("propertyTypes"), types(propertyTypesByCategory.COMMERCIAL)), picks),
        group(t("cities"), cities, picks),
        marketInsights,
        reading,
        services,
      ],
    };
  }
  const feature = { title: t("sellRent"), image: marketplaceArtwork.banner("dealers"), link: post };
  return [
    homes(false),
    homes(true),
    {
      label: owners,
      feature,
      categories: [
        group(ownerOffers, column(ownerOffers, [post, workspace, responses, billing])),
        marketInsights,
        reading,
        services,
      ],
    },
    {
      label: dealers,
      feature: { ...feature, image: marketplaceArtwork.banner("projects") },
      categories: [
        group(
          dealerOffers,
          column(t("properties"), [post, link(t("registerDealer"), "/dealers/register"), workspace, responses, billing]),
        ),
        group(
          t("projects"),
          column(t("projectPlanning"), [
            link(t("submitProject"), "/projects/new"),
            link(t("projects"), "/projects"),
            billing,
            responses,
          ]),
        ),
        group(research, resources, people),
        services,
        reading,
      ],
    },
  ];
}
