import type { DataAdapter } from "@open-dashboard/shared/types";
import type { AdapterRegistry as IAdapterRegistry } from "../types/parser";

export class AdapterRegistry implements IAdapterRegistry {
  private adapters = new Map<string, DataAdapter>();
  private extensionMap = new Map<string, string>();
  private mimeTypeMap = new Map<string, string>();

  register(name: string, adapter: DataAdapter): void {
    this.adapters.set(name, adapter);

    const supportedTypes = adapter.getSupportedTypes();
    supportedTypes.forEach((type) => {
      if (type.startsWith(".")) {
        this.extensionMap.set(type.toLowerCase(), name);
      } else if (type.includes("/")) {
        this.mimeTypeMap.set(type.toLowerCase(), name);
      }
    });
  }

  get(name: string): DataAdapter | undefined {
    return this.adapters.get(name);
  }

  getByFileExtension(extension: string): DataAdapter | undefined {
    const normalized = extension.toLowerCase().startsWith(".")
      ? extension.toLowerCase()
      : `.${extension.toLowerCase()}`;

    const adapterName = this.extensionMap.get(normalized);
    return adapterName ? this.adapters.get(adapterName) : undefined;
  }

  getByMimeType(mimeType: string): DataAdapter | undefined {
    const normalized = mimeType.toLowerCase();
    const adapterName = this.mimeTypeMap.get(normalized);
    return adapterName ? this.adapters.get(adapterName) : undefined;
  }

  list(): string[] {
    return Array.from(this.adapters.keys());
  }
}

export const defaultRegistry = new AdapterRegistry();
