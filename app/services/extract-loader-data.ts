import { type TypedResponse } from "@remix-run/node";
// Utility type that extracts the data type from a Remix loader's return type
export type ExtractLoaderData<T> = T extends (...args: any[]) => Promise<TypedResponse<infer U>> ? U : never;

// Apply the utility type to your specific loader
// export type LoaderData = ExtractLoaderData<typeof loader>;
