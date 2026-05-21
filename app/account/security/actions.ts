"use server";

import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

const passwordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .max(100, "La contraseña no puede exceder 100 caracteres")
      .refine((password) => /[A-Z]/.test(password), {
        message: "Incluye al menos una mayúscula",
      })
      .refine((password) => /[a-z]/.test(password), {
        message: "Incluye al menos una minúscula",
      })
      .refine((password) => /[0-9]/.test(password), {
        message: "Incluye al menos un número",
      }),
    confirmPassword: z.string().min(1, "Confirma tu contraseña"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type PasswordActionState = {
  ok: boolean;
  message: string;
  hasPassword?: boolean;
  fieldErrors?: {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
};

export async function updateAccountPassword(
  _prevState: PasswordActionState | null,
  formData: FormData
): Promise<PasswordActionState> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return { ok: false, message: "Inicia sesión para actualizar tu contraseña." };
  }

  const parsed = passwordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: {
        currentPassword: flattened.currentPassword?.[0],
        newPassword: flattened.newPassword?.[0],
        confirmPassword: flattened.confirmPassword?.[0],
      },
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, role: true },
  });

  if (!user) {
    return { ok: false, message: "No encontramos tu cuenta." };
  }

  if (user.passwordHash) {
    const currentPassword = parsed.data.currentPassword?.trim();
    if (!currentPassword) {
      return {
        ok: false,
        message: "Ingresa tu contraseña actual.",
        fieldErrors: { currentPassword: "Ingresa tu contraseña actual." },
        hasPassword: true,
      };
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      return {
        ok: false,
        message: "La contraseña actual no es correcta.",
        fieldErrors: { currentPassword: "La contraseña actual no es correcta." },
        hasPassword: true,
      };
    }
  }

  if (user.passwordHash) {
    const samePassword = await bcrypt.compare(
      parsed.data.newPassword,
      user.passwordHash
    );
    if (samePassword) {
      return {
        ok: false,
        message: "La nueva contraseña debe ser diferente a la actual.",
        fieldErrors: {
          newPassword: "La nueva contraseña debe ser diferente a la actual.",
        },
        hasPassword: true,
      };
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  revalidatePath("/profile/summary");
  revalidatePath("/dashboard/profile");

  return {
    ok: true,
    message: user.passwordHash
      ? "Contraseña actualizada correctamente."
      : "Contraseña creada correctamente. Ya puedes entrar con email y contraseña.",
    hasPassword: true,
  };
}
