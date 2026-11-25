// Only remove complete flagged excerpts. A place name may contain the same letters.
export function removeFlaggedText(value: string, excerpts: string[], html: boolean) {
  const clean = (text: string) => {
    for (const excerpt of excerpts) {
      const escaped = excerpt.replace(/[.*+?^{}()|[\]\\]/g, "\\$&");
      const word = "[\\p{L}\\p{M}\\p{N}]";
      const start = /^[\p{L}\p{M}\p{N}]/u.test(excerpt) ? "(?<!" + word + ")" : "";
      const end = /[\p{L}\p{M}\p{N}]$/u.test(excerpt) ? "(?!" + word + ")" : "";
      text = text.replace(new RegExp(start + escaped + end, "gu"), "");
    }
    return text;
  };
  if (!html) return clean(value).trim();
  const template = document.createElement("template");
  template.innerHTML = value;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) walker.currentNode.textContent = clean(walker.currentNode.textContent ?? "");
  return template.innerHTML;
}

