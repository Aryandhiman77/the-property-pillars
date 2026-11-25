"use client";

import {useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type Ref} from "react";
import {propertyCompletion,propertySteps,propertySpecificationFields,appliesToProperty} from "@the-property-pillar/contracts";
import Link from "next/link";
import {AddressSearch} from "../profiles/editor";
import {PropertyAssets} from "../marketplace/property-assets";
import {PropertyMediaFields,NearbyEditor,PropertyPreview,PropertyVideos,PropertyCharges,PropertyAreaUnits,type Charge,type VideoTour,type GalleryMeta,type LocalPlace} from "./property-wizard";
import toast from "react-hot-toast";
import {useLocale, useTranslations} from "next-intl";
import {useSiteLocation} from "@/features/location/site-location";
import {ProductFields} from "@/features/materials/product-fields";
import {type SpecificationValue,materialCategories, materialOptionValue, materialUnits, normalizeContactPhone, propertyDetailLimits, propertyGalleryUrls, isUploadedVideoUrl, propertyTypeKey, type DeliveryCity} from "@the-property-pillar/contracts";
import {ClipboardCheck, LoaderCircle, Save, X} from "lucide-react";
import {usePincodeLookup} from "@/features/address/use-pincode-lookup";
import {MapFrame,MapPinInput, type MapPinValue} from "@/features/marketplace/property-map";
import {PropertyOptionPicker} from "@/features/marketplace/property-extras";
import {PhoneInput} from "@/components/ui/phone-input";
import {PlaceField} from "./place-field";
import {PropertyEditor} from "./property-editor";
import {FeaturePlacement} from "./feature-placement";
import {ChipListField, useChipList} from "./chip-list-field";
import {blockedListingWords, listingContexts, listingIssueMessages, type ListingIssue} from "@the-property-pillar/contracts";
import {removeFlaggedText} from "./remove-flagged-text";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {fieldAttributes, invalidControls, isFormControl, splitFieldErrors} from "@/lib/form-validation";
import {currencyForCountry, defaultListingCountry} from "@/config/listing-geography";

import type {CollectionDescriptor, WorkspaceItem} from "./types";
import type {UserRole} from "@/features/auth/types";
import {getPropertyTypeOptions} from "./collection-config";
import {LineItems, readLines} from "./line-items";
import {DeliveryCityPicker} from "./delivery-city-picker";
import {RecordDetails} from "./record-details";
import {ImageUpload} from "./image-upload";
import {useMediaDrafts} from "./media-drafts";
import {UploadProgress} from "./upload-progress";
import {ResumeUpload, isResumePath} from "@/features/marketplace/resume-upload";
import {isImmutableRecordReference, isRecordReference, RecordReference} from "./record-reference";
import styles from "./dashboard.module.css";

const propertySubmissionFields: Record<string, string> = {
  listingIntent: "Choose sale or rent.", propertyCategory: "Choose a property category.",
  propertyType: "Choose a property type.", currency: "Select the price currency.",
  areaUnit: "Choose a unit for the property size.", city: "Choose a city.",
  price: "Enter a price greater than zero.", areaValue: "Enter a property size greater than zero.",
  consentAccepted: "Confirm the listing details before submitting.",
};

const basePropertyFields = [["listingIntent"],["propertyCategory","propertyType","propertyTypeOther"],["countryCode","postalCode","state","city","locality","addressLine","mapLocation"],["projectOrSociety","constructionStatus","reraApplicable","reraNumber"],["areaValue","areaUnit","bedrooms","halls","bathrooms","balconies","floorNumber","totalFloors","facing"],["kitchenType","furnishing","furnishingItems"],["parking","powerBackup"],["amenities","customAmenities","instantDeliveryAvailable","instantDeliveryApps","instantDeliveryOther"],["price","currency"],["mediaUrls"],[],[],[],[],["highlights","aboutPropertyHtml"],["contactPhone"],[],["consentAccepted"]];
const propertySections: [string,string[]][] = propertySteps.map((label,i)=>[label,[...basePropertyFields[i],...Object.keys(propertySpecificationFields).filter(k=>propertySpecificationFields[k][0]===label)]]);

const fieldLabels: Partial<Record<string, string>> = {
  countryCode: "country", city: "city", state: "stateRegion", locality: "areaLocality", localityName: "areaLocality",
  postalCode: "postalCode", addressLine: "address", officeAddress: "address", deliveryAddress: "address",
  fullName: "fullName", phone: "phoneNumber", contactPhone: "phoneNumber", email: "email", currency: "currency",
  category: "category", propertyCategory: "category", listingIntent: "listingType",
  propertyType: "propertyType", propertyTypeOther: "propertyTypeOther", price: "price", startingPrice: "price",
  indicativePrice: "price", bedrooms: "bedrooms", bathrooms: "bathrooms", mediaUrls: "photos", loanAmount: "loanAmount",
  employerName: "employerName", jobType: "jobType", employmentType: "employmentType", applicationDeadline: "applicationDeadline",
  trade: "trade", dailyRate: "dailyRate", cityId: "deliveryCity", deliveryCityIds: "deliveryCity",
  unit: "unit", quantity: "quantity", availabilityStatus: "availability"
};

export type WorkspaceMutation = {
  savedPropertyId?: string;
  expectedUpdatedAt?:string;
  requestId?: string;
  title?: string;
  description?: string | null;
  status?: string;
  reviewNote?: string;
  manualReview?: {attemptId: string; confirmed: true};
  data?: Record<string, unknown>;
};

type WorkspaceFormProps = {
  descriptor: CollectionDescriptor;
  item?: WorkspaceItem | null;
  posterRole?: UserRole;
  allowLockedPrivacyControl?: boolean;
  onClose: () => void;
  onSave: (payload: WorkspaceMutation) => Promise<void | false>;
  publicTask?: {
    resumedProperty?:WorkspaceItem;
    action: string;
    initial?: WorkspaceMutation;
    submitStatus?: string;
    allowDraft?: boolean;
    canSubmit: boolean;
    requestAccess: () => void;
    draftRef: Ref<WorkspaceMutation>;
    contactDefaults?: {fullName: string; phone: string};
  };
};

const multilineLists = new Set(["responsibilities", "qualifications", "benefits"]);
const postalLocationKeys = ["state", "city", "locality"];
const parseOptionValues = (value: unknown) => typeof value === "string" ? value.split(",").map((entry) => entry.trim()).filter(Boolean) : [];

function isChipList(key: string): key is "highlights" | "customAmenities" {
  return key === "highlights" || key === "customAmenities";
}

function initialFieldValue(item: {data?: Record<string, unknown>} | null | undefined, key: string, type?: string) {
  const value = item?.data?.[key];
  if (key === "instantDeliveryAvailable" && typeof value === "boolean") return value ? "YES" : "NO";
  if (item && type === "select" && typeof value === "string") {
    if (key === "category") return materialOptionValue(materialCategories, value) ?? value;
    if (key === "unit") return materialOptionValue(materialUnits, value) ?? value;
  }
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string").join(
      multilineLists.has(key) ? "\n" : ", ",
    );
  }
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    if (type === "datetime" && typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }
    }
    return value;
  }
  return "";
}

export function WorkspaceForm({descriptor: configured, item:originalItem, posterRole, allowLockedPrivacyControl = false, onClose, onSave, publicTask}: WorkspaceFormProps) {
  const [savedDraft,setSavedDraft]=useState<WorkspaceItem | undefined>(publicTask?.resumedProperty);
  const item=savedDraft??originalItem;
  const locale = useLocale();
  const t = useTranslations("Site");
  const {countryOptions} = useSiteLocation();
  const initial = item ?? publicTask?.initial;
  const projectEnquiry = configured.key === "propertyInquiries" && (Object.hasOwn(initial?.data ?? {}, "projectId") || configured.fields.some(({key}) => key === "projectId"));
  const descriptor = projectEnquiry ? {...configured, fields: configured.fields.map((field) => field.key === "propertyId" ? {...field, key: "projectId", label: "Builder project"} : field.key==="inquiryType" ? {...field,options:[...(field.options??[]),...["PROJECT","CONFIGURATION","BROCHURE"].map(value=>({value,label:value.toLowerCase()}))]} : field)} : configured;
  const propertyAddress = descriptor.key === "properties";
  const jobAddress = descriptor.key === "jobs";
  const materialRfq = descriptor.key === "materialRfqs";
  const materialProduct = descriptor.key === "materialProducts";
  const [productSpecs,setProductSpecs]=useState<Record<string,SpecificationValue>>((initial?.data?.specifications ?? {}) as Record<string,SpecificationValue>);
  const internationalAddress = descriptor.fields.some(({key}) => key === "countryCode");
  const regionalRegistration = propertyAddress || descriptor.key === "dealerProfiles";
  const useCatalog = propertyAddress || jobAddress || descriptor.key === "dealerProfiles";
  const propertyCreate = propertyAddress && !originalItem;
  const [step,setStep]=useState(Math.max(1,Math.min(18,Number(initial?.data?.wizardStep)||1)));
  const [canonical,setCanonical]=useState<Record<string,string>>((initial?.data?.canonicalLocation??{}) as Record<string,string>);
  const [galleryMeta,setGalleryMeta]=useState<GalleryMeta[]>((initial?.data?.galleryDetails??[]) as GalleryMeta[]);
  const [places,setPlaces]=useState<LocalPlace[]>((initial?.data?.localPlaces??[]) as LocalPlace[]);
  const [charges,setCharges]=useState<Charge[]>((initial?.data?.additionalCharges??[]) as Charge[]);
  const [videos,setVideos]=useState<VideoTour[]>((initial?.data?.videoTours??[]) as VideoTour[]);
  const [measurementUnits,setMeasurementUnits]=useState<Record<string,string>>((initial?.data?.areaUnits??{}) as Record<string,string>);
  const dirty=useRef(false);
  useEffect(()=>{if(!propertyAddress)return;const before=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue=""}};window.addEventListener("beforeunload",before);return()=>window.removeEventListener("beforeunload",before)},[propertyAddress]);
  const closeEditor=()=>{if(!propertyAddress||!dirty.current||window.confirm("Discard unsaved property changes?"))onClose()};
  const postRequest = useRef("");
  const upgradeDialog = useRef<HTMLDialogElement>(null);
  const initialCountry = internationalAddress ? String(initial?.data?.countryCode ?? (item ? defaultListingCountry : "")) : "";
  const initialLookupPin = (!internationalAddress || initialCountry === defaultListingCountry) ? String(initial?.data?.postalCode ?? "") : "";
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState(item?.status ?? descriptor.statuses[0] ?? "DRAFT");
  const highlights = useChipList(initial?.data?.highlights, {
    item: "highlight", limit: propertyDetailLimits.highlights, maxLength: propertyDetailLimits.highlightLength,
  });
  const customAmenities = useChipList(initial?.data?.customAmenities, {
    item: "amenity", limit: propertyDetailLimits.customAmenities, maxLength: propertyDetailLimits.customAmenityLength,
  });
  const [fieldValues, setFieldValues] = useState<Record<string, string | number | boolean>>(() =>
    Object.fromEntries(descriptor.fields.filter(({key}) => !isChipList(key)).map((field) => [field.key, field.key === "addressVisibility" && !initial ? "LOCALITY_ONLY" : field.key === "countryCode" ? initialCountry
      : field.type === "media" ? propertyGalleryUrls(initial?.data ?? {}).join(", ") : initialFieldValue(initial, field.key, field.type)])),
  );
  const contactName = publicTask?.contactDefaults?.fullName;
  const contactPhone = publicTask?.contactDefaults?.phone;
  useEffect(() => {
    if (!contactName && !contactPhone) return;
    setFieldValues((current) => ({
      ...current,
      ...(!current.fullName && contactName ? {fullName: contactName} : {}),
      ...(!current.phone && contactPhone ? {phone: contactPhone} : {}),
    }));
  }, [contactName, contactPhone]);
  const [saving, setSaving] = useState(false);
  const media = useMediaDrafts();
  const [activeUploads, setActiveUploads] = useState<string[]>([]);
  const uploading = activeUploads.length > 0;
  const [error, setError] = useState<string | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const publishJob = jobAddress && posterRole === "ADMIN" && item && status === "PUBLISHED";
  const [invalidFields, setInvalidFields] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const savingRef = useRef(false);
  const focusInvalid = useRef(false);
  const [lines, setLines] = useState(() => readLines(initial?.data?.items));
  const [deliveryCities, setDeliveryCities] = useState<DeliveryCity[]>(() => Array.isArray(initial?.data?.deliveryCityOptions) ? initial.data.deliveryCityOptions as DeliveryCity[] : []);
  const [changedDeliveryCities, setChangedDeliveryCities] = useState(!item && deliveryCities.length > 0);
  const [lookupPincode, setLookupPincode] = useState(initialLookupPin);
  const [catalogCityId, setCatalogCityId] = useState(() => String(initial?.data?.placeCityId ?? ""));
  const [mapPin, setMapPin] = useState<MapPinValue | null>(() => initial?.data?.mapLocation && typeof initial.data.mapLocation === "object" ? initial.data.mapLocation as MapPinValue : null);
  const postalRequest = useRef({
    pincode: initialLookupPin,
    edited: new Set(initialLookupPin ? postalLocationKeys.filter((key) => initial?.data?.[key]) : []),
  });
  const autoFilled = useRef<{city?: string; state?: string; locality?: string}>({});
  const postalStatusId = useId();
  const cityOptionsId = useId();
  const areaOptionsId = useId();
  const fieldErrorId = useId();
  const canEdit = !item || item.canEditContent === true;
  const loadPropertyCatalog=propertyAddress&&canEdit&&(!publicTask||publicTask.canSubmit);
  const [catalog,setCatalog]=useState<Record<string,{id:string;name:string;code:string;parentId:string|null}[]>|null>(null);
  const [catalogError,setCatalogError]=useState("");
  const [catalogAttempt,retryCatalog]=useState(0);
  useEffect(()=>{
    if(!loadPropertyCatalog)return;
    const abort=new AbortController();
    type Choice={id:string;name:string;code:string;parentId:string|null};
    async function options(kind:string):Promise<[string,Choice[]]>{
      let cursor:string|null=null;
      const choices:Choice[]=[];
      do{const params=new URLSearchParams({kind,...(cursor?{cursor}:{})});
        const result:{items:Choice[];next:string|null}=await apiRequest("/profiles/masters?"+params,{signal:abort.signal});choices.push(...result.items);cursor=result.next;
      }while(cursor);
      return [kind,choices];
    }
    setCatalogError("");
    Promise.all(["PROPERTY_CATEGORY","PROPERTY_TYPE","AMENITY","AREA_UNIT"].map(options)).then(results=>{if(!abort.signal.aborted)setCatalog(Object.fromEntries(results))}).catch(()=>{if(!abort.signal.aborted)setCatalogError("Property choices could not be loaded.")});return()=>abort.abort();
  },[loadPropertyCatalog,catalogAttempt]);
  const hasPostalAddress = descriptor.fields.some(({type}) => type === "postal-code");
  const country = String(fieldValues.countryCode ?? "");
  const indianListing = internationalAddress && country === defaultListingCountry;
  const requiresIndianPin = indianListing && (propertyAddress || jobAddress);
  const usesPinLookup = !useCatalog && (!internationalAddress || indianListing);
  const lookup = usePincodeLookup(canEdit && usesPinLookup ? lookupPincode : "", {
    manualAddress: !propertyAddress && !jobAddress,
    onResolved(location) {
      const request = postalRequest.current;
      if (request.pincode !== location.pincode) return;
      const values = {
        ...(!materialRfq && !request.edited.has("state") ? {state: location.state} : {}),
        ...(!materialRfq && !request.edited.has("city") ? {city: location.city} : {}),
        ...(!request.edited.has("locality") && location.area ? {locality: location.area} : {}),
      };
      autoFilled.current = values;
      setFieldValues((current) => current.postalCode === location.pincode ? {...current, ...values} : current);
      setInvalidFields((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== "postalCode" && !Object.hasOwn(values, key))));
    },
  });
  const hasLines = descriptor.key === "materialRfqs" || descriptor.key === "materialQuotes";
  const isQuote = descriptor.key === "materialQuotes";
  const isProperty = descriptor.key === "properties";
  const posterLabel = posterRole === "DEALER" ? "propertyPosterDealer" : posterRole === "BUILDER" ? "propertyPosterBuilder" : posterRole === "OWNER" || posterRole === "BUYER" ? "propertyPosterOwner" : null;
  const requiresBedrooms = isProperty && fieldValues.propertyCategory === "RESIDENTIAL";
  const requiresConstruction = isProperty && Boolean(fieldValues.propertyCategory) && fieldValues.propertyCategory !== "PLOT_LAND";
  const isOtherPropertyType = isProperty && propertyTypeKey(String(fieldValues.propertyType ?? "")) === "OTHER";
  const privacyKey = "publicContactConsent";
  const canControlLockedPrivacy = Boolean(item && !canEdit && allowLockedPrivacyControl && ["dealerProfiles", "serviceProfiles", "workerProfiles"].includes(descriptor.key));
  const privacyValue = fieldValues[privacyKey] === true;
  const privacyChanged = canControlLockedPrivacy && privacyValue !== (item?.data[privacyKey] === true);
  const publishedGallery = isProperty && item?.status === "PUBLISHED" && allowLockedPrivacyControl
    ? propertyGalleryUrls(item.data) : [];
  const galleryOrder = String(fieldValues.mediaUrls ?? "");
  const galleryOrderChanged = galleryOrder !== publishedGallery.join(", ");
  const galleryEntries = galleryOrder ? galleryOrder.split(", ") : [];
  const canSaveLiveGallery = publishedGallery.length > 0 && galleryEntries.length > 0 &&
    galleryEntries.every((entry) => publishedGallery.includes(entry));
  const requiresReviewOnSave = isProperty && canEdit && item !== undefined &&
    (item?.status === "PUBLISHED" || item?.status === "APPROVED") && status === item.status;
  const hasCustomAmenities = parseOptionValues(fieldValues.amenities).includes("OTHER");
  const savedHighlights = highlights.withPending;
  const savedAmenities = customAmenities.withPending;

  useImperativeHandle(publicTask?.draftRef, () => ({
    title,
    description,
    data: {
      ...Object.fromEntries(configured.fields
        .filter(({type}) => !["image", "images", "media", "resume", "video", "map"].includes(type))
        .map(({key}) => [key, fieldValues[key]])),
      ...(propertyAddress ? {highlights: savedHighlights, customAmenities: savedAmenities} : {}),
      ...(projectEnquiry ? {projectId: fieldValues.projectId} : {}),
      items: lines,
      deliveryCityOptions: deliveryCities,
      ...(useCatalog && catalogCityId ? {placeCityId: catalogCityId} : {}),
      ...(propertyAddress && mapPin ? {mapLocation: mapPin} : {}),
    },
  }), [title, description, fieldValues, savedHighlights, savedAmenities, lines, deliveryCities, configured.fields, projectEnquiry, catalogCityId, useCatalog, propertyAddress, mapPin]);

  const heading = item ? (canEdit ? `Edit ${descriptor.singular}` : `Review ${descriptor.singular}`) : descriptor.createLabel;
  const subtitle = useMemo(
    () => item ? `Update ${item.title} without losing its activity history.` : descriptor.description,
    [descriptor.description, item],
  );

  useEffect(() => {
    if (!focusInvalid.current) return;
    focusInvalid.current = false;
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')
      ?? formRef.current?.querySelector<HTMLElement>('small[role="alert"]');
    field?.focus({preventScroll: true});
    field?.scrollIntoView({block: "center"});
  }, [invalidFields]);

  function fieldProps(name: string, helpId?: string) {
    return fieldAttributes(fieldErrorId, name, invalidFields[name], helpId);
  }

  function fieldError(name: string) {
    return invalidFields[name] ? <small className={styles.fieldError} id={`${fieldErrorId}-${name}`} role="alert">{invalidFields[name]}</small> : null;
  }

  function clearFieldError(name: string) {
    setInvalidFields((current) => {
      if (!Object.hasOwn(current, name)) return current;
      const next = {...current};
      delete next[name];
      return next;
    });
  }

  function includeField(key: string) {
    if(materialProduct && key==="maxPrice")return fieldValues.pricingType==="RANGE";
    if(materialProduct && key==="indicativePrice")return fieldValues.pricingType!=="ON_REQUEST";
    if(propertyAddress && propertySpecificationFields[key] && !appliesToProperty(propertySpecificationFields[key][3],fieldValues))return false;
    if(propertyAddress && fieldValues.propertyCategory==="PLOT_LAND" && ["bedrooms","bathrooms","halls","balconies","kitchenType","furnishing","furnishingItems","floorNumber","constructionStatus","interiorCondition","flooring"].includes(key))return false;
    if(propertyAddress && fieldValues.priceMode==="ON_REQUEST" && key==="price")return false;
    if(propertyAddress && key==="reraNumber" && fieldValues.reraApplicable!=="YES" && !initial?.data?.reraNumber)return false;
    if (key === "propertyTypeOther") return isOtherPropertyType;
    if (key === "furnishingItems") return ["FULLY_FURNISHED", "SEMI_FURNISHED"].includes(String(fieldValues.furnishing));
    if (key === "customAmenities") return hasCustomAmenities;
    if (key === "instantDeliveryAvailable") return indianListing;
    if (key === "instantDeliveryApps") return indianListing && fieldValues.instantDeliveryAvailable === "YES";
    if (key === "instantDeliveryOther") return indianListing && fieldValues.instantDeliveryAvailable === "YES" && parseOptionValues(fieldValues.instantDeliveryApps).includes("OTHER");
    return !regionalRegistration || indianListing || (key !== "reraApplicable" && key !== "reraNumber");
  }

  const progress=propertyCompletion(title,description,{...fieldValues,mediaUrls:galleryEntries});
  const completion=progress.percentage;
  useEffect(()=>{if(!propertyAddress)return;const key=Object.keys(invalidFields)[0];if(!key)return;const i=key==="title"?0:key==="description"?14:propertySections.findIndex(([,keys])=>keys.includes(key));if(i>=0)setStep(i+1)},[invalidFields,propertyAddress]);

  function showSaveError(saveError: unknown, fieldNames: Set<string>) {
    if (publishJob && saveError instanceof ApiClientError && saveError.code === "JOB_MANUAL_REVIEW_REQUIRED" && saveError.reviewAttemptId) {
      setReviewAttempt(saveError.reviewAttemptId);
      setReviewing(false);
      setConfirmed(false);
      setError(saveError.message);
      return;
    }
    setReviewAttempt("");
    if (canEdit && saveError instanceof ApiClientError && saveError.listingIssues.length) {
      applyContentIssues(saveError.listingIssues);
      return;
    }
    if (saveError instanceof ApiClientError && Object.keys(saveError.fieldErrors).length) {
      if(isProperty){for(const f of descriptor.fields)fieldNames.add(f.key);fieldNames.add("title");fieldNames.add("description");}
      if (hasLines) fieldNames.add("items");
      if (!canEdit) for (const field of descriptor.fields) fieldNames.add(field.key);
      if(materialProduct)for(const k of Object.keys(saveError.fieldErrors))if(k.startsWith("specifications.")||descriptor.fields.some(f=>f.key===k))fieldNames.add(k);
      const {fields, general} = splitFieldErrors(saveError.fieldErrors, fieldNames, materialRfq ? {city: "cityId"} : {});
      focusInvalid.current = true;
      setInvalidFields(fields);
      if (general) setError(general);
      return;
    }
    setError(saveError instanceof Error ? saveError.message : "The record could not be saved.");
  }

  function applyContentIssues(issues: ListingIssue[]) {
    const messages: Record<string, string> = {};
    for (const field of new Set(issues.map(issue => issue.field))) {
      const flagged = issues.filter(issue => issue.field === field);
      const excerpts = flagged.flatMap(issue => issue.excerpt ? [issue.excerpt] : []);
      const clean = (text: string) => removeFlaggedText(text, excerpts, field.endsWith("Html"));
      messages[field] = [...new Set(flagged.map(issue => listingIssueMessages[issue.reason]))].join(" ");
      const rejected = new Set(flagged.flatMap(issue => issue.mediaUrl ? [issue.mediaUrl] : []));
      if (rejected.size) {
        const selected = String(fieldValues[field] ?? "").split(", ").filter(Boolean);
        const removed = selected.filter(url => rejected.has(media.uploadedUrl(url)));
        updateField(field, selected.filter(url => !removed.includes(url)).join(", "));
        removed.forEach(media.discard);
        if (removed.length) messages[field] = `Removed ${removed.length} flagged ${removed.length === 1 ? "file" : "files"}. ${messages[field]}`;
      } else if (field === "title") setTitle(clean);
      else if (field === "description") setDescription(clean);
      else if (field === "highlights" || field === "customAmenities") {
        const list = field === "highlights" ? highlights : customAmenities;
        list.setItems(current => current.map(clean).filter(Boolean));
        list.setEntry(clean);
      } else if (typeof fieldValues[field] === "string") {
        updateField(field, clean(String(fieldValues[field])));
      }
    }
    focusInvalid.current = true;
    setInvalidFields(messages);
    setError("Content was flagged. Review the highlighted fields and submit again.");
  }

  function setPostalCode(input: string) {
    const pincode = input.replace(/\D/g, "").slice(0, 6);
    if (pincode === fieldValues.postalCode) return;
    const previous = autoFilled.current;
    autoFilled.current = {};
    const replacingPin = propertyAddress || String(fieldValues.postalCode).length === 6;
    postalRequest.current = {pincode, edited: new Set()};
    setLookupPincode(pincode);
    setFieldValues((current) => ({
      ...current,
      postalCode: pincode,
      ...(replacingPin || (previous.city && current.city === previous.city) ? {city: ""} : {}),
      ...(replacingPin || (previous.state && current.state === previous.state) ? {state: ""} : {}),
      ...(replacingPin || (previous.locality && current.locality === previous.locality) ? {locality: ""} : {}),
    }));
  }

  function updateField(key: string, value: string | number | boolean) {
    dirty.current=true;if(["city","state","locality","countryCode"].includes(key))setCanonical({});
    if (hasPostalAddress && (key === "city" || key === "state" || key === "locality")) {
      postalRequest.current.edited.add(key);
      delete autoFilled.current[key];
    }
    const categoryChanged = propertyAddress && key === "propertyCategory";
    if (categoryChanged) clearFieldError("propertyType");
    const typeChanged = propertyAddress && key === "propertyType";
    if (categoryChanged || typeChanged) clearFieldError("propertyTypeOther");
    setFieldValues((current) => ({
      ...current,
      [key]: value,
      ...(categoryChanged ? {propertyType: ""} : {}),
      ...(categoryChanged || typeChanged ? {propertyTypeOther: ""} : {}),
      ...(key === "furnishing" && value === "UNFURNISHED" ? {furnishingItems: ""} : {}),
      ...(key === "instantDeliveryAvailable" && value !== "YES" ? {instantDeliveryApps: "", instantDeliveryOther: ""} : {}),
    }));
  }

  function selectCountry(next: string) {
    setCanonical({});
    setCatalogCityId("");
    autoFilled.current = {};
    postalRequest.current = {pincode: "", edited: new Set()};
    setLookupPincode("");
    if (materialRfq) {
      setDeliveryCities([]);
      setChangedDeliveryCities(true);
      clearFieldError("cityId");
    }
    setFieldValues((current) => ({
      ...current,
      countryCode: next,
      postalCode: "",
      state: "",
      city: "",
      locality: "",
      currency: currencyForCountry(next) || current.currency,
      ...(propertyAddress && next !== defaultListingCountry ? {instantDeliveryAvailable: "", instantDeliveryApps: "", instantDeliveryOther: ""} : {}),
    }));
    setInvalidFields((current) => Object.fromEntries(Object.entries(current).filter(([key]) =>
      key !== "postalCode" && key !== "currency" && !postalLocationKeys.includes(key),
    )));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || uploading) return;
    if (canEdit && Object.hasOwn(listingContexts, descriptor.key)) {
      const values = {...fieldValues, title, description, highlights: savedHighlights.join("\n"), customAmenities: savedAmenities.join("\n")};
      const issues = Object.entries(values).flatMap(([field, value]) =>
        typeof value === "string" ? blockedListingWords(field, value) : []);
      if (issues.length) {applyContentIssues(issues); return;}
    }
    const chipErrors: Record<string, string> = {};
    if (canEdit && isProperty) {
      if (fieldValues.totalFloors !== "" && fieldValues.totalFloors != null && Number(fieldValues.floorNumber) > Number(fieldValues.totalFloors)) {
        chipErrors.floorNumber = "Property floor must be within the total floors in this building.";
      }
      if (highlights.pendingError) chipErrors.highlights = highlights.pendingError;
      if (hasCustomAmenities && customAmenities.pendingError) chipErrors.customAmenities = customAmenities.pendingError;
    }
    if (publicTask && !publicTask.canSubmit) {
      if (Object.keys(chipErrors).length) {
        focusInvalid.current = true;
        setInvalidFields((current) => ({...current, ...chipErrors}));
        return;
      }
      publicTask.requestAccess();
      return;
    }
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const manual = submitter instanceof HTMLButtonElement && submitter.value === "manual-review";
    if (manual && !(publishJob && reviewAttempt && reviewing && confirmed)) return;
    const advance = submitter instanceof HTMLButtonElement && submitter.value==="continue";
    const draft = advance || submitter instanceof HTMLButtonElement && submitter.value === "draft";
    const submitForReview = propertyCreate && !draft;
    const propertyDraft = propertyAddress && (draft || (!propertyCreate && status==="DRAFT"));
    setError(null);
    setInvalidFields({});
    const fields = Array.from(event.currentTarget.elements).filter(isFormControl).filter((field) => field.name);
    const fieldNames = new Set(fields.map(({name}) => name));
    if(isProperty)for(const key of ["title","description",...descriptor.fields.map(f=>f.key)])fieldNames.add(key);
    for (const field of descriptor.fields) if (field.type === "property-options" && includeField(field.key)) fieldNames.add(field.key);
    const errors = {...(propertyDraft?{}:invalidControls(event.currentTarget)), ...chipErrors};
    if(!propertyDraft&&isProperty && fieldValues.listingIntent && fieldValues.listingIntent!=="SALE"&&!fieldValues.priceFrequency)errors.priceFrequency="Select a payment frequency.";
    if(!propertyDraft&&isProperty&&fieldValues.constructionStatus==="UNDER_CONSTRUCTION"&&!fieldValues.possessionDate)errors.possessionDate="Enter expected possession.";
    if (canEdit && hasCustomAmenities && !savedAmenities.length) {
      errors.customAmenities ??= "Enter at least one other amenity.";
    }
    if (canEdit && isProperty && includeField("instantDeliveryApps") && !parseOptionValues(fieldValues.instantDeliveryApps).length) {
      errors.instantDeliveryApps = "Select an instant delivery app.";
    }
    if (canEdit) {
      for (const field of fields) {
        if (field instanceof HTMLInputElement && field.type === "tel" && field.value.trim() && !normalizeContactPhone(field.value)) {
          errors[field.name] = "Enter a contact number with 7 to 15 digits.";
        }
      }
    }
    if (propertyDraft && !country) delete errors.countryCode;
    if (propertyDraft && !fieldValues.postalCode) delete errors.postalCode;
    if (canEdit && title.trim().length < 2) errors.title = "Enter a record title with at least 2 characters.";
    if (canEdit && isOtherPropertyType && !String(fieldValues.propertyTypeOther ?? "").trim()) {
      errors.propertyTypeOther = "Specify the property type.";
    }
    if (canEdit && isProperty && (submitForReview || requiresReviewOnSave || status === "PENDING_REVIEW")) {
      if (description.trim().length < 50) errors.description = "Describe this property in at least 50 characters.";
      for (const [key, message] of Object.entries(propertySubmissionFields)) {
        if(key==="price" && fieldValues.priceMode==="ON_REQUEST")continue;
        if (!fieldValues[key] || (["price", "areaValue"].includes(key) && Number(fieldValues[key]) <= 0)) errors[key] = message;
      }
      if (indianListing && !fieldValues.locality) errors.locality = "Choose the area.";
      if (indianListing && !fieldValues.reraApplicable) errors.reraApplicable = "Select whether RERA applies.";
      if (indianListing && fieldValues.reraApplicable === "YES" && !fieldValues.reraNumber) errors.reraNumber = "Enter the RERA registration number.";
    }
    if (canEdit && (submitForReview || requiresReviewOnSave || status === "PENDING_REVIEW")) {
      if (requiresBedrooms && fieldValues.bedrooms === "") errors.bedrooms = "Enter the number of bedrooms. Use 0 for a studio.";
      if (requiresConstruction && !fieldValues.constructionStatus) errors.constructionStatus = "Select a construction status.";
      if (isProperty && !galleryEntries.length) errors.mediaUrls = "Add at least one photo or video.";
    }
    if (canEdit && !propertyDraft && requiresIndianPin && !fieldValues.postalCode) errors.postalCode = "Enter the Indian PIN code.";
    if (canEdit && descriptor.key === "jobApplications" && !isResumePath(fieldValues.resumeUrl)) errors.resumeUrl = "Upload your résumé before submitting.";
    if (canEdit && useCatalog && !propertyDraft && (propertyAddress || jobAddress)) {
      if (!fieldValues.state && indianListing) errors.state = "Choose the state or region.";
      if (!fieldValues.city) errors.city = "Choose the city.";
    }
    if (Object.keys(errors).length) {
      focusInvalid.current = true;
      setInvalidFields(errors);
      return;
    }

    if (!canEdit) {
      const statusChanged = Boolean(item && status !== item.status);
      if (!item || (!statusChanged && !privacyChanged)) return;
      savingRef.current = true;
      setSaving(true);
      try {
        await onSave({
          ...(statusChanged ? {status} : {}),
          ...(privacyChanged ? {data: {[privacyKey]: privacyValue}} : {}),
        });
        onClose();
      } catch (saveError) {
        showSaveError(saveError, fieldNames);
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
      return;
    }

    const data: Record<string, unknown> = Object.fromEntries(
      descriptor.fields
        .filter(({key, type}) => includeField(key) && type !== "map")
        .map((field) => {
          if (field.key === "highlights") return [field.key, savedHighlights];
          if (field.key === "customAmenities") return [field.key, savedAmenities];
          const stored = item?.data[field.key];
          const raw = fieldValues[field.key];
          const value = typeof raw === "string" ? raw.trim() : raw;
          if (field.type === "delivery-cities") return [field.key, changedDeliveryCities ? deliveryCities.map(({id}) => id) : ""];
          if (field.type === "delivery-city") return [field.key, changedDeliveryCities ? deliveryCities[0]?.id ?? null : ""];
          if (field.key === "propertyTypeOther") return [field.key, String(value ?? "").trim()];
          if (field.key === "instantDeliveryAvailable") return [field.key, value === "" ? stored == null ? "" : null : value === "YES"];
          if (field.type === "property-options") return [field.key, parseOptionValues(value)];
          if (field.type === "images" && typeof value === "string") {
            return [field.key, value ? value.split(", ") : (item?.data[field.key] ? [] : "")];
          }
          if (field.type === "media") return [field.key, value ? String(value).split(", ") : []];
          if (value === "" && stored != null && !["countryCode", "cityId", "deliveryCityIds"].includes(field.key)) return [field.key, null];
          if (field.type === "number" && value !== "") return [field.key, Number(value)];
          if (field.type === "list" && typeof value === "string") {
            if (!value) return [field.key, Array.isArray(item?.data[field.key]) ? [] : ""];
            return [field.key, value.split(multilineLists.has(field.key) ? "\n" : ",").map((entry) => entry.trim()).filter(Boolean)];
          }
          if (field.type === "toggle") return [field.key, value === true];
          if (field.type === "datetime" && typeof value === "string" && value) return [field.key, new Date(value).toISOString()];
          return [field.key, value];
        })
        .filter(([, value]) => value !== ""),
    );
    if(materialProduct){data.specifications=productSpecs;for(const key of ["maxPrice","indicativePrice"])if(!includeField(key)&&item?.data[key]!=null)data[key]=null;}
    if (isProperty && item?.data.videoUrl) data.videoUrl = null;
    if (useCatalog && (catalogCityId || item?.data.placeCityId)) data.placeCityId = catalogCityId || null;
    if(isProperty){data.wizardStep=advance?Math.min(18,step+1):step;data.canonicalLocation=Object.keys(canonical).length?canonical:null;data.galleryDetails=galleryMeta.filter(m=>galleryEntries.includes(m.url));data.localPlaces=places;data.additionalCharges=charges;data.videoTours=videos.map(v=>v.thumbnail&&!galleryEntries.includes(v.thumbnail)?{...v,thumbnail:undefined}:v);data.areaUnits=Object.fromEntries(Object.entries(measurementUnits).filter(([key])=>includeField(key)&&fieldValues[key]!==""));
      for(const field of descriptor.fields)if(!includeField(field.key) && item?.data[field.key]!=null)data[field.key]=null;
      if(!item && !Object.keys(canonical).length)delete data.canonicalLocation;
    }
    if (propertyAddress && (mapPin || item?.data.mapLocation)) data.mapLocation = mapPin;
    if (materialRfq && changedDeliveryCities && !deliveryCities.length) data.city = "";
    if (hasLines && (lines.length || Array.isArray(item?.data.items))) {
      data.items = lines.length ? lines.map(({itemName, category, specification, quantity, unit, unitPrice,taxRate,discount,preferredBrand,notes}) => ({
        itemName, specification: specification || undefined, quantity: Number(quantity), unit,
        ...(isQuote ? {unitPrice: Number(unitPrice),taxRate:taxRate?Number(taxRate):undefined,discount:discount?Number(discount):undefined} : {category,preferredBrand:preferredBrand||undefined,notes:notes||undefined}),
      })) : null;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      if (isProperty && !draft && (!item || (item.status === "DRAFT" && status === "PENDING_REVIEW"))) {
        const {balance} = await apiRequest<{balance:{remaining:number}}>("/catalog/plans");
        if (!balance.remaining) {upgradeDialog.current?.showModal();return;}
      }
      if (propertyCreate && !postRequest.current) postRequest.current = crypto.randomUUID();
      const result = await media.save<WorkspaceMutation, void | false>({
        ...(propertyCreate ? {requestId:postRequest.current} : {}),
        ...(manual ? {manualReview: {attemptId: reviewAttempt, confirmed: true as const}} : {}),
        ...(isProperty && item?{expectedUpdatedAt:item.updatedAt}:{}),
        title: title.trim(),
        description: description.trim() || (item ? null : undefined),
        status: isProperty&&draft?(item?"DRAFT":undefined):isProperty&&propertyCreate?"PENDING_REVIEW":item ? status : draft ? undefined : publicTask?.submitStatus ?? (submitForReview ? "PENDING_REVIEW" : undefined),
        data,
      }, async payload=>{
        if(advance){const record=await apiRequest<WorkspaceItem>("/workspace/properties"+(item?"/"+item.id:""),{method:item?"PATCH":"POST",body:{...payload,requestId:item?undefined:payload.requestId,status:item?"DRAFT":undefined}});setSavedDraft(record);if(publicTask){const url=new URL(window.location.href);url.searchParams.set("draft",record.id);window.history.replaceState(window.history.state,"",url)}dirty.current=false;setStep(s=>Math.min(18,s+1));toast.success("Draft saved");return;}
        const result=await onSave({...payload,...(savedDraft&&!originalItem?{savedPropertyId:savedDraft.id}:{}),...(item?{requestId:undefined}:{})});if(result!==false)dirty.current=false;return result;
      });
      if (!advance && result !== false) onClose();
    } catch (saveError) {
      if (saveError instanceof ApiClientError && saveError.code === "PROPERTY_CREDITS_REQUIRED") upgradeDialog.current?.showModal();
      else showSaveError(saveError, fieldNames);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const inheritedFields = new Set(["projectOrSociety","listingIntent","propertyCategory","propertyType","city","locality","state","countryCode","canonicalLocation","postalCode","addressLine","addressVisibility","mapLocation","bedrooms","bathrooms","balconies","areaValue","areaUnit","price","priceMode","maxPrice","possessionDate","currency","unitNumber","floorNumber","facing","tower","amenities","availability","constructionStatus"]);
  function renderField(field: CollectionDescriptor["fields"][number]) {
    if (!includeField(field.key)) return null;
    const value = fieldValues[field.key];
    if(item?.linkedProjectId&&inheritedFields.has(field.key)){const display=field.type==="map"?(mapPin?[mapPin.latitude,mapPin.longitude].join(", "):"—"):Array.isArray(value)?value.join(", "):String(value === "" || value == null ? "—" : value);return <div key={field.key} className={styles.field}><span>{field.label}</span><output>{display}</output></div>;}
    const className = `${styles.field} ${field.wide ? styles.wideField : ""}`;
    const setValue = (nextValue: string | number | boolean) => field.key === "countryCode"
      ? selectCountry(String(nextValue))
      : updateField(field.key, nextValue);
    const isPostalArea = hasPostalAddress && field.key === "locality";
    const suggestions = isPostalArea ? lookup.location?.areas : field.type === "text" && !internationalAddress ? field.options?.map(({value}) => value) : undefined;
    const suggestionsId = isPostalArea ? areaOptionsId : cityOptionsId;
    const postalLocationField = postalLocationKeys.includes(field.key);
    const locationLocked = postalLocationField && internationalAddress && !country;
    const localizedKey = field.type === "media" ? "propertyGallery" : fieldLabels[field.key];
    const label = locale !== "en" && localizedKey ? t(localizedKey) : field.label;
    if (isChipList(field.key)) return <ChipListField key={field.key} className={className} label={label} required={field.required}
      list={field.key === "highlights" ? highlights : customAmenities} disabled={saving} placeholder={field.placeholder}
      inputProps={fieldProps(field.key)} error={fieldError(field.key)} onError={(message) => {
        if (message) setInvalidFields((current) => ({...current, [field.key]: message}));
        else clearFieldError(field.key);
      }} />;
    const masterKind:Record<string,string>={propertyCategory:"PROPERTY_CATEGORY",propertyType:"PROPERTY_TYPE",areaUnit:"AREA_UNIT"};
    const kind=masterKind[field.key];
    const selectedCategory=catalog?.PROPERTY_CATEGORY.find(c=>c.code===fieldValues.propertyCategory)?.id;
    const masterOptions=loadPropertyCatalog&&kind?(catalog?.[kind]??[]).filter(c=>kind!=="PROPERTY_TYPE"||(c.parentId===selectedCategory&&!c.code.startsWith("OTHER_"))).map(c=>({label:c.name,value:propertyTypeKey(String(value))===c.code?String(value):c.code})):undefined;
    if(masterOptions&&kind==="PROPERTY_TYPE"&&selectedCategory)masterOptions.push({label:"Other",value:"OTHER"});
    if(masterOptions&&value&&!masterOptions.some(o=>o.value===value))masterOptions.push({label:String(value)+" (saved)",value:String(value)});
    const options = masterOptions??(field.key === "countryCode" && locale !== "en" ? countryOptions
      : field.key === "propertyType" ? getPropertyTypeOptions(String(fieldValues.propertyCategory ?? ""), String(value ?? ""))
        : field.options);
    const pickCategoryFirst = field.key === "propertyType" && !options?.length;

    if (field.type === "rich-text") return <div className={className} key={field.key}>
      <label htmlFor={`${fieldErrorId}-editor`}>{label}</label>
      <PropertyEditor {...fieldProps(field.key)} id={`${fieldErrorId}-editor`} value={String(value ?? "")} onChange={(next) => {setValue(next); clearFieldError(field.key);}} />
      {fieldError(field.key)}
    </div>;

    if (field.type === "property-options") return <div className={className} key={field.key}>
      <span id={`${fieldErrorId}-label-${field.key}`}>{label}</span>
      <PropertyOptionPicker available={field.key==="amenities"&&loadPropertyCatalog?(catalog?.AMENITY??[]).map(c=>[c.code,c.name]):undefined} {...fieldProps(field.key)} aria-labelledby={`${fieldErrorId}-label-${field.key}`}
        type={field.key === "furnishingItems" ? "furnishings" : field.key === "amenities" ? "amenities" : "delivery"} values={parseOptionValues(value)}
        onChange={(selected) => {
          setValue(selected.join(", "));
          clearFieldError(field.key);
          if (field.key === "amenities" && !selected.includes("OTHER")) clearFieldError("customAmenities");
        }} />
      {fieldError(field.key)}
    </div>;


    if (publicTask && !publicTask.canSubmit && ["resume", "image", "images", "media", "video"].includes(field.type)) {
      return <div className={className} key={field.key}>
        <span>{label}{field.required ? " *" : ""}</span>
        <button className={styles.secondaryButton} type="button" onClick={publicTask.requestAccess}>Sign in to upload</button>
        {fieldError(field.key)}
      </div>;
    }

    if (field.type === "delivery-cities" || field.type === "delivery-city") {
      const previous = item?.data.deliveryCities;
      const legacy = materialProduct && Array.isArray(previous) ? previous.map(String)
        : materialRfq && typeof item?.data.city === "string" ? [item.data.city] : [];
      return <div key={field.key} className={className}>
        <DeliveryCityPicker {...fieldProps(field.key)} label={label} country={country}
          selected={deliveryCities} multiple={materialProduct} legacy={changedDeliveryCities ? [] : legacy}
          onChange={(cities) => {
            setDeliveryCities(cities);
            setChangedDeliveryCities(true);
            clearFieldError(field.key);
            if (materialRfq) updateField("state", cities[0]?.region ?? "");
          }} />
        {fieldError(field.key)}
      </div>;
    }

    if (field.type === "resume") return <label className={className} key={field.key}>
      <span>{label} <b>*</b></span>
      <ResumeUpload {...fieldProps(field.key)} value={String(value ?? "")}
        onBusy={(busy) => setActiveUploads((current) => busy ? [...current, field.key] : current.filter((key) => key !== field.key))}
        onChange={(url) => {setValue(url); clearFieldError(field.key);}} />
      {fieldError(field.key)}
    </label>;

    if (field.type === "map") return <div key={field.key} className={className}><MapPinInput value={mapPin} error={invalidFields.mapLocation} onChange={setMapPin} /></div>;

    if (useCatalog && (field.key === "city" || field.key === "state" || field.key === "locality")) {
      return <label key={field.key} className={className}><span>{label}</span>
        <PlaceField {...fieldProps(field.key)} kind={field.key} country={country} region={String(fieldValues.state ?? "")}
          city={catalogCityId || String(fieldValues.city ?? "")} value={String(value ?? "")} onChange={(name, option) => {
            clearFieldError(field.key);
            if (field.key === "city") {
              setCatalogCityId(option?.id ?? "");
              setFieldValues((current) => ({...current, city: name, locality: ""}));
            } else if (field.key === "state") {
              setCatalogCityId("");
              setFieldValues((current) => ({...current, state: name, city: "", locality: ""}));
            } else setValue(name);
          }} />{fieldError(field.key)}</label>;
    }

    if (field.type === "image" || field.type === "images" || field.type === "media" || field.type === "video") {
      return <div className={className} key={field.key}>
        <span>{label}</span>
        <ImageUpload {...fieldProps(field.key)} purpose={`${descriptor.key}:${field.key}`} label={label}
          maxFiles={field.maxFiles ?? 1} kind={field.type === "media" ? "mixed" : field.type === "video" ? "video" : "image"} value={String(value ?? "")}
          drafts={media} disabled={saving}
          onChange={(nextValue) => {setValue(nextValue); clearFieldError(field.key);}} />
        {fieldError(field.key)}
        {isProperty && field.key === "mediaUrls" && publishedGallery.length > 0 && <>
          <small>Remove or reorder existing items with Save gallery only. Keep at least one photo or video on the live listing.</small>
          <button className={styles.secondaryButton} type="button" disabled={saving || !galleryOrderChanged || !canSaveLiveGallery} onClick={async () => {
            if (savingRef.current) return;
            savingRef.current = true;
            setSaving(true);
            setError(null);
            try {if (await onSave({data: {mediaUrls: galleryEntries}}) !== false) onClose();}
            catch (failure) {showSaveError(failure, new Set(["mediaUrls"]));}
            finally {savingRef.current = false; setSaving(false);}
          }}>Save gallery only</button>
        </>}
      </div>;
    }

    if (field.type === "postal-code") {
      const pinRequired = internationalAddress ? requiresIndianPin : field.required;
      return (
        <label className={className} key={field.key}>
          <span>{internationalAddress ? (locale === "en" ? (indianListing ? "Indian PIN code" : "Postal / ZIP code") : t("postalCode")) : label} {pinRequired ? <b>*</b> : null}</span>
          <input
            {...fieldProps(field.key, usesPinLookup ? postalStatusId : undefined)}
            autoComplete="postal-code"
            disabled={internationalAddress && !country}
            inputMode={usesPinLookup || indianListing ? "numeric" : "text"}
            maxLength={usesPinLookup || indianListing ? 6 : 16}
            onChange={(event) => usesPinLookup ? setPostalCode(event.target.value) : setValue(event.target.value)}
            pattern={usesPinLookup || indianListing ? "[1-9][0-9]{5}" : undefined}
            placeholder={usesPinLookup ? "e.g. 160017" : undefined}
            required={pinRequired}
            title={usesPinLookup ? "Enter a six-digit Indian PIN code" : undefined}
            type="text"
            value={String(value ?? "")}
          />
          {fieldError(field.key)}
          {usesPinLookup && <small className={styles.pinLookupStatus} id={postalStatusId} role="status">
              {lookup.message || (materialRfq ? "Enter six digits to suggest the area. Select the city below." : "Enter six digits to fill the state, city and area.")}
          </small>}
          {usesPinLookup && lookup.status === "error" && <button className={styles.secondaryButton} type="button" onClick={lookup.retry}>Retry PIN lookup</button>}
        </label>
      );
    }

    if (field.type === "toggle") {
      return (
        <label className={`${className} ${styles.toggleField}`} key={field.key}>
          <span>
            <strong>{label}</strong>
            <small>{propertyAddress && field.key === "consentAccepted" ? "Required to submit for review"
                : field.required ? "Required to continue" : "You can change this later"}</small>
          </span>
          <input {...fieldProps(field.key)} checked={Boolean(value)} onChange={(event) => setValue(event.target.checked)} required={field.required} type="checkbox" />
          {fieldError(field.key)}
        </label>
      );
    }

    if (field.type === "tel") return <div className={className} key={field.key}>
      <label htmlFor={`${fieldErrorId}-${field.key}-input`}>{label} {field.required && <b>*</b>}</label>
      <PhoneInput {...fieldProps(field.key)} name={field.key} id={`${fieldErrorId}-${field.key}-input`} required={field.required}
        value={String(value ?? "")} onChange={setValue} preferredCountry={country} />
      {fieldError(field.key)}
      {isProperty && field.key === "contactPhone" && <small>People can see this number after they send a property enquiry.</small>}
    </div>;

    return (
      <label className={className} key={field.key}>
        <span>{label} {field.required || (isProperty && Object.hasOwn(propertySubmissionFields, field.key)) || (field.key === "bedrooms" && requiresBedrooms) || (field.key === "constructionStatus" && requiresConstruction) ? <b>*</b> : null}</span>
        {isRecordReference(field.key) ? (
          <RecordReference {...fieldProps(field.key)} field={field.key} publicProject={projectEnquiry} value={String(value ?? "")} required={field.required} locked={Boolean(item && (projectEnquiry || isImmutableRecordReference(field.key)))} onChange={setValue} />
        ) : field.type === "select" ? (
          <select {...fieldProps(field.key)} disabled={pickCategoryFirst} onChange={(event) => setValue(event.target.value)} required={field.required} value={String(value ?? "")}>
            <option value="" disabled={field.key === "propertyCategory" || field.key === "countryCode"}>{locale !== "en" ? t("selectOption") : pickCategoryFirst ? "Select a category first" : `Select ${label.toLowerCase()}`}</option>
            {materialProduct && value && !options?.some((option) => option.value === value) && <option value={String(value)} disabled>{value} (previously saved)</option>}
            {options?.map((option) => <option key={option.value} value={option.value}>{locale !== "en" && field.key === "listingIntent" && (option.value === "SALE" || option.value === "RENT")
              ? t(option.value === "SALE" ? "forSale" : "forRent") : option.label}</option>)}
          </select>
        ) : field.type === "list" && multilineLists.has(field.key) ? (
          <textarea {...fieldProps(field.key)} rows={3} required={field.required} placeholder={field.placeholder} value={String(value ?? "")}
            onChange={(event) => setValue(event.target.value)} />
        ) : (
          <input
            {...fieldProps(field.key)}
            autoComplete={hasPostalAddress && field.key === "city" ? "address-level2" : hasPostalAddress && field.key === "state" ? "address-level1" : isPostalArea ? "address-level3" : undefined}
            disabled={locationLocked}
            readOnly={(jobAddress && indianListing && postalLocationField && !isPostalArea) || (materialRfq && field.key === "state" && deliveryCities.length > 0)}
            list={suggestions?.length ? suggestionsId : undefined}
            maxLength={["propertyTypeOther", "kitchenType"].includes(field.key) ? 80 : isPostalArea ? 160 : undefined}
            min={field.type === "number" ? field.key === "totalFloors" ? 1 : 0 : undefined}
            max={field.max}
            step={field.type === "number" ? field.step ?? "any" : undefined}
            onChange={(event) => setValue(event.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            type={field.type === "datetime" ? "datetime-local" : field.type === "list" ? "text" : field.type}
            value={String(value ?? "")}
          />
        )}
        {fieldError(field.key)}
        {suggestions?.length ? (
          <datalist id={suggestionsId}>
            {suggestions.map((option) => <option key={option} value={option} />)}
          </datalist>
        ) : null}
      </label>
    );
  }

  const content = (
      <section aria-labelledby={publicTask ? "public-task-title" : "workspace-form-title"} aria-modal={publicTask ? undefined : true} className={publicTask ? `${styles.dashboard} ${styles.publicForm}` : styles.modal} role={publicTask ? undefined : "dialog"} data-motion={publicTask ? undefined : "dialog"}>
        {!publicTask && <div className={styles.modalHeader}>
          <div>
            <p className={styles.kicker}>{item ? "Update record" : "New workspace record"}</p>
            <h2 id="workspace-form-title">{heading}</h2>
            <p>{subtitle}</p>
          </div>
          <button aria-label={locale === "en" ? "Close form" : t("close")} className={styles.iconButton} disabled={saving || uploading} onClick={closeEditor} type="button"><X size={19} /></button>
        </div>}

        <form aria-busy={saving} className={styles.form} data-public-task={publicTask ? descriptor.key : undefined} noValidate onChange={(event) => {
          dirty.current=true;
          if (reviewAttempt && !(event.target instanceof HTMLInputElement && event.target.name === "confirmJobReview")) {
            setReviewAttempt(""); setReviewing(false); setConfirmed(false); setError(null);
          }
          if (isFormControl(event.target)) clearFieldError(event.target.name);
        }} onSubmit={submit} ref={formRef}>
          {error ? <div className={styles.formError} role="alert">{error}</div> : null}

          {item?.latestReview ? (
            <aside aria-label="Latest admin feedback" className={styles.reviewFeedback}>
              <ClipboardCheck aria-hidden="true" size={17} />
              <div>
                <strong>Admin feedback</strong>
                <small>{item.latestReview.status.replaceAll("_", " ")} · <time dateTime={item.latestReview.decidedAt}>
                  {new Date(item.latestReview.decidedAt).toLocaleDateString("en-IN", {dateStyle: "medium"})}
                </time></small>
                <p>{item.latestReview.note}</p>
              </div>
            </aside>
          ) : null}

          {catalogError&&<p role="alert">{catalogError} <button type="button" onClick={()=>retryCatalog(n=>n+1)}>Retry</button></p>}
          {isProperty&&canEdit&&<div className={styles.wizardNav}><label>Listing step <select aria-label="Listing step" value={step} onChange={e=>setStep(Number(e.target.value))}>{propertySteps.map((s,i)=><option key={s} value={i+1}>{i+1}. {s}</option>)}</select></label><span>{completion}% of required details</span><progress max={100} value={completion}/></div>}
          {(!isProperty||!canEdit||step===1||step===4)&&<label className={`${styles.field} ${styles.wideField}`}>
            <span>{t(propertyAddress ? "listingTitle" : publicTask ? "title" : "recordTitle")} <b>*</b></span>
            <input {...fieldProps("title")} autoFocus={!publicTask && canEdit} onChange={(event) => setTitle(event.target.value)} placeholder={locale === "en" ? (isProperty ? "e.g. Two-bedroom apartment near City Park" : `e.g. ${descriptor.singular} reference`) : undefined} required readOnly={!canEdit} maxLength={160} value={title} />
            {fieldError("title")}
          </label>}
          {(!isProperty||!canEdit||step===15)&&<label className={`${styles.field} ${styles.wideField}`}>
            <span>{t("description")}{isProperty && <b> *</b>}</span>
            <textarea {...fieldProps("description")} onChange={(event) => setDescription(event.target.value)} placeholder={locale === "en" ? (isProperty ? "Summarise what buyers or tenants should know about this property." : "Add the context someone needs to take the next step.") : undefined} readOnly={!canEdit} maxLength={5000} rows={3} value={description} />
            {fieldError("description")}
          </label>}

          {isProperty && step===1 && canEdit && posterLabel && <label className={styles.field}>
            <span>{t("listedBy")}</span>
            <input readOnly value={t(posterLabel)} />
          </label>}

          {item && (!isProperty || !canEdit || step===18) ? (
            <label className={`${styles.field} ${styles.wideField}`}>
              <span>{t("workflowStatus")} <b>*</b></span>
              <select {...fieldProps("status")} onChange={(event) => setStatus(event.target.value)} required value={status}>
                {[item.status, ...(item.allowedNextStatuses ?? [])].filter((option, index, options) => options.indexOf(option) === index).map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
              </select>
              {fieldError("status")}
              <small>Status changes are saved to the workspace activity trail.</small>
            </label>
          ) : null}

          {isProperty&&item?.linkedProjectId&&canEdit&&<p className={styles.wideField}>Location, layout, price and availability come from the linked unit. <Link href={"/"+locale+"/dashboard?view=project-inventory&project="+encodeURIComponent(item.linkedProjectId)}>Manage project inventory</Link></p>}
          {canEdit&&isProperty&&!item?.linkedProjectId&&step===3&&<AddressSearch onSelect={place=>{const chosen:Record<string,string>={},labels:Record<string,string>={};for(const o of place.items){const k=o.kind?.toLowerCase();if(k){chosen[k+"Id"]=o.id;labels[k==="country"?"countryCode":k]=k==="country"?o.code??"":o.name;if(k==="city")setCatalogCityId(o.code??"");}}setCanonical(chosen);setFieldValues(s=>({...s,...labels,addressLine:place.address}));dirty.current=true;}}/>}
          {canEdit && materialProduct && <ProductFields fields={fieldValues} update={updateField} values={productSpecs} onChange={setProductSpecs} errors={invalidFields}/>}
          {canEdit && (isProperty ? propertySections.filter(([label])=>label===propertySteps[step-1]).map(([label, keys]) => {
            const fields = keys.flatMap(key => descriptor.fields.filter(field => field.key === key && includeField(key)));
            return fields.length > 0 && <fieldset key={label} className={styles.propertyFieldGroup}>
              <legend>{label}</legend>
              <div className={styles.propertyFieldGrid}>{fields.map(renderField)}</div>
            </fieldset>;
          }) : descriptor.fields.filter(f=>!materialProduct || !["category","unit","subcategoryId"].includes(f.key)).map(renderField))}
          {isProperty&&canEdit&&step===5&&<PropertyAreaUnits data={fieldValues} value={measurementUnits} change={setMeasurementUnits}/>}
          {isProperty&&canEdit&&step===9&&<PropertyCharges value={charges} change={setCharges} currency={String(fieldValues.currency||"")}/>}
          {isProperty&&canEdit&&step===11&&descriptor.fields.filter(f=>f.key==="mediaUrls").map(renderField)}
          {isProperty&&canEdit&&step===11&&<PropertyVideos images={galleryEntries.filter(u=>!(media.file(u)?.type.startsWith("video/")||u.endsWith(".mp4")))} value={videos} change={setVideos}/>}
          {isProperty&&canEdit&&step===10&&<PropertyMediaFields urls={galleryEntries} value={galleryMeta} change={setGalleryMeta}/>}
          {isProperty&&canEdit&&step===14&&<NearbyEditor value={places} change={setPlaces}/>}
          {isProperty&&canEdit&&step===17&&progress.missing.length>0&&<section className={styles.wideField}><h3>Still needed to submit</h3><ul>{progress.missing.map(key=><li key={key}><button className={styles.secondaryButton} type="button" onClick={()=>setStep(key==="title"?1:key==="description"?15:Math.max(1,propertySections.findIndex(([,fields])=>fields.includes(key))+1))}>{descriptor.fields.find(f=>f.key===key)?.label??key}</button></li>)}</ul></section>}
          {isProperty&&canEdit&&step===17&&mapPin&&fieldValues.addressVisibility!=="LOCALITY_ONLY"&&<MapFrame pin={fieldValues.addressVisibility==="APPROXIMATE"?{latitude:Math.round(mapPin.latitude*100)/100,longitude:Math.round(mapPin.longitude*100)/100}:mapPin}/>}
          {isProperty&&canEdit&&step===17&&<PropertyPreview title={title} description={description} data={{...fieldValues,additionalCharges:charges,videoTours:videos,localPlaces:places,highlights:savedHighlights}} media={galleryEntries} videoSources={galleryEntries.filter(url=>media.file(url)?.type.startsWith('video/')||isUploadedVideoUrl(url))} role={posterRole}/>}
          {isProperty&&[12,13,17].includes(step)&&canEdit&&!item&&<p>Use Save and continue to create a draft before attaching files.</p>}
          {isProperty&&item&&(!canEdit||[12,13,17].includes(step))&&(["plans","documents"] as const).filter(k=>!canEdit||step===17||step===(k==="plans"?12:13)).map(k=><PropertyAssets key={k} id={item.id} kind={k} editable={canEdit&&step!==17&&["DRAFT","CHANGES_REQUESTED","REJECTED","PUBLISHED","APPROVED"].includes(item.status)} onSaved={(updatedAt,nextStatus)=>{setSavedDraft({...item,updatedAt,status:nextStatus,canEditContent:nextStatus==="PENDING_REVIEW"?false:item.canEditContent});if(nextStatus!==item.status){setStatus(nextStatus);toast.success("Listing files saved and submitted for review.");}}}/>)}
          {canEdit && hasLines && <LineItems
            fieldError={fieldError}
            fieldProps={fieldProps}
            quote={isQuote}
            rows={lines}
            onChange={(nextLines) => {
              if (nextLines.length !== lines.length) {
                setInvalidFields((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== "items" && !key.startsWith("items."))));
              }
              clearFieldError("items");
              setLines(nextLines);
            }}
          />}
          {canControlLockedPrivacy ? (
            <label className={`${styles.field} ${styles.wideField} ${styles.toggleField}`}>
              <span>
                <strong>Show approved contact details publicly</strong>
                <small>You can withdraw or restore this permission at any time.</small>
              </span>
              <input
                {...fieldProps(privacyKey)}
                checked={privacyValue}
                onChange={(event) => setFieldValues((current) => ({...current, [privacyKey]: event.target.checked}))}
                type="checkbox"
              />
              {fieldError(privacyKey)}
            </label>
          ) : null}
          {!canEdit && item && (
            <section aria-label="Record details" className={`${styles.wideField} ${styles.recordDetails}`}>
              <h3>Record details</h3>
              <RecordDetails data={item.data} descriptor={descriptor} errors={invalidFields} />
            </section>
          )}
          {item && <FeaturePlacement key={item.id} collection={descriptor.key} item={item} onNavigate={onClose} />}

          {publishJob && reviewAttempt && <section className={styles.reviewFeedback} aria-label="Manual job publication">
            <div><strong>Automated content check is currently unavailable.</strong>
              {reviewing ? <label><input name="confirmJobReview" type="checkbox" checked={confirmed} disabled={saving}
                onChange={event => setConfirmed(event.target.checked)} /> I have manually reviewed this job title, description, requirements, salary information and employer details and confirm that it complies with platform policy.</label>
                : <button type="button" className={styles.secondaryButton} disabled={saving}
                  onClick={() => setReviewing(true)}>Review &amp; Publish Manually</button>}
              {reviewing && <button className={styles.primaryButton} type="submit" value="manual-review"
                disabled={!confirmed || saving}>Confirm and publish job</button>}
            </div>
          </section>}
          <div className={styles.formActions}>
            <UploadProgress progress={media.progress} />
            {!publicTask && <button className={styles.secondaryButton} disabled={saving || uploading} onClick={onClose} type="button">{t("cancel")}</button>}
            {isProperty&&canEdit&&step>1&&<button type="button" className={styles.secondaryButton} onClick={()=>setStep(s=>s-1)}>Back</button>}
            {isProperty&&canEdit&&step<18&&((!item||item.status==="DRAFT")?<button className={styles.primaryButton} type="submit" value="continue" disabled={saving}>Save and continue</button>:<button type="button" className={styles.primaryButton} onClick={()=>setStep(s=>s+1)}>Continue</button>)}
            {(!isProperty||!canEdit||step===18)&&<button className={`${styles.primaryButton} ${propertyCreate ? styles.submitListing : ""}`} disabled={saving || uploading || (!canEdit && status === item?.status && !privacyChanged)} type="submit">
              {saving ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}
              {saving ? t("saving") : publishJob ? (reviewAttempt ? "Retry automated check" : "Publish Job") : requiresReviewOnSave ? "Save and send for review" : propertyCreate ? t("submitListing")
                : locale === "en" && publicTask ? publicTask.action : item ? t("saveChanges") : locale === "en" ? descriptor.createLabel : t("submit")}
            </button>}
            {(propertyCreate || publicTask?.allowDraft) && <button className={styles.secondaryButton} disabled={saving || uploading} type="submit" value="draft">{t("saveDraft")}</button>}
          </div>
        </form>
        {isProperty && <dialog className={styles.creditDialog} ref={upgradeDialog} aria-label="Upgrade your posting plan">
          <h2>Upgrade your posting plan</h2><p>You have used your available property credits. Choose a plan to submit this listing. Your form stays open while you check out.</p>
          <div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={()=>upgradeDialog.current?.close()}>Continue editing</button>
          <a className={styles.primaryButton} href={`/${locale}/dashboard?view=billing#plans-title`} target="_blank" rel="noopener" onClick={()=>upgradeDialog.current?.close()}>View plans</a></div>
        </dialog>}
      </section>
  );
  return publicTask ? content : (
    <div className={styles.modalBackdrop} data-motion="backdrop" onMouseDown={(event) => !saving && !uploading && event.target === event.currentTarget && onClose()}>
      {content}
    </div>
  );
}

