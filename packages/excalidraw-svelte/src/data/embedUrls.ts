// Allowlist for paste-to-embed (B3). Keep narrow — embed elements render
// as iframes, so any host added here can serve content into the editor.

const PATTERNS: readonly RegExp[] = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=/i,
  /^https?:\/\/(www\.)?youtu\.be\//i,
  /^https?:\/\/(www\.)?vimeo\.com\/\d+/i,
  /^https?:\/\/(www\.)?codepen\.io\//i,
  /^https?:\/\/excalidraw\.com\//i,
  /^https?:\/\/plus\.excalidraw\.com\//i,
];

export const isEmbeddableUrl = (text: string): boolean =>
  PATTERNS.some((re) => re.test(text.trim()));
