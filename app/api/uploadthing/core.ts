// app/api/uploadthing/core.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';

const f = createUploadthing();

if (process.env.NODE_ENV !== "production" && !process.env.UPLOADTHING_TOKEN) {
  console.warn("[UploadThing] Falta UPLOADTHING_TOKEN en .env");
}

export const ourFileRouter = {
  // ✅ Subida de LOGO de empresa (imágenes)
  logoUploader: f({
    "image/png": { maxFileSize: "4MB" },
    "image/jpeg": { maxFileSize: "4MB" },
    "image/webp": { maxFileSize: "4MB" },
    "image/svg+xml": { maxFileSize: "1MB" },
  })
    .middleware(async () => {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) throw new Error("UNAUTHORIZED");
      return { userEmail: session.user.email! };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // v9+: usa ufsUrl; mantiene `url` por compatibilidad
      const ufsUrl = (file as any).ufsUrl || (file as any).url;
      return {
        ok: true,
        url: ufsUrl,
        key: file.key,
        name: file.name,
        size: file.size,
        uploadedBy: metadata.userEmail,
      };
    }),

  // ✅ Subida de CV/Resumes (PDF/DOC/DOCX)
  resumeUploader: f({
    "application/pdf": { maxFileSize: "8MB" },
    "application/msword": { maxFileSize: "8MB" }, // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "8MB", // .docx
    },
  })
    .middleware(async () => {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) throw new Error("UNAUTHORIZED");
      return { userEmail: session.user.email! };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const ufsUrl = (file as any).ufsUrl || (file as any).url;
      return {
        ok: true,
        url: ufsUrl,
        key: file.key,
        name: file.name,
        size: file.size,
        uploadedBy: metadata.userEmail,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
