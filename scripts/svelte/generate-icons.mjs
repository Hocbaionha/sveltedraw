// Codegen: parse packages/excalidraw/components/icons.tsx and emit a static
// SVG-string map at packages/excalidraw-svelte/src/icons/icons.ts.
//
// Skips:
//  - non-`createIcon` exports (helpers, type aliases, theme-dependent
//    React.memo wrappers, arrowhead `flip` wrappers, `emptyIcon` div).
// Resolves:
//  - identifier args that point to local JSX const (e.g. arrownNarrowUpJSX),
//  - identifier opts (tablerIconProps) and `{ ...tablerIconProps, ... }` spreads.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SOURCE = path.join(
  REPO_ROOT,
  "packages",
  "excalidraw",
  "components",
  "icons.tsx",
);
const OUTPUT = path.join(
  REPO_ROOT,
  "packages",
  "excalidraw-svelte",
  "src",
  "icons",
  "icons.ts",
);

// ----- attribute name conversions (React JSX → SVG/HTML) ---------------------

// SVG attributes that have a kebab-case form on the wire. React accepts both
// camelCase and kebab-case in JSX; we always emit kebab-case.
const KEBAB_ATTRS = new Set([
  "strokeWidth",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeMiterlimit",
  "strokeOpacity",
  "fillOpacity",
  "fillRule",
  "clipPath",
  "clipRule",
  "stopColor",
  "stopOpacity",
  "textAnchor",
  "dominantBaseline",
  "alignmentBaseline",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "wordSpacing",
  "vectorEffect",
  "pointerEvents",
  "shapeRendering",
  "colorInterpolation",
  "colorInterpolationFilters",
  "floodColor",
  "floodOpacity",
  "lightingColor",
  "markerEnd",
  "markerMid",
  "markerStart",
  "writingMode",
]);

// React-only attribute names → SVG/HTML names.
const RENAME_ATTRS = {
  className: "class",
  htmlFor: "for",
  xmlnsXlink: "xmlns:xlink",
  xlinkHref: "xlink:href",
};

// Attributes that retain their (sometimes camelCase) SVG-spec name.
// These are NOT in KEBAB_ATTRS but ARE valid SVG attribute names.
const PASS_THROUGH_CAMEL = new Set([
  "viewBox",
  "preserveAspectRatio",
  "maskUnits",
  "maskContentUnits",
  "patternUnits",
  "patternContentUnits",
  "gradientUnits",
  "gradientTransform",
  "spreadMethod",
  "tableValues",
  "stdDeviation",
  "baseFrequency",
  "numOctaves",
  "kernelMatrix",
  "edgeMode",
  "primitiveUnits",
  "filterUnits",
  "filterRes",
  "lengthAdjust",
  "textLength",
]);

const camelToKebab = (name) =>
  name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

const convertAttrName = (name) => {
  if (RENAME_ATTRS[name]) return RENAME_ATTRS[name];
  if (KEBAB_ATTRS.has(name)) return camelToKebab(name);
  if (PASS_THROUGH_CAMEL.has(name)) return name;
  if (name.startsWith("data-") || name.startsWith("aria-")) return name;
  return name;
};

// CSS property camelCase → kebab-case for inline `style` objects.
const cssKebab = (key) => {
  if (key.startsWith("--")) return key; // CSS custom property
  if (key === "WebkitFontSmoothing") return "-webkit-font-smoothing";
  return key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
};

// HTML attribute escape.
const escapeAttr = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");

const escapeText = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ----- AST helpers ----------------------------------------------------------

const program = ts.createSourceFile(
  "icons.tsx",
  fs.readFileSync(SOURCE, "utf8"),
  ts.ScriptTarget.Latest,
  /*setParentNodes*/ true,
  ts.ScriptKind.TSX,
);

// Build a map of top-level const identifiers → initializer node so we can
// resolve identifier references in createIcon arguments.
const topLevelConsts = new Map();
for (const stmt of program.statements) {
  if (
    ts.isVariableStatement(stmt) &&
    stmt.declarationList.flags & ts.NodeFlags.Const
  ) {
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.initializer) {
        topLevelConsts.set(decl.name.text, decl.initializer);
      }
    }
  }
}

// Resolve a JSX node, evaluating any wrapping ParenthesizedExpression.
const unwrap = (node) => {
  while (node && ts.isParenthesizedExpression(node)) {
    node = node.expression;
  }
  return node;
};

// Evaluate a JS expression node to a literal value (string, number, boolean,
// or { kind: "expr", text }). Returns { value, ok } — ok=false signals an
// expression we cannot bake (e.g. function call, ternary on runtime input).
const evalExpr = (node) => {
  node = unwrap(node);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { value: node.text, ok: true };
  }
  if (ts.isNumericLiteral(node)) {
    return { value: Number(node.text), ok: true };
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return { value: true, ok: true };
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { value: false, ok: true };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { value: null, ok: true };
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken
  ) {
    const inner = evalExpr(node.operand);
    if (inner.ok && typeof inner.value === "number") {
      return { value: -inner.value, ok: true };
    }
  }
  if (ts.isObjectLiteralExpression(node)) {
    const obj = {};
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = ts.isIdentifier(prop.name)
          ? prop.name.text
          : ts.isStringLiteral(prop.name)
            ? prop.name.text
            : null;
        if (!key) return { ok: false, reason: "unsupported object key" };
        const v = evalExpr(prop.initializer);
        if (!v.ok) return v;
        obj[key] = v.value;
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        return { ok: false, reason: "shorthand property" };
      } else if (ts.isSpreadAssignment(prop)) {
        const spread = evalExpr(prop.expression);
        if (!spread.ok) return spread;
        if (spread.value && typeof spread.value === "object") {
          Object.assign(obj, spread.value);
        }
      }
    }
    return { value: obj, ok: true };
  }
  if (ts.isIdentifier(node)) {
    const init = topLevelConsts.get(node.text);
    if (init) return evalExpr(init);
    return { ok: false, reason: `unknown identifier ${node.text}` };
  }
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    return evalExpr(node.expression);
  }
  return {
    ok: false,
    reason: `unsupported expr kind ${ts.SyntaxKind[node.kind]}`,
  };
};

// Render a JSX child to an SVG string. Returns { html, ok }.
const renderJsxNode = (node) => {
  node = unwrap(node);
  if (ts.isJsxFragment(node)) {
    return renderChildren(node.children);
  }
  if (ts.isJsxElement(node)) {
    const open = node.openingElement;
    const tagName = jsxTagName(open.tagName);
    if (!tagName) return { ok: false, reason: "non-identifier JSX tag" };
    const attrsResult = renderAttrs(open.attributes);
    if (!attrsResult.ok) return attrsResult;
    const inner = renderChildren(node.children);
    if (!inner.ok) return inner;
    return {
      ok: true,
      html: `<${tagName}${attrsResult.html}>${inner.html}</${tagName}>`,
    };
  }
  if (ts.isJsxSelfClosingElement(node)) {
    const tagName = jsxTagName(node.tagName);
    if (!tagName) return { ok: false, reason: "non-identifier JSX tag" };
    const attrsResult = renderAttrs(node.attributes);
    if (!attrsResult.ok) return attrsResult;
    return { ok: true, html: `<${tagName}${attrsResult.html}/>` };
  }
  if (ts.isJsxText(node)) {
    const text = node.text.replace(/\s+/g, " ");
    if (text.trim() === "") return { ok: true, html: "" };
    return { ok: true, html: escapeText(text) };
  }
  if (ts.isJsxExpression(node)) {
    if (!node.expression) return { ok: true, html: "" };
    const v = evalExpr(node.expression);
    if (!v.ok) return v;
    if (v.value == null || v.value === false) return { ok: true, html: "" };
    return { ok: true, html: escapeText(String(v.value)) };
  }
  return {
    ok: false,
    reason: `unsupported JSX child kind ${ts.SyntaxKind[node.kind]}`,
  };
};

const jsxTagName = (node) => {
  if (ts.isIdentifier(node)) {
    // Components must start with uppercase; SVG primitives start lowercase.
    // We only support intrinsic SVG/HTML tags.
    if (/^[A-Z]/.test(node.text)) return null;
    return node.text;
  }
  return null;
};

const renderChildren = (children) => {
  let html = "";
  for (const child of children) {
    const r = renderJsxNode(child);
    if (!r.ok) return r;
    html += r.html;
  }
  return { ok: true, html };
};

const renderAttrs = (attrs) => {
  let out = "";
  for (const attr of attrs.properties) {
    if (!ts.isJsxAttribute(attr)) {
      // JsxSpreadAttribute or other — unsupported in icons we accept
      return { ok: false, reason: "JSX spread attribute" };
    }
    const name = attr.name.getText();
    const initializer = attr.initializer;
    let value;
    if (initializer == null) {
      // boolean attr: <path foo />
      out += " " + convertAttrName(name);
      continue;
    }
    if (ts.isStringLiteral(initializer)) {
      value = initializer.text;
    } else if (ts.isJsxExpression(initializer) && initializer.expression) {
      // style={{...}} — convert to css string
      if (
        name === "style" &&
        ts.isObjectLiteralExpression(initializer.expression)
      ) {
        const styleEval = evalExpr(initializer.expression);
        if (!styleEval.ok) return styleEval;
        const css = Object.entries(styleEval.value)
          .map(([k, v]) => `${cssKebab(k)}: ${v}`)
          .join("; ");
        out += ` style="${escapeAttr(css)}"`;
        continue;
      }
      const v = evalExpr(initializer.expression);
      if (!v.ok) return v;
      if (v.value === false || v.value == null) continue;
      if (v.value === true) {
        out += " " + convertAttrName(name);
        continue;
      }
      value = String(v.value);
    } else {
      return { ok: false, reason: "unsupported JSX attr initializer" };
    }
    out += ` ${convertAttrName(name)}="${escapeAttr(value)}"`;
  }
  return { ok: true, html: out };
};

// ----- createIcon body resolution -------------------------------------------

// Render the first arg of createIcon. Supports:
//  - string literal `"M0 0..."`     → wraps in <path fill="currentColor" d="..."/>
//  - JSX element/fragment            → renders children
//  - identifier referencing const JSX (arrownNarrowUpJSX) → resolve & render
const renderIconBody = (arg) => {
  arg = unwrap(arg);
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
    return {
      ok: true,
      html: `<path fill="currentColor" d="${escapeAttr(arg.text)}"/>`,
    };
  }
  if (
    ts.isJsxElement(arg) ||
    ts.isJsxSelfClosingElement(arg) ||
    ts.isJsxFragment(arg)
  ) {
    return renderJsxNode(arg);
  }
  if (ts.isIdentifier(arg)) {
    const init = topLevelConsts.get(arg.text);
    if (init) return renderIconBody(init);
    return { ok: false, reason: `unresolved identifier body ${arg.text}` };
  }
  return {
    ok: false,
    reason: `unsupported body kind ${ts.SyntaxKind[arg.kind]}`,
  };
};

// Resolve the second arg (opts) of createIcon. Supports:
//  - omitted                       → { width: 512 }
//  - numeric literal               → { width: N }
//  - identifier (tablerIconProps)  → resolve via topLevelConsts
//  - object literal w/ spreads
const resolveOpts = (arg) => {
  if (arg == null) return { value: { width: 512 }, ok: true };
  arg = unwrap(arg);
  if (ts.isNumericLiteral(arg)) {
    return { value: { width: Number(arg.text) }, ok: true };
  }
  return evalExpr(arg);
};

// ----- main extract loop ----------------------------------------------------

const icons = {};
const skipped = [];

for (const stmt of program.statements) {
  if (
    !ts.isVariableStatement(stmt) ||
    !stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  ) {
    continue;
  }
  for (const decl of stmt.declarationList.declarations) {
    if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
    const name = decl.name.text;
    const init = unwrap(decl.initializer);

    // Aliases: `export const X = otherIcon;`
    if (ts.isIdentifier(init) && icons[init.text]) {
      icons[name] = icons[init.text];
      continue;
    }

    // Only static: `export const X = createIcon(body, opts?)`
    if (
      !ts.isCallExpression(init) ||
      !ts.isIdentifier(init.expression) ||
      init.expression.text !== "createIcon"
    ) {
      // record so we can verify dynamic-icon list is what we expect
      skipped.push({ name, reason: "not a direct createIcon call" });
      continue;
    }

    const [bodyArg, optsArg] = init.arguments;
    const optsResult = resolveOpts(optsArg);
    if (!optsResult.ok) {
      skipped.push({ name, reason: `opts: ${optsResult.reason}` });
      continue;
    }
    const opts = optsResult.value;

    const bodyResult = renderIconBody(bodyArg);
    if (!bodyResult.ok) {
      skipped.push({ name, reason: `body: ${bodyResult.reason}` });
      continue;
    }

    // Build outer <svg>. createIcon defaults: width=512, height=width.
    const width = opts.width ?? 512;
    const height = opts.height ?? width;
    const mirror = opts.mirror === true;

    // Forward standard SVG props from opts (excluding width/height/mirror/style).
    const SVG_OPT_KEYS = [
      "fill",
      "stroke",
      "strokeWidth",
      "strokeLinecap",
      "strokeLinejoin",
      "strokeMiterlimit",
      "strokeDasharray",
      "strokeOpacity",
      "fillOpacity",
      "fillRule",
      "clipPath",
      "opacity",
      "transform",
    ];
    let attrs = "";
    for (const k of SVG_OPT_KEYS) {
      if (k in opts && opts[k] != null && opts[k] !== false) {
        attrs += ` ${convertAttrName(k)}="${escapeAttr(opts[k])}"`;
      }
    }
    if (opts.style && typeof opts.style === "object") {
      const css = Object.entries(opts.style)
        .map(([k, v]) => `${cssKebab(k)}: ${v}`)
        .join("; ");
      attrs += ` style="${escapeAttr(css)}"`;
    }

    const klass = mirror ? ` class="rtl-mirror"` : "";
    const svg =
      `<svg aria-hidden="true" focusable="false" role="img"` +
      ` viewBox="0 0 ${width} ${height}"${klass}${attrs}>` +
      bodyResult.html +
      `</svg>`;

    icons[name] = { svg, mirror, width, height };
  }
}

// ----- emit -----------------------------------------------------------------

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

const header = `// AUTO-GENERATED by scripts/svelte/generate-icons.mjs from
// packages/excalidraw/components/icons.tsx — do not edit by hand.
// Regenerate with: node scripts/svelte/generate-icons.mjs

export type IconDef = {
  svg: string;
  mirror: boolean;
  width: number;
  height: number;
};

export const icons: Record<string, IconDef> = `;

const body =
  "{\n" +
  Object.entries(icons)
    .map(
      ([name, def]) =>
        `  ${JSON.stringify(name)}: { svg: ${JSON.stringify(def.svg)}, mirror: ${def.mirror}, width: ${def.width}, height: ${def.height} },`,
    )
    .join("\n") +
  "\n};\n";

fs.writeFileSync(OUTPUT, header + body, "utf8");

// ----- report ---------------------------------------------------------------

console.log(`generated ${Object.keys(icons).length} icons → ${OUTPUT}`);
console.log(`skipped ${skipped.length} declarations:`);
for (const s of skipped) {
  console.log(`  - ${s.name}: ${s.reason}`);
}
