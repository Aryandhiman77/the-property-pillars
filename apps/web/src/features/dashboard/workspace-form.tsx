"use client";

import {useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type Ref} from "react";
import {materialCategories, materialOptionValue, materialUnits, normalizeContactPhone, type DeliveryCity} from "@the-property-pillar/contracts";
import {ClipboardCheck, LoaderCircle, Save, X} from "lucide-react";
import {usePincodeLookup} from "@/features/address/use-pincode-lookup";
import {ApiClientError} from "@/lib/api/client";
import {fieldAttributes, invalidControls, isFormControl, splitFieldErrors} from "@/lib/form-validation";
import {currencyForCountry, defaultListingCountry} from "@/config/listing-geography";

import type {CollectionDescriptor, WorkspaceItem} from "./types";
import {getPropertyTypeOptions} from "./collection-config";
import {LineItems, readLines} from "./line-items";
import {DeliveryCityPicker} from "./delivery-city-picker";
import {RecordDetails} from "./record-details";
import {ImageUpload} from "./image-upload";
import {ResumeUpload, isResumePath} from "@/features/marketplace/resume-upload";
import {isImmutableRecordReference, isRecordReference, RecordReference} from "./record-reference";
import styles from "./dashboard.module.css";

export type WorkspaceMutation = {
  title?: string;
  description?: string | null;
  status?: string;
  reviewNote?: string;
  data?: Record<string, unknown>;
};

type WorkspaceFormProps = {
  descriptor: CollectionDescriptor;
  item?: WorkspaceItem | null;
  allowLockedPrivacyControl?: boolean;
  onClose: () => void;
  onSave: (payload: WorkspaceMutation) => Promise<void | false>;
  publicTask?: {
    action: string;
    initial?: WorkspaceMutation;
    submitStatus?: string;
    allowDraft?: boolean;
    canSubmit: boolean;
    requestAccess: () => void;
    draftRef: Ref<WorkspaceMutation>;
  };
};

const multilineLists = new Set(["responsibilities", "qualifications", "benefits"]);
const postalLocationKeys = ["state", "city", "locality"];

function initialFieldValue(item: {data?: Record<string, unknown>} | null | undefined, key: string, type?: string) {
  const value = item?.data?.[key];
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

export function WorkspaceForm({descriptor: configured, item, allowLockedPrivacyControl = false, onClose, onSave, publicTask}: WorkspaceFormProps) {
  const initial = item ?? publicTask?.initial;
  const projectEnquiry = configured.key === "propertyInquiries" && (Object.hasOwn(initial?.data ?? {}, "projectId") || configured.fields.some(({key}) => key === "projectId"));
  const descriptor = projectEnquiry ? {...configured, fields: configured.fields.map((field) => field.key === "propertyId" ? {...field, key: "projectId", label: "Builder project"} : field)} : configured;
  const propertyAddress = descriptor.key === "properties";
  const jobAddress = descriptor.key === "jobs";
  const materialRfq = descriptor.key === "materialRfqs";
  const materialProduct = descriptor.key === "materialProducts";
  const internationalAddress = descriptor.fields.some(({key}) => key === "countryCode");
  const regionalRegistration = propertyAddress || descriptor.key === "dealerProfiles";
  const propertyCreate = propertyAddress && !item;
  const initialCountry = internationalAddress ? String(initial?.data?.countryCode ?? (item ? defaultListingCountry : "")) : "";
  const initialLookupPin = (!internationalAddress || initialCountry === defaultListingCountry) ? String(initial?.data?.postalCode ?? "") : "";
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState(item?.status ?? descriptor.statuses[0] ?? "DRAFT");
  const [fieldValues, setFieldValues] = useState<Record<string, string | number | boolean>>(() =>
    Object.fromEntries(descriptor.fields.map((field) => [field.key, field.key === "countryCode" ? initialCountry : initialFieldValue(initial, field.key, field.type)])),
  );
  const [saving, setSaving] = useState(false);
  const [activeUploads, setActiveUploads] = useState<string[]>([]);
  const uploading = activeUploads.length > 0;
  const [error, setError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const savingRef = useRef(false);
  const focusInvalid = useRef(false);
  const [lines, setLines] = useState(() => readLines(initial?.data?.items));
  const [deliveryCities, setDeliveryCities] = useState<DeliveryCity[]>(() => Array.isArray(initial?.data?.deliveryCityOptions) ? initial.data.deliveryCityOptions as DeliveryCity[] : []);
  const [changedDeliveryCities, setChangedDeliveryCities] = useState(!item && deliveryCities.length > 0);
  const [lookupPincode, setLookupPincode] = useState(initialLookupPin);
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
  const hasPostalAddress = descriptor.fields.some(({type}) => type === "postal-code");
  const country = String(fieldValues.countryCode ?? "");
  const indianListing = internationalAddress && country === defaultListingCountry;
  const requiresIndianPin = indianListing && (propertyAddress || jobAddress);
  const usesPinLookup = !internationalAddress || indianListing;
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
  const jobAddressReady = Boolean(fieldValues.postalCode && fieldValues.state && fieldValues.city);
  const propertyAddressReady = lookup.location?.pincode === fieldValues.postalCode;
  const hasLines = descriptor.key === "materialRfqs" || descriptor.key === "materialQuotes";
  const isQuote = descriptor.key === "materialQuotes";
  const canControlLockedPrivacy = Boolean(item && !canEdit && allowLockedPrivacyControl && ["dealerProfiles", "serviceProfiles", "workerProfiles"].includes(descriptor.key));
  const privacyValue = fieldValues.publicContactConsent === true;
  const privacyChanged = canControlLockedPrivacy && privacyValue !== (item?.data.publicContactConsent === true);

  useImperativeHandle(publicTask?.draftRef, () => ({
    title,
    description,
    data: {
      ...Object.fromEntries(configured.fields
        .filter(({type}) => type !== "image" && type !== "images" && type !== "resume")
        .map(({key}) => [key, fieldValues[key]])),
      ...(projectEnquiry ? {projectId: fieldValues.projectId} : {}),
      items: lines,
      deliveryCityOptions: deliveryCities,
    },
  }), [title, description, fieldValues, lines, deliveryCities, configured.fields, projectEnquiry]);

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
    if (key === "propertyTypeOther") return fieldValues.propertyType === "OTHER";
    return !regionalRegistration || indianListing || (key !== "reraApplicable" && key !== "reraNumber");
  }

  function showSaveError(saveError: unknown, fieldNames: Set<string>) {
    if (saveError instanceof ApiClientError && Object.keys(saveError.fieldErrors).length) {
      if (hasLines) fieldNames.add("items");
      if (!canEdit) for (const field of descriptor.fields) fieldNames.add(field.key);
      const {fields, general} = splitFieldErrors(saveError.fieldErrors, fieldNames, materialRfq ? {city: "cityId"} : {});
      focusInvalid.current = true;
      setInvalidFields(fields);
      if (general) setError(general);
      return;
    }
    setError(saveError instanceof Error ? saveError.message : "The record could not be saved.");
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
    }));
  }

  function selectCountry(next: string) {
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
    }));
    setInvalidFields((current) => Object.fromEntries(Object.entries(current).filter(([key]) =>
      key !== "postalCode" && key !== "currency" && !postalLocationKeys.includes(key),
    )));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || uploading) return;
    if (publicTask && !publicTask.canSubmit) {
      publicTask.requestAccess();
      return;
    }
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const draft = submitter instanceof HTMLButtonElement && submitter.value === "draft";
    const submitForReview = propertyCreate && !draft;
    const propertyDraft = propertyAddress && (propertyCreate ? !submitForReview : status === "DRAFT");
    setError(null);
    setInvalidFields({});
    const fields = Array.from(event.currentTarget.elements).filter(isFormControl).filter((field) => field.name);
    const fieldNames = new Set(fields.map(({name}) => name));
    const errors = invalidControls(event.currentTarget);
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
    if (canEdit && propertyAddress && fieldValues.propertyType === "OTHER" && !String(fieldValues.propertyTypeOther ?? "").trim()) {
      errors.propertyTypeOther = "Specify the property type.";
    }
    if (canEdit && !propertyDraft && requiresIndianPin && !fieldValues.postalCode) errors.postalCode = "Enter the Indian PIN code.";
    if (canEdit && descriptor.key === "jobApplications" && !isResumePath(fieldValues.resumeUrl)) errors.resumeUrl = "Upload your résumé before submitting.";
    const savedPropertyLocation = item?.data.postalCode === fieldValues.postalCode &&
      postalLocationKeys.every((key) => fieldValues[key] === initialFieldValue(item, key));
    const needsPostalLookup = indianListing && ((jobAddress && !jobAddressReady) ||
      (propertyAddress && (!propertyDraft || Boolean(fieldValues.postalCode)) && !propertyAddressReady && !savedPropertyLocation));
    if (canEdit && needsPostalLookup && !errors.postalCode) {
      errors.postalCode = lookup.status === "loading" ? "Wait for the PIN lookup to finish." : lookup.message || "Enter a valid PIN code to fill the location.";
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
          ...(privacyChanged ? {data: {publicContactConsent: privacyValue}} : {}),
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
        .filter(({key}) => includeField(key))
        .map((field) => {
          const stored = item?.data[field.key];
          const raw = fieldValues[field.key];
          const value = typeof raw === "string" ? raw.trim() : raw;
          if (field.type === "delivery-cities") return [field.key, changedDeliveryCities ? deliveryCities.map(({id}) => id) : ""];
          if (field.type === "delivery-city") return [field.key, changedDeliveryCities ? deliveryCities[0]?.id ?? null : ""];
          if (field.key === "propertyTypeOther") return [field.key, String(value ?? "").trim()];
          if (field.type === "images" && typeof value === "string") {
            return [field.key, value ? value.split(", ") : (item?.data[field.key] ? [] : "")];
          }
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
    if (materialRfq && changedDeliveryCities && !deliveryCities.length) data.city = "";
    if (hasLines && (lines.length || Array.isArray(item?.data.items))) {
      data.items = lines.length ? lines.map(({itemName, category, specification, quantity, unit, unitPrice}) => ({
        itemName, specification: specification || undefined, quantity: Number(quantity), unit,
        ...(isQuote ? {unitPrice: Number(unitPrice)} : {category}),
      })) : null;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const result = await onSave({
        title: title.trim(),
        description: description.trim() || (item ? null : undefined),
        status: item ? status : draft ? undefined : publicTask?.submitStatus ?? (submitForReview ? "PENDING_REVIEW" : undefined),
        data,
      });
      if (result !== false) onClose();
    } catch (saveError) {
      showSaveError(saveError, fieldNames);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const content = (
      <section aria-labelledby={publicTask ? "public-task-title" : "workspace-form-title"} aria-modal={publicTask ? undefined : true} className={publicTask ? `${styles.dashboard} ${styles.publicForm}` : styles.modal} role={publicTask ? undefined : "dialog"}>
        {!publicTask && <div className={styles.modalHeader}>
          <div>
            <p className={styles.kicker}>{item ? "Update record" : "New workspace record"}</p>
            <h2 id="workspace-form-title">{heading}</h2>
            <p>{subtitle}</p>
          </div>
          <button aria-label="Close form" className={styles.iconButton} disabled={saving || uploading} onClick={onClose} type="button"><X size={19} /></button>
        </div>}

        <form aria-busy={saving} className={styles.form} data-public-task={publicTask ? descriptor.key : undefined} noValidate onChange={(event) => {
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

          <label className={`${styles.field} ${styles.wideField}`}>
            <span>{propertyAddress ? "Listing title" : publicTask ? "Title" : "Record title"} <b>*</b></span>
            <input {...fieldProps("title")} autoFocus={!publicTask && canEdit} onChange={(event) => setTitle(event.target.value)} placeholder={`e.g. ${descriptor.singular} reference`} required readOnly={!canEdit} maxLength={160} value={title} />
            {fieldError("title")}
          </label>

          <label className={`${styles.field} ${styles.wideField}`}>
            <span>Description</span>
            <textarea {...fieldProps("description")} onChange={(event) => setDescription(event.target.value)} placeholder="Add the context someone needs to take the next step." readOnly={!canEdit} maxLength={5000} rows={3} value={description} />
            {fieldError("description")}
          </label>

          {item ? (
            <label className={`${styles.field} ${styles.wideField}`}>
              <span>Workflow status <b>*</b></span>
              <select {...fieldProps("status")} onChange={(event) => setStatus(event.target.value)} required value={status}>
                {[item.status, ...(item.allowedNextStatuses ?? [])].filter((option, index, options) => options.indexOf(option) === index).map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
              </select>
              {fieldError("status")}
              <small>Status changes are saved to the workspace activity trail.</small>
            </label>
          ) : null}

          {canEdit && descriptor.fields.map((field) => {
            if (!includeField(field.key)) return null;
            const value = fieldValues[field.key];
            const className = `${styles.field} ${field.wide ? styles.wideField : ""}`;
            const setValue = (nextValue: string | number | boolean) => field.key === "countryCode"
              ? selectCountry(String(nextValue))
              : updateField(field.key, nextValue);
            const isPostalArea = hasPostalAddress && field.key === "locality";
            const suggestions = isPostalArea ? lookup.location?.areas : field.type === "text" && !internationalAddress ? field.options?.map(({value}) => value) : undefined;
            const suggestionsId = isPostalArea ? areaOptionsId : cityOptionsId;
            const postalLocationField = postalLocationKeys.includes(field.key);
            const locationLocked = postalLocationField && internationalAddress && (!country || (indianListing &&
              ((propertyAddress && !propertyAddressReady) || (jobAddress && !jobAddressReady))));
            const options = field.key === "propertyType"
              ? getPropertyTypeOptions(String(fieldValues.propertyCategory ?? ""), String(value ?? ""))
              : field.options;
            const pickCategoryFirst = field.key === "propertyType" && !options?.length;

            if (publicTask && !publicTask.canSubmit && (field.type === "resume" || field.type === "image" || field.type === "images")) {
              return <div className={className} key={field.key}>
                <span>{field.label}{field.required ? " *" : ""}</span>
                <button className={styles.secondaryButton} type="button" onClick={publicTask.requestAccess}>Sign in to upload</button>
                {fieldError(field.key)}
              </div>;
            }

            if (field.type === "delivery-cities" || field.type === "delivery-city") {
              const previous = item?.data.deliveryCities;
              const legacy = materialProduct && Array.isArray(previous) ? previous.map(String)
                : materialRfq && typeof item?.data.city === "string" ? [item.data.city] : [];
              return <div key={field.key} className={className}>
                <DeliveryCityPicker {...fieldProps(field.key)} label={field.label} country={country}
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
              <span>{field.label} <b>*</b></span>
              <ResumeUpload {...fieldProps(field.key)} value={String(value ?? "")}
                onBusy={(busy) => setActiveUploads((current) => busy ? [...current, field.key] : current.filter((key) => key !== field.key))}
                onChange={(url) => {setValue(url); clearFieldError(field.key);}} />
              {fieldError(field.key)}
            </label>;

            if (field.type === "image" || field.type === "images") {
              return <div className={className} key={field.key}>
                <span>{field.label}</span>
                <ImageUpload {...fieldProps(field.key)} purpose={`${descriptor.key}:${field.key}`} label={field.type === "image" ? "Upload image" : "Upload photos"}
                  maxFiles={field.maxFiles ?? 1} dropzone={propertyAddress && field.key === "mediaUrls"} value={String(value ?? "")}
                  onBusy={(busy) => setActiveUploads((current) => busy ? [...current, field.key] : current.filter((key) => key !== field.key))}
                  onChange={(nextValue) => {setValue(nextValue); clearFieldError(field.key);}} />
                {fieldError(field.key)}
              </div>;
            }

            if (field.type === "postal-code") {
              const pinRequired = internationalAddress ? requiresIndianPin : field.required;
              return (
                <label className={className} key={field.key}>
                  <span>{internationalAddress ? (indianListing ? "Indian PIN code" : "Postal / ZIP code") : field.label} {pinRequired ? <b>*</b> : null}</span>
                  <input
                    {...fieldProps(field.key, usesPinLookup ? postalStatusId : undefined)}
                    autoComplete="postal-code"
                    disabled={internationalAddress && !country}
                    inputMode={usesPinLookup ? "numeric" : "text"}
                    maxLength={usesPinLookup ? 6 : 16}
                    onChange={(event) => usesPinLookup ? setPostalCode(event.target.value) : setValue(event.target.value)}
                    pattern={usesPinLookup ? "[1-9][0-9]{5}" : undefined}
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
                    <strong>{field.label}</strong>
                    {field.required || propertyAddress ? <small>{propertyAddress ? "Required to submit for review" : "Required to continue"}</small> : <small>You can change this later</small>}
                  </span>
                  <input {...fieldProps(field.key)} checked={Boolean(value)} onChange={(event) => setValue(event.target.checked)} required={field.required} type="checkbox" />
                  {fieldError(field.key)}
                </label>
              );
            }

            return (
              <label className={className} key={field.key}>
                <span>{field.label} {field.required ? <b>*</b> : null}</span>
                {isRecordReference(field.key) ? (
                  <RecordReference {...fieldProps(field.key)} field={field.key} publicProject={projectEnquiry} value={String(value ?? "")} required={field.required} locked={Boolean(item && (projectEnquiry || isImmutableRecordReference(field.key)))} onChange={setValue} />
                ) : field.type === "select" ? (
                  <select {...fieldProps(field.key)} disabled={pickCategoryFirst} onChange={(event) => setValue(event.target.value)} required={field.required} value={String(value ?? "")}>
                    <option value="" disabled={field.key === "propertyCategory" || field.key === "countryCode"}>{pickCategoryFirst ? "Select a category first" : `Select ${field.label.toLowerCase()}`}</option>
                    {materialProduct && value && !options?.some((option) => option.value === value) && <option value={String(value)} disabled>{value} (previously saved)</option>}
                    {options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : field.type === "list" && multilineLists.has(field.key) ? (
                  <textarea {...fieldProps(field.key)} rows={3} placeholder={field.placeholder} value={String(value ?? "")}
                    onChange={(event) => setValue(event.target.value)} />
                ) : (
                  <input
                    {...fieldProps(field.key)}
                    autoComplete={hasPostalAddress && field.key === "city" ? "address-level2" : hasPostalAddress && field.key === "state" ? "address-level1" : isPostalArea ? "address-level3" : undefined}
                    disabled={locationLocked}
                    readOnly={(jobAddress && indianListing && postalLocationField && !isPostalArea) || (materialRfq && field.key === "state" && deliveryCities.length > 0)}
                    list={suggestions?.length ? suggestionsId : undefined}
                    maxLength={field.key === "propertyTypeOther" ? 80 : isPostalArea ? 160 : field.type === "tel" ? 25 : undefined}
                    min={field.type === "number" ? 0 : undefined}
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
          })}
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
                {...fieldProps("publicContactConsent")}
                checked={privacyValue}
                onChange={(event) => setFieldValues((current) => ({...current, publicContactConsent: event.target.checked}))}
                type="checkbox"
              />
              {fieldError("publicContactConsent")}
            </label>
          ) : null}
          {!canEdit && item && (
            <section aria-label="Record details" className={`${styles.wideField} ${styles.recordDetails}`}>
              <h3>Record details</h3>
              <RecordDetails data={item.data} descriptor={descriptor} errors={invalidFields} />
            </section>
          )}

          <div className={styles.formActions}>
            {!publicTask && <button className={styles.secondaryButton} disabled={saving || uploading} onClick={onClose} type="button">Cancel</button>}
            <button className={`${styles.primaryButton} ${propertyCreate ? styles.submitListing : ""}`} disabled={saving || uploading || (!canEdit && status === item?.status && !privacyChanged)} type="submit">
              {saving ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}
              {saving ? "Saving…" : publicTask?.action ?? (propertyCreate ? "Submit listing" : item ? "Save changes" : descriptor.createLabel)}
            </button>
            {(propertyCreate || publicTask?.allowDraft) && <button className={styles.secondaryButton} disabled={saving || uploading} type="submit" value="draft">Save draft</button>}
          </div>
        </form>
      </section>
  );
  return publicTask ? content : (
    <div className={styles.modalBackdrop} onMouseDown={(event) => !saving && !uploading && event.target === event.currentTarget && onClose()}>
      {content}
    </div>
  );
}

