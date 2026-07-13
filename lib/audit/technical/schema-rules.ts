/** Lightweight JSON-LD validation — required fields per common @type values. */

const REQUIRED_FIELDS: Record<string, string[]> = {
  FAQPage: ["mainEntity"],
  Organization: ["name"],
  LocalBusiness: ["name"],
  WebPage: ["name"],
  WebSite: ["name"],
  Article: ["headline"],
  BlogPosting: ["headline"],
  Product: ["name"],
  BreadcrumbList: ["itemListElement"],
  Person: ["name"],
};

function collectTypes(node: unknown, types: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, types);
    return;
  }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  if (typeof t === "string") types.add(t);
  else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));

  if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"]) collectTypes(item, types);
  }
}

function hasField(node: unknown, field: string): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((item) => hasField(item, field));
  const obj = node as Record<string, unknown>;
  const val = obj[field];
  if (val !== undefined && val !== null && val !== "") return true;
  if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    return obj["@graph"].some((item) => hasField(item, field));
  }
  return false;
}

export function validateJsonLdBlock(raw: string): {
  types: string[];
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch {
    return { types: [], valid: false, errors: ["Invalid JSON-LD syntax"] };
  }

  const types = new Set<string>();
  collectTypes(data, types);

  if (types.size === 0) {
    errors.push("JSON-LD block has no @type");
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (!obj["@context"]) {
      errors.push("Missing @context");
    }
  }

  for (const type of types) {
    const required = REQUIRED_FIELDS[type];
    if (!required) continue;
    for (const field of required) {
      if (!hasField(data, field)) {
        errors.push(`${type} missing required property "${field}"`);
      }
    }
  }

  return {
    types: [...types],
    valid: errors.length === 0,
    errors,
  };
}
