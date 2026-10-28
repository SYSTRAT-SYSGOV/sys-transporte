#!/usr/bin/env node
/**
 * Gera os tipos TypeScript do cliente a partir do OpenAPI da API.
 *
 * Uso:
 *   node scripts/gen-api-types.mjs                     # lê docs/api/openapi.json
 *   node scripts/gen-api-types.mjs --url http://localhost:8080/api/v1/openapi.json
 *   node scripts/gen-api-types.mjs --check             # falha se houver divergência
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const check = args.includes("--check");
const file = flag("--file", "docs/api/openapi.json");
const url = flag("--url", null);
const out = flag("--out", "frontend/src/api/generated.ts");

let document;
if (url) {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Falha ao buscar OpenAPI em ${url}: ${response.status}`);
    process.exit(1);
  }
  document = await response.json();
  await writeFile(file, `${JSON.stringify(document, null, 2)}\n`, "utf8");
} else {
  document = JSON.parse(await readFile(file, "utf8"));
}

const refName = (ref) => ref.split("/").pop();

function tsType(schema) {
  if (!schema) return "unknown";
  if (schema.$ref) return refName(schema.$ref);
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  }
  switch (schema.type) {
    case "array":
      return `${tsType(schema.items)}[]`;
    case "object": {
      const properties = schema.properties ?? {};
      const keys = Object.keys(properties);
      if (keys.length === 0) return "Record<string, unknown>";
      const body = keys
        .map((key) => `    ${key}${schema.required?.includes(key) ? "" : "?"}: ${tsType(properties[key])};`)
        .join("\n");
      return `{\n${body}\n  }`;
    }
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "string":
      return "string";
    default:
      return "unknown";
  }
}

function renderSchema(name, schema) {
  if (!schema.properties) {
    return `export type ${name} = ${tsType(schema)};\n`;
  }
  const required = new Set(schema.required ?? []);
  const lines = Object.keys(schema.properties).map((key) => {
    const property = schema.properties[key];
    let type = tsType(property);
    if (property.nullable) {
      type = `${type} | null`;
    }
    const optional = required.has(key) ? "" : "?";
    return `  ${key}${optional}: ${type};`;
  });
  return `export interface ${name} {\n${lines.join("\n")}\n}\n`;
}

const schemas = document.components?.schemas ?? {};
const names = Object.keys(schemas).sort();
const schemaBlock = names.map((name) => renderSchema(name, schemas[name])).join("\n");

const paths = Object.keys(document.paths ?? {}).sort();
const pathBlock = `${paths.map((value) => `  ${JSON.stringify(value)}`).join(",\n")}`;

const content = `// Arquivo gerado por scripts/gen-api-types.mjs a partir de ${path.basename(file)}.
// Não edite manualmente: rode o gerador novamente.

${schemaBlock}
export const API_PATHS = [
${pathBlock}
] as const;

export type ApiPath = (typeof API_PATHS)[number];
`;

if (check) {
  let current = "";
  try {
    current = await readFile(out, "utf8");
  } catch {
    console.error(`Arquivo ${out} não encontrado; rode o gerador.`);
    process.exit(1);
  }
  if (current !== content) {
    console.error(`Tipos desatualizados em ${out}. Rode node scripts/gen-api-types.mjs.`);
    process.exit(1);
  }
  console.log(`Tipos em dia (${names.length} schemas, ${paths.length} endpoints).`);
} else {
  await writeFile(out, content, "utf8");
  console.log(`Gerado ${out} com ${names.length} schemas e ${paths.length} endpoints.`);
}
