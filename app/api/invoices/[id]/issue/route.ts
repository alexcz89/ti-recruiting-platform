// app/api/invoices/[id]/issue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId, getSessionOrThrow } from "@/lib/session";
import { InvoiceStatus } from "@prisma/client";

const FACTURACOM_PLUGIN =
  process.env.FACTURACOM_PLUGIN_TOKEN ?? "9d4095c8f7ed5785cb14c0e3b033eeb8252416ed";

function ensureEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name}`);
  }
  return value;
}

// Convierte Decimal | number a string con 6 decimales como recomienda factura.com
function toAmount6(value: any): string {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : typeof value?.toNumber === "function"
      ? value.toNumber()
      : Number(value ?? 0);

  return num.toFixed(6);
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 1) Seguridad básica: usuario logueado + empresa
    const session = await getSessionOrThrow();
    // @ts-ignore
    const role = session.user?.role as "RECRUITER" | "ADMIN" | "CANDIDATE" | undefined;

    if (role !== "RECRUITER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companyId = await getSessionCompanyId();
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoiceId = params.id;

    // 2) Cargamos la factura
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    if (invoice.status === InvoiceStatus.ISSUED || invoice.status === InvoiceStatus.CANCELED) {
      return NextResponse.json(
        { error: "La factura ya fue timbrada o cancelada" },
        { status: 400 },
      );
    }

    // 3) Leemos configuración de factura.com desde .env
    const apiBase = (process.env.FACTURACOM_API_BASE_URL ??
      "https://sandbox.factura.com/api") as string;

    const url = `${apiBase.replace(/\/+$/, "")}/v4/cfdi40/create`;

    const apiKey = ensureEnv("FACTURACOM_API_KEY");
    const secretKey = ensureEnv("FACTURACOM_SECRET_KEY");

    const serieId = Number(ensureEnv("FACTURACOM_SERIE_ID")); // ID numérico de serie de factura.com
    const receptorUid = ensureEnv("FACTURACOM_RECEPTOR_UID"); // UID del cliente en factura.com
    const emisorRegimen = Number(
      process.env.FACTURACOM_EMISOR_REGIMEN ?? "601", // General de Ley PM
    );

    const defaultUsoCfdi = process.env.FACTURACOM_DEFAULT_USO_CFDI ?? "G03";
    const defaultFormaPago = process.env.FACTURACOM_DEFAULT_FORMA_PAGO ?? "03"; // Transferencia
    const defaultMetodoPago = process.env.FACTURACOM_DEFAULT_METODO_PAGO ?? "PUE";

    const claveProdServ = ensureEnv("FACTURACOM_DEFAULT_CLAVEPRODSERV"); // p.ej. 81112101
    const claveUnidad = ensureEnv("FACTURACOM_DEFAULT_CLAVE_UNIDAD"); // p.ej. E48
    const unidad = process.env.FACTURACOM_DEFAULT_UNIDAD ?? "Servicio";

    const usoCfdi = invoice.cfdiUse || defaultUsoCfdi;
    const formaPago = invoice.paymentForm || defaultFormaPago;
    const metodoPago = invoice.paymentMethod || defaultMetodoPago;
    const moneda = invoice.currency === "USD" ? "USD" : "MXN";

    // 4) Armamos el payload con un solo concepto (tu suscripción / plan)
    const subtotalStr = toAmount6(invoice.subtotal);
    const taxStr = toAmount6(invoice.tax);
    const totalStr = toAmount6(invoice.total);

    const payload = {
      Receptor: {
        UID: receptorUid,
      },
      TipoDocumento: "factura",
      RegimenFiscal: emisorRegimen,
      Conceptos: [
        {
          ClaveProdServ: claveProdServ,
          Cantidad: 1,
          ClaveUnidad: claveUnidad,
          Unidad: unidad,
          ValorUnitario: subtotalStr,
          Descripcion:
            invoice.series && invoice.folio
              ? `Servicio Bolsa TI ${invoice.series}-${invoice.folio}`
              : `Servicio Bolsa TI para ${invoice.customerName}`,
          ObjetoImp: "02", // objeto gravado
          Impuestos: {
            Traslados: [
              {
                Base: subtotalStr,
                Impuesto: "002", // IVA
                TipoFactor: "Tasa",
                TasaOCuota: "0.16",
                Importe: taxStr,
              },
            ],
          },
        },
      ],
      UsoCFDI: usoCfdi,
      Serie: serieId,
      FormaPago: formaPago,
      MetodoPago: metodoPago,
      Moneda: moneda,
      EnviarCorreo: false,
      // Opcionales:
      BorradorSiFalla: "1",
      Redondeo: 2,
    };

    // 5) Llamamos a factura.com
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "F-PLUGIN": FACTURACOM_PLUGIN,
        "F-Api-Key": apiKey,
        "F-Secret-Key": secretKey,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as any;

    if (!response.ok || !data || data.response !== "success") {
      // Guardamos estado de error
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.ERROR,
        },
      });

      const msg =
        data?.message ||
        data?.error ||
        "No se pudo timbrar la factura. Revisa el panel de factura.com para más detalle.";

      return NextResponse.json(
        {
          error: msg,
          facturaComResponse: data ?? null,
        },
        { status: 502 },
      );
    }

    // 6) Extraemos datos relevantes del timbrado
    const uuid: string | null =
      data.UUID || data.SAT?.UUID || data.uuid || data.sat_uuid || null;
    const serie: string | null = data.INV?.Serie?.toString?.() ?? invoice.series ?? null;
    const folio: string | null =
      data.INV?.Folio != null ? String(data.INV.Folio) : invoice.folio ?? null;
    const externalId: string | null = data.invoice_uid || data.uid || invoice.externalId || null;

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.ISSUED,
        uuid,
        series: serie,
        folio,
        externalId,
        issuedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      invoiceId: updated.id,
      uuid: updated.uuid,
      serie: updated.series,
      folio: updated.folio,
    });
  } catch (err) {
    console.error("[POST /api/invoices/[id]/issue]", err);
    return NextResponse.json(
      { error: "Error interno al timbrar la factura" },
      { status: 500 },
    );
  }
}
