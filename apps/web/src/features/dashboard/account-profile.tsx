"use client";

import {MaterialInput, MaterialTextarea} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";

import {CircleAlert, KeyRound, LoaderCircle, LocateFixed, Save} from "lucide-react";
import {useEffect, useId, useState, type FormEvent} from "react";
import {useTranslations} from "next-intl";
import toast from "react-hot-toast";
import {parsePhoneNumberFromString} from "libphonenumber-js/min";
import {countryName} from "@/config/listing-geography";
import {useSiteLocation} from "@/features/location/site-location";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {focusInvalidControl, splitFieldErrors} from "@/lib/form-validation";
import {ImageUpload} from "./image-upload";
import {useMediaDrafts} from "./media-drafts";
import {UploadProgress} from "./upload-progress";
import {PhoneInput} from "@/components/ui/phone-input";
import {LoadingRows} from "@/components/ui/loading-skeleton";
import {useMobilePrompt} from "@/features/auth/mobile-auth";
import styles from "./dashboard.module.css";

type Profile = {
  fullName: string;
  email: string | null;
  emailVerifiedAt: string | null;
  phone: string | null;
  phoneVerifiedAt: string | null;
  role: string;
  aboutMe: string | null;
  location: string | null;
  logoUrl: string | null;
};

type ProfileProps = {
  onSaved: (profile: Pick<Profile, "fullName" | "logoUrl">) => void;
  onSessionExpired: () => Promise<void>;
};

function profileDraft({fullName, aboutMe, location, logoUrl, phone}: Profile) {
  return {fullName, aboutMe: aboutMe ?? "", location: location ?? "", logoUrl: logoUrl ?? "", phone: phone ?? ""};
}

function inputState(errors: Record<string, string>, id: string, name: string) {
  return {name, "aria-invalid": Boolean(errors[name]) || undefined, "aria-describedby": errors[name] ? `${id}-${name}` : undefined};
}

function FieldError({id, message}: {id: string; message?: string}) {
  return message ? <small className={styles.fieldError} id={id} role="alert">{message}</small> : null;
}

function failure(error: unknown, names: string[]) {
  const {fields, general} = splitFieldErrors(error instanceof ApiClientError ? error.fieldErrors : {}, names);
  const message = error instanceof ApiClientError ? error.message : "Something went wrong. Please try again.";
  return {fields, message: general || (Object.keys(fields).length ? "" : message)};
}

function ProfileDetails({profile, onSaved, onSessionExpired}: Pick<ProfileProps, "onSessionExpired"> & {profile: Profile; onSaved: (profile: Profile) => void}) {
  const [draft, setDraft] = useState(() => profileDraft(profile));
  const [saving, setSaving] = useState(false);
  const mobile = useMobilePrompt();
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [needsReverification, setNeedsReverification] = useState(false);
  async function verifyEmail(send: boolean) {
    setSaving(true);
    setError("");
    try {
      if (send) {
        await apiRequest("/account/email/code", {method: "POST", body: {}});
        setEmailCodeSent(true);
        toast.success("Email verification code sent.");
      } else {
        await apiRequest("/account/email/verify", {method: "POST", body: {code: emailCode}});
        onSaved(await apiRequest<Profile>("/account/profile"));
        setEmailCode("");
        toast.success("Email verified.");
      }
    } catch (cause) {setError(cause instanceof Error ? cause.message : "Could not verify your email.");}
    finally {setSaving(false);}
  }
  const media = useMediaDrafts();
  const [useDetected, setUseDetected] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const id = useId();
  const {place, status: locationStatus, locate} = useSiteLocation();
  const detected = [...new Set([place?.area, place?.city || place?.state, countryName(place?.countryCode)].filter(Boolean))].join(", ").slice(0, 160);
  const location = useDetected && detected ? detected : draft.location;
  const before = profileDraft(profile);
  const values = {...draft, fullName: draft.fullName.trim(), aboutMe: draft.aboutMe.trim(), location: location.trim()};
  const changes = Object.fromEntries(Object.entries(values)
    .filter(([key, value]) => value !== before[key as keyof typeof before])
    .map(([key, value]) => [key, value || null]));

  function update(name: keyof typeof draft, value: string) {
    setDraft((current) => ({...current, [name]: value}));
    setErrors((current) => ({...current, [name]: ""}));
  }

  async function verifyNumber() {
    if (!await mobile.verify({mode: "profile", identity: {phone: draft.phone}})) return;
    try {
      const saved = await apiRequest<Profile>("/account/profile");
      setDraft((current) => ({...current, phone: saved.phone ?? ""}));
      setErrors((current) => ({...current, phone: ""}));
      onSaved(saved);
      toast.success("Mobile number verified.");
    } catch (failure) {setError(failure instanceof Error ? failure.message : "Could not refresh your profile.");}
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (saving || !Object.keys(changes).length) return;
    setError("");
    if (values.fullName.length < 2) {
      setErrors({fullName: "Enter at least 2 characters."});
      focusInvalidControl(form);
      return;
    }
    if (values.phone && changes.phone && !parsePhoneNumberFromString(values.phone, {extract: false})?.isValid()) {
      setErrors({phone: "Enter a valid mobile number for the selected country."});
      focusInvalidControl(form);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = await media.save(changes, (body) => apiRequest<Profile>("/account/profile", {method: "PATCH", body}));
      if (changes.phone !== undefined && profile.phoneVerifiedAt) setNeedsReverification(true);
      media.reset();
      setDraft(profileDraft(saved));
      setUseDetected(false);
      onSaved(saved);
      toast.success("Profile saved.");
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        await onSessionExpired();
        return;
      }
      const result = failure(requestError, ["fullName", "logoUrl", "location", "aboutMe", "phone"]);
      setErrors(result.fields);
      setError(result.message);
      focusInvalidControl(form);
    } finally {
      setSaving(false);
    }
  }

  return <section className={styles.panel} aria-labelledby={`${id}-title`}>
    <div className={styles.panelHeader}><h2 id={`${id}-title`}>Profile details</h2></div>
    <form onSubmit={save} noValidate aria-busy={saving}>
      <fieldset className={styles.profileForm} disabled={saving}>
        {error && <p className={`${styles.formError} ${styles.wideField}`} role="alert">{error}</p>}
        <div className={`${styles.field} ${styles.wideField}`}>
          <span>Profile logo</span>
          <div className={styles.profileLogoRow}>
            <ImageUpload {...inputState(errors, id, "logoUrl")} purpose="account:logoUrl" label="Upload logo" logoPicker maxFiles={1}
              value={draft.logoUrl} onChange={(value) => update("logoUrl", value)} drafts={media} disabled={saving} />
          </div>
          <FieldError id={`${id}-logoUrl`} message={errors.logoUrl} />
        </div>
        <label className={styles.field}>
          <span>Full name</span><MaterialInput {...inputState(errors, id, "fullName")} autoComplete="name" maxLength={100} required value={draft.fullName} onChange={(event) => update("fullName", event.target.value)} />
          <FieldError id={`${id}-fullName`} message={errors.fullName} />
        </label>
        <div className={styles.field}><label>Email address<MaterialInput name="email" type="email" value={profile.email ?? ""} placeholder="Not provided" readOnly /></label>
          {profile.emailVerifiedAt ? <small>Verified email address</small> : profile.email && <>
            {emailCodeSent && <label>Email verification code<MaterialInput value={emailCode} autoComplete="one-time-code" onChange={event => setEmailCode(event.target.value)} /></label>}
            <MuiButton type="button" onClick={() => void verifyEmail(!emailCodeSent)}>{emailCodeSent ? "Confirm email code" : "Verify email address"}</MuiButton>
            {emailCodeSent && <MuiButton type="button" onClick={() => void verifyEmail(true)}>Resend code</MuiButton>}
          </>}
        </div>
        <div className={styles.field}><label htmlFor={`${id}-phone-input`}>Mobile number</label>
          <PhoneInput {...inputState(errors, id, "phone")} name="phone" id={`${id}-phone-input`} value={draft.phone} placeholder="Mobile number" onChange={(value) => update("phone", value)} />
          <FieldError id={`${id}-phone`} message={errors.phone} />
          {(!profile.phoneVerifiedAt || draft.phone !== profile.phone) &&
            <MuiButton type="button" className={styles.profileTextButton} onClick={() => void verifyNumber()}>{needsReverification || (profile.phone && draft.phone !== profile.phone) ? "Reverify mobile number" : "Verify mobile number"}</MuiButton>}
          {profile.phoneVerifiedAt && draft.phone === profile.phone && <small>Verified mobile number</small>}
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-location-input`} className={styles.profileFieldLabel}>Location</label>
          <MaterialInput {...inputState(errors, id, "location")} id={`${id}-location-input`} maxLength={160} placeholder="City, country" value={location}
            onChange={(event) => {setUseDetected(false); update("location", event.target.value);}} />
          <FieldError id={`${id}-location`} message={errors.location} />
          <MuiButton className={styles.profileTextButton} disabled={locationStatus === "loading"} type="button" onClick={() => {
            setUseDetected(true);
            setErrors((current) => ({...current, location: ""}));
            if (!detected) locate();
          }}><LocateFixed size={15} aria-hidden="true" />{useDetected && locationStatus === "loading" ? "Finding location…" : "Use my location"}</MuiButton>
          {(detected || (useDetected && (locationStatus === "denied" || locationStatus === "unavailable"))) && (
            <small role="status">{detected ? `Detected location · ${detected}` : "Location unavailable. Enter your city and country above."}</small>
          )}
        </div>
        <label className={`${styles.field} ${styles.wideField}`}>
          <span>About me</span><MaterialTextarea {...inputState(errors, id, "aboutMe")} rows={4} maxLength={1000} value={draft.aboutMe} onChange={(event) => update("aboutMe", event.target.value)} />
          <FieldError id={`${id}-aboutMe`} message={errors.aboutMe} />
        </label>
        <div className={`${styles.wideField} ${styles.profileActions}`}>
          <UploadProgress progress={media.progress} />
          <MuiButton variant="contained" className={styles.primaryButton} type="submit" disabled={saving || !Object.keys(changes).length}>
            {saving ? <LoaderCircle className={styles.spin} size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}Save profile
          </MuiButton>
        </div>
      </fieldset>
    </form>
    {mobile.dialog}
  </section>;
}

const passwordLabels = {currentPassword: "Current password", newPassword: "New password", confirmNewPassword: "Confirm new password"} as const;
const emptyPasswords = {currentPassword: "", newPassword: "", confirmNewPassword: ""};

function PasswordForm({onSessionExpired}: Pick<ProfileProps, "onSessionExpired">) {
  const [form, setForm] = useState(emptyPasswords);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const id = useId();

  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    if (saving) return;
    const issues: Record<string, string> = {};
    if (!form.currentPassword) issues.currentPassword = "Enter your current password.";
    if (form.newPassword.length < 10) issues.newPassword = "Use at least 10 characters.";
    else if (form.newPassword === form.currentPassword) issues.newPassword = "Choose a different password.";
    if (!form.confirmNewPassword) issues.confirmNewPassword = "Confirm your new password.";
    else if (form.confirmNewPassword !== form.newPassword) issues.confirmNewPassword = "Passwords do not match.";
    setErrors(issues);
    setError("");
    if (Object.keys(issues).length) {
      focusInvalidControl(element);
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/account/password", {method: "POST", body: form});
      setForm(emptyPasswords);
      toast.success("Password changed. Other sessions were signed out.");
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        await onSessionExpired();
        return;
      }
      const result = failure(requestError, Object.keys(passwordLabels));
      setErrors(result.fields);
      setError(result.message);
      focusInvalidControl(element);
    } finally {
      setSaving(false);
    }
  }

  return <section className={styles.panel} aria-labelledby={`${id}-title`}>
    <div className={styles.panelHeader}><h2 id={`${id}-title`}>Change password</h2></div>
    <form onSubmit={change} noValidate aria-busy={saving}>
      <fieldset className={styles.passwordForm} disabled={saving}>
        {error && <p className={styles.formError} role="alert">{error}</p>}
        {(Object.keys(passwordLabels) as (keyof typeof passwordLabels)[]).map((name) => (
          <label className={styles.field} key={name}>
            <span>{passwordLabels[name]}</span>
            <MaterialInput {...inputState(errors, id, name)} autoComplete={name === "currentPassword" ? "current-password" : "new-password"} type="password" maxLength={128}
              value={form[name]} required onChange={(event) => {
                setForm((current) => ({...current, [name]: event.target.value}));
                setErrors((current) => ({...current, [name]: "", ...(name === "newPassword" ? {confirmNewPassword: ""} : {})}));
              }} />
            <FieldError id={`${id}-${name}`} message={errors[name]} />
            {name === "newPassword" && !errors[name] && <small>Use at least 10 characters.</small>}
          </label>
        ))}
        <div className={styles.profileActions}>
          <MuiButton variant="contained" className={styles.primaryButton} type="submit" disabled={saving}>
            {saving ? <LoaderCircle className={styles.spin} size={17} aria-hidden="true" /> : <KeyRound size={17} aria-hidden="true" />}Change password
          </MuiButton>
        </div>
      </fieldset>
    </form>
  </section>;
}

export function AccountProfile({onSaved, onSessionExpired}: ProfileProps) {
  const t = useTranslations("Site");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Profile>("/account/profile", {signal: controller.signal})
      .then((data) => {if (!controller.signal.aborted) setProfile(data);})
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        if (requestError instanceof ApiClientError && requestError.status === 401) {
          void onSessionExpired();
          return;
        }
        setError(requestError instanceof ApiClientError ? requestError.message : "Your profile could not be loaded.");
      });
    return () => controller.abort();
  }, [attempt, onSessionExpired]);

  if (error) return <section className={styles.errorState} role="alert">
    <CircleAlert size={26} aria-hidden="true" /><div><h1>Profile unavailable</h1><p>{error}</p></div>
    <MuiButton className={styles.secondaryButton} type="button" onClick={() => {setError(""); setAttempt((current) => current + 1);}}>Try again</MuiButton>
  </section>;
  return <div className={styles.accountProfile}>
    <header className={styles.pageHeading}><div><h1>{t("profile")}</h1><p>Manage your account details and password.</p></div></header>
    <div className={styles.profileLayout}>
      {profile ? <>
        <ProfileDetails profile={profile} onSessionExpired={onSessionExpired} onSaved={(saved) => {setProfile(saved); onSaved(saved);}} />
        <PasswordForm onSessionExpired={onSessionExpired} />
      </> : <div className={styles.panel}><LoadingRows label="Loading profile" count={5} /></div>}
    </div>
  </div>;
}
