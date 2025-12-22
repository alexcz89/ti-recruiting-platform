// lib/uploadthing.ts
import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

export { UploadButton, UploadDropzone } from "@uploadthing/react";

// Generate typed helpers for useUploadThing hook
export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
