"use client";

import {useEffect, useRef, useState, type ComponentProps} from "react";
import type {Editor} from "tinymce";
import "tinymce/skins/ui/oxide/skin.min.css";

export function PropertyEditor({value, onChange, ...attributes}: Omit<ComponentProps<"textarea">, "value" | "onChange"> & {
  value: string;
  onChange: (html: string) => void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const activeEditor = useRef<Editor | null>(null);
  const update = useRef(onChange);
  const [error, setError] = useState(false);
  update.current = onChange;

  useEffect(() => {
    const target = field.current;
    if (!target) return;
    let cancelled = false;
    let editor: Editor | undefined;

    async function initialize() {
      const {default: tinymce} = await import("tinymce");
      await Promise.all([
        import("tinymce/icons/default"), import("tinymce/themes/silver"), import("tinymce/models/dom"),
        import("tinymce/plugins/code"), import("tinymce/plugins/lists"), import("tinymce/plugins/link"),
      ]);
      if (cancelled || !target?.isConnected) return;
      await tinymce.init({
        target, license_key: "gpl", skin: false, content_css: false, min_height: 210, height: 240,
        menubar: false, branding: false, promotion: false, ui_mode: "split",
        plugins: "code lists link", browser_spellcheck: true,
        toolbar_mode: "wrap",
        toolbar: "undo redo | code | blocks | bold italic underline | forecolor backcolor | bullist numlist | link",
        block_formats: "Paragraph=p; Heading 2=h2; Heading 3=h3; Heading 4=h4",
        content_style: "body{font:15px/1.6 system-ui,sans-serif;color:#203a33;padding:0 5px;} li,p{margin-block:0.55em}",
        setup(instance) {
          editor = instance;
          activeEditor.current = instance;
          instance.on("change input undo redo SetContent", () => {
            if (!cancelled && instance.initialized) update.current(instance.getContent());
          });
        },
      });
      if (cancelled) editor?.remove();
    }

    void initialize().catch(() => {
      if (!cancelled) {
        editor?.remove();
        activeEditor.current = null;
        setError(true);
      }
    });
    return () => {cancelled = true; activeEditor.current = null; editor?.remove();};
  }, []);

  useEffect(() => {
    const editor = activeEditor.current;
    if (editor?.initialized && editor.getContent() !== value) editor.setContent(value);
    else if (!editor && field.current && field.current.value !== value) field.current.value = value;
  }, [value]);

  return <>
    <textarea {...attributes} ref={field} rows={6} maxLength={20_000} defaultValue={value} onChange={(event) => onChange(event.target.value)} />
    {error && <small role="status">Rich text controls could not load. You can still edit and save the HTML here.</small>}
  </>;
}
