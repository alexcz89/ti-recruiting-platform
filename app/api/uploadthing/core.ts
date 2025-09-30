// app/api/uploadthing/core.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const f = createUploadthing();

if (process.env.NODE_ENV !== "production" && !process.env.UPLOADTHING_TOKEN) {
  console.warn("[UploadThing] Falta UPLOADTHING_TOKEN en .env");
}

export const ourFileRouter = {
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
      return {
        ok: true,
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
        uploadedBy: metadata.userEmail,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
