import { CSVAdapter } from "./adapters/csvAdapter";
import { JSONAdapter } from "./adapters/jsonAdapter";
import { defaultRegistry } from "./registry/AdapterRegistry";

// Register default adapters
defaultRegistry.register("csv", new CSVAdapter());
defaultRegistry.register("json", new JSONAdapter());

// Export everything
export { CSVAdapter, DataParsingError } from "./adapters/csvAdapter";
export { JSONAdapter } from "./adapters/jsonAdapter";
export { AdapterRegistry, defaultRegistry } from "./registry/AdapterRegistry";

export * from "./utils/typeInference";
export * from "./utils/schemaBuilder";
export * from "./types/parser";

// Convenience function
export async function parseData(
  input: string | File | URL,
  adapterName?: string,
  options?: import("./types/parser").ParserOptions
) {
  let adapter;

  if (adapterName) {
    adapter = defaultRegistry.get(adapterName);
  } else if (input instanceof File) {
    const ext = input.name.split(".").pop();
    adapter = ext ? defaultRegistry.getByFileExtension(ext) : undefined;
  }

  if (!adapter) {
    throw new Error("No suitable adapter found for the input");
  }

  return adapter.parse(input, options);
}
