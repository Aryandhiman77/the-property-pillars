import {MaterialInput} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";
import Image from "next/image";
import {Accessibility, AirVent, AlarmSmoke, Bed, Bike, Blinds, BookOpen, Building2, Car, Check, ChevronDown, CloudRain, DoorOpen, Droplet, Dumbbell, Fan, Film, Flame, Fence, Footprints, Gamepad2, KeyRound, Lightbulb, Microwave, Package, PawPrint, Phone, PlugZap, Recycle, Refrigerator, Shield, Shirt, Sofa, Store, Sun, Table, Target, Trash2, Trees, Tv, Users, Video, WashingMachine, Waves, Wifi, Wrench} from "lucide-react";
import {instantDeliveryProviders, propertyAmenities, propertyAmenityGroups, propertyFurnishingItems} from "@the-property-pillar/contracts";
import {useState, type ComponentProps} from "react";
import styles from "./property-extras.module.css";

const furnitureIcons = {
  WARDROBE: Shirt, BED: Bed, SOFA: Sofa, AIR_CONDITIONER: AirVent,
  REFRIGERATOR: Refrigerator, WASHING_MACHINE: WashingMachine, GEYSER: Flame, TELEVISION: Tv, LIGHTS: Lightbulb,
  FANS: Fan, DINING_TABLE: Table, MICROWAVE: Microwave, CURTAINS: Blinds,
} as const;
const amenityIcons = {
  LIFT: Building2, SERVICE_LIFT: Building2, ACCESSIBLE_ENTRY: Accessibility, VISITOR_PARKING: Car, EV_CHARGING: PlugZap, BICYCLE_STORAGE: Bike,
  SECURITY: Shield, CCTV: Video, GATED_COMMUNITY: Fence, INTERCOM: Phone, CONTROLLED_ACCESS: KeyRound, FIRE_SAFETY: AlarmSmoke,
  FITNESS_CENTRE: Dumbbell, SWIMMING_POOL: Waves, CHILDRENS_POOL: Waves, GARDEN: Trees, PLAY_AREA: Footprints,
  CLUBHOUSE: Building2, SPORTS_COURT: Target, WALKING_TRACK: Footprints, INDOOR_GAMES: Gamepad2, YOGA_STUDIO: Sun,
  ROOFTOP_TERRACE: Sun, LIBRARY: BookOpen, SCREENING_ROOM: Film, WATER_SUPPLY: Droplet, WATER_STORAGE: Droplet,
  PIPED_GAS: Flame, HIGH_SPEED_INTERNET: Wifi, WASTE_COLLECTION: Trash2, RAINWATER_HARVESTING: CloudRain, WATER_RECYCLING: Recycle,
  SOLAR_POWER: Sun, COMMUNITY_HALL: Users, COWORKING: Table, MEETING_ROOM: Users, CONCIERGE: DoorOpen,
  MAINTENANCE: Wrench, PARCEL_ROOM: Package, SHARED_LAUNDRY: WashingMachine, DAYCARE: Users, ON_SITE_RETAIL: Store,
  PET_FRIENDLY: PawPrint, PET_AREA: PawPrint, OTHER: Package,
} satisfies Record<keyof typeof propertyAmenities, typeof Package>;
const catalogs = {furnishings: propertyFurnishingItems, delivery: instantDeliveryProviders, amenities: propertyAmenities};
type OptionType = keyof typeof catalogs;

function Options({type, values, other, options = Object.entries(catalogs[type]), onChange}: {
  type: OptionType; values: string[]; other?: string; options?: [string, string][]; onChange?: (values: string[]) => void;
}) {
  return <ul className={onChange ? styles.choiceList : styles.propertyItems}>
    {options.filter(([key]) => onChange || values.includes(key)).map(([key, label]) => {
      const Icon = (type === "amenities" ? amenityIcons[key as keyof typeof amenityIcons] : furnitureIcons[key as keyof typeof furnitureIcons]) ?? Package;
      const icon = type === "delivery" && key !== "OTHER"
        ? <Image src={`/images/delivery/${key.toLowerCase()}.webp`} alt="" width={24} height={24} />
        : <span className={styles.optionIcon}><Icon size={18} aria-hidden="true" /></span>;
      return <li key={key}>{onChange ? <label>
        <MaterialInput type="checkbox" checked={values.includes(key)} onChange={(event) => onChange(event.target.checked ? [...values, key] : values.filter((item) => item !== key))} />
        {icon}<span>{label}</span>
      </label> : <>{icon}<span>{key === "OTHER" && other ? other : label}</span></>}</li>;
    })}
  </ul>;
}

export function PropertyOptionPicker({type, values, onChange, available, ...summary}: Omit<ComponentProps<"summary">, "onChange"> & {
  type: OptionType; values: string[]; available?:[string,string][]; onChange: (values: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const labels:Record<string,string> = available?Object.fromEntries(available):catalogs[type];
  const selected = values.flatMap((value) => Object.hasOwn(labels, value) ? [labels[value as keyof typeof labels]] : []);
  const query = search.trim().toLowerCase();
  const groups = type === "amenities" ? Object.entries(propertyAmenityGroups).map(([group, entries]) => ({
    group, options: Object.keys(entries).filter(key=>Object.hasOwn(labels,key)&&labels[key].toLowerCase().includes(query)).map((key):[string,string]=>[key,labels[key]]),
  })).filter(({options}) => options.length) : [];
  const additions=available?.filter(([key,name])=>!Object.hasOwn(propertyAmenities,key)&&name.toLowerCase().includes(query));
  if(additions?.length)groups.push({group:"Additional amenities",options:additions});
  return <details className={styles.picker}>
    <summary {...summary}>
      <span>{selected.length ? selected.join(", ") : type === "amenities" ? "Select amenities" : "Select options"}</span><ChevronDown size={16} aria-hidden="true" />
    </summary>
    {type === "amenities" ? <div className={styles.amenityPicker}>
      <MaterialInput type="search" aria-label="Search amenities" placeholder="Search amenities" value={search}
        onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault();
        }} />
      <div className={styles.amenityGroups}>
        {groups.map(({group, options}) => <fieldset key={group}>
          <legend>{group}</legend>
          <Options type={type} values={values} options={options} onChange={onChange} />
        </fieldset>)}
        {!groups.length && <p>No matching amenities.</p>}
      </div>
    </div> : <Options type={type} values={values} onChange={onChange} />}
  </details>;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())) : [];
}

export function PropertyHighlights({values}: {values: unknown}) {
  const [expanded, setExpanded] = useState(false);
  const items = strings(values);
  const visible = expanded ? items : items.slice(0, 5);
  if (!items.length) return null;
  return <section className={styles.highlights} aria-label="Key highlights">
    <header><span className={styles.optionIcon}><Target size={24} aria-hidden="true" /></span><h2>Key highlights</h2></header>
    <ul>{visible.map((item, index) => <li key={index}><Check size={18} aria-hidden="true" />{item}</li>)}
      {items.length > 5 && <li><MuiButton type="button" className="market-text-link" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? "View fewer" : `View ${items.length - 5} more`}</MuiButton></li>}
    </ul>
  </section>;
}

export function PropertyExtras({data, sectionClassName}: {data: Record<string, unknown>; sectionClassName: string}) {
  const furnishings = strings(data.furnishingItems);
  const furnishing = data.furnishing === "FULLY_FURNISHED" ? "Fully furnished" : data.furnishing === "SEMI_FURNISHED" ? "Semi-furnished" : "";
  const selectedAmenities = strings(data.amenities);
  const amenities = selectedAmenities.filter((value) => value !== "OTHER");
  const custom = selectedAmenities.includes("OTHER") ? strings(data.customAmenities) : [];
  const apps = data.instantDeliveryAvailable === true && Array.isArray(data.instantDeliveryApps)
    ? data.instantDeliveryApps.filter((value): value is string => typeof value === "string") : [];
  return <>
    {furnishing && <section className={sectionClassName}><h2>Furnishing · {furnishing}</h2>{furnishings.length > 0 && <Options type="furnishings" values={furnishings} />}</section>}
    {(amenities.length > 0 || custom.length > 0) && <section className={sectionClassName}><h2>Amenities</h2>
      {amenities.length > 0 && <Options type="amenities" values={amenities} options={amenities.map(k=>[k,propertyAmenities[k as keyof typeof propertyAmenities]??k.replaceAll("_"," ").toLowerCase()])}/>}
      {custom.length > 0 && <ul className={styles.customChips} aria-label="Other amenities">{custom.map((item) => <li key={item}>{item}</li>)}</ul>}
    </section>}
    {apps.length > 0 && <section className={sectionClassName}>
      <h2>Instant delivery</h2>
      <Options type="delivery" values={apps} other={typeof data.instantDeliveryOther === "string" ? data.instantDeliveryOther : undefined} />
      <p className={styles.reported}>Reported by the lister</p>
    </section>}
  </>;
}
