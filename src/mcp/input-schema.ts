import * as z from "zod/v4";
import type { JobLensToolDefinition } from "../tooling/tool-manifest.js";

interface JsonSchemaLike {
  type?: string;
  properties?: Record<string, JsonSchemaLike>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchemaLike;
  enum?: unknown[];
  const?: unknown;
  minLength?: number;
  minimum?: number;
  maximum?: number;
}

function literal(value: unknown): z.ZodTypeAny {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return z.literal(value);
  }
  throw new Error("unsupported JSON-schema const/enum literal");
}

function fromJsonSchema(schema: JsonSchemaLike): z.ZodTypeAny {
  if (Object.prototype.hasOwnProperty.call(schema, "const")) return literal(schema.const);

  if (schema.enum?.length) {
    const values = schema.enum;
    if (values.length === 1) return literal(values[0]);
    return z.union(values.map((value) => literal(value)) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  if (schema.type === "string") {
    let value = z.string();
    if (schema.minLength !== undefined) value = value.min(schema.minLength);
    return value;
  }

  if (schema.type === "integer") {
    let value = z.number().int();
    if (schema.minimum !== undefined) value = value.min(schema.minimum);
    if (schema.maximum !== undefined) value = value.max(schema.maximum);
    return value;
  }

  if (schema.type === "boolean") return z.boolean();

  if (schema.type === "array") {
    return z.array(fromJsonSchema(schema.items ?? {}));
  }

  if (schema.type === "object") {
    const required = new Set(schema.required ?? []);
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [name, propertySchema] of Object.entries(schema.properties ?? {})) {
      const property = fromJsonSchema(propertySchema);
      shape[name] = required.has(name) ? property : property.optional();
    }
    const object = z.object(shape);
    return schema.additionalProperties === false ? object.strict() : object.passthrough();
  }

  return z.unknown();
}

export function getMcpInputSchema(definition: JobLensToolDefinition): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const schema = fromJsonSchema(definition.inputSchema as JsonSchemaLike);
  if (!(schema instanceof z.ZodObject)) {
    throw new Error(`MCP tool ${definition.name} must expose an object input schema`);
  }
  return schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
}
