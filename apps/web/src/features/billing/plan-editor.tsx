"use client";

import {MaterialTextarea} from "@/components/ui/material-fields";
import { useEffect, useRef, useState } from "react";
import type { ClassicEditor } from "ckeditor5";
import "ckeditor5/ckeditor5.css";

export default function PlanEditor({
  initial,
  onChange,
}: {
  initial: string;
  onChange: (value: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let editor: ClassicEditor | undefined;
    const source = document.createElement("div");
    element.appendChild(source);
    void import("ckeditor5")
      .then(
        async ({
          ClassicEditor,
          Essentials,
          Paragraph,
          Heading,
          Bold,
          Italic,
          Link,
          List,
        }) => {
          if (cancelled) return;
          const instance = await ClassicEditor.create({
            attachTo: source,
            initialData: initial,
            licenseKey: process.env.NEXT_PUBLIC_CKEDITOR_LICENSE_KEY || "GPL",
            plugins: [Essentials, Paragraph, Heading, Bold, Italic, Link, List],
            toolbar: [
              "heading",
              "|",
              "bold",
              "italic",
              "link",
              "bulletedList",
              "numberedList",
              "|",
              "undo",
              "redo",
            ],
          });
          if (cancelled) {
            await instance.destroy();
            return;
          }
          editor = instance;
          editor.editing.view.change((writer) =>
            writer.setAttribute(
              "aria-label",
              "About plan",
              editor!.editing.view.document.getRoot()!,
            ),
          );
          editor.model.document.on("change:data", () =>
            change.current(instance.getData()),
          );
        },
      )
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      void editor?.destroy();
      source.remove();
    };
  }, [initial]);
  return (
    <>
      <div ref={host} />
      {failed && (
        <MaterialTextarea
          aria-label="About plan"
          defaultValue={initial}
          onChange={(event) => change.current(event.target.value)}
        />
      )}
    </>
  );
}
