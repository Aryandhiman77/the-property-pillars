"use client";

import { useEffect, useState } from "react";
import { WorkspaceForm, type WorkspaceMutation } from "./workspace-form";
import type { ComponentProps } from "react";

import {
  readFiles,
  removeListingDraft,
  type LocalFiles,
} from "./listing-file-storage";

export function LocalListingForm({
  storageKey,
  sourceKey,
  ...props
}: ComponentProps<typeof WorkspaceForm> & {
  storageKey: string;
  sourceKey?: string;
}) {
  const [loaded, setLoaded] = useState<{
    draft?: WorkspaceMutation;
    files: LocalFiles;
  }>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    (async () => {
      let draft: WorkspaceMutation | undefined;
      let files: LocalFiles = [];
      try {
        const raw = sourceKey ? null : localStorage.getItem(storageKey);
        const candidate = raw ? JSON.parse(raw) : undefined;
        if (
          typeof candidate?.title === "string" &&
          candidate.data &&
          typeof candidate.data === "object"
        )
          draft = candidate;
        if (sourceKey) draft = props.publicTask?.initial;
        if (draft) files = await readFiles(sourceKey ?? storageKey);
      } catch {
        /* The form also works when browser storage is unavailable. */
      }
      if (active) setLoaded({ draft, files });
    })();
    return () => {
      active = false;
    };
  }, [storageKey, sourceKey, props.publicTask?.initial]);
  if (!loaded || !props.publicTask)
    return <p aria-busy="true">Opening listing form…</p>;
  function clear() {
    if (new URLSearchParams(window.location.search).has("draft")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("draft");
      void removeListingDraft(storageKey).finally(() =>
        window.location.replace(url),
      );
      return;
    }
    void removeListingDraft(storageKey);
    setLoaded({ files: [] });
    setRevision((n) => n + 1);
  }
  return (
    <WorkspaceForm
      key={revision}
      {...props}
      localListing={{
        storageKey,
        files: loaded.files,
        initial: revision
          ? {
              title: "",
              data: {
                listingIntent: "SALE",
                listingKind: "Individual property",
                propertyCategory: new URLSearchParams(window.location.search).get("category") === "COMMERCIAL" ? "COMMERCIAL" : "RESIDENTIAL",
                areaUnit: "SQFT",
              },
            }
          : loaded.draft,
        onClear: clear,
      }}
    />
  );
}
