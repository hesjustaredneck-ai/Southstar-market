import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";

const HEADERS = [
  "Order_number",
  "Date",
  "Country(Short Name of Country)",
  "Product_id",
  "Sku",
  "Product_count",
  "Order_memo",
  "Contact_person",
  "Mobile_no",
  "Email(Optional)",
  "Address",
  "Address2",
  "Province",
  "City",
  "ZIP",
  "RUT(Chile; Optional)",
  "Personal Clearance ID(Korea, Oman; Optional)",
  "Passport/Alien registration Card Number(Korea, Oman; Optional)",
  "CPF(Brazil; Optional)",
  "Turkish ID Number(Turkey; Optional)",
  "Passport Number(Turkey; Optional)",
  "RUC(Peru; Optional)",
  "RFC/CURP(Mexico; Optional)",
];

function csvCell(value) {
  const text = String(value ?? "");

  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(headers, rows) {
  return [headers, ...rows]
    .map((row) =>
      row.map(csvCell).join(",")
    )
    .join("\n");
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanAddress(value) {
  return cleanText(value)
    .replace(
      /[^a-zA-Z0-9\s-]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPhone(value) {
  const original =
    cleanText(value);

  const hasPlus =
    original.startsWith("+");

  const digits =
    original.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return (
    (hasPlus ? "+" : "") +
    digits
  );
}

function countryCode(value) {
  const country =
    cleanText(value);

  const upper =
    country.toUpperCase();

  if (
    upper === "US" ||
    upper === "USA" ||
    upper ===
      "UNITED STATES" ||
    upper ===
      "UNITED STATES OF AMERICA"
  ) {
    return "US";
  }

  return country;
}

function makeDsersSkuFromItem(
  item
) {
  const supplierSku =
    cleanText(
      item.supplier_sku
    );

  if (supplierSku) {
    return supplierSku;
  }

  const productId =
    cleanText(
      item.product_id
    );

  const variantId =
    cleanText(
      item.supplier_variant_id
    );

  const hasVariant =
    Boolean(
      cleanText(
        item.variant_name
      )
    );

  if (
    hasVariant &&
    variantId
  ) {
    return `SS-${productId}-${variantId}`;
  }

  if (productId) {
    return `SS-${productId}`;
  }

  return "";
}

function formatDate(value) {
  const date =
    value
      ? new Date(value)
      : new Date();

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }

  return date
    .toISOString()
    .slice(0, 10);
}

async function requireAdmin() {
  const s =
    await createClient();

  const {
    data: { user },
  } =
    await s.auth.getUser();

  if (!user) {
    return false;
  }

  const { data } =
    await s
      .from("admins")
      .select("user_id")
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

  return Boolean(data);
}

export async function GET(req) {
  try {
    const isAdmin =
      await requireAdmin();

    if (!isAdmin) {
      return Response.json(
        {
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const url =
      new URL(req.url);

    const orderId =
      cleanText(
        url.searchParams.get(
          "id"
        )
      );

    if (!orderId) {
      return Response.json(
        {
          error:
            "Missing order ID",
        },
        {
          status: 400,
        }
      );
    }

    const db =
      createAdminClient();

    const {
      data: order,
      error,
    } = await db
      .from("orders")
      .select("*")
      .eq(
        "id",
        orderId
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (!order) {
      return Response.json(
        {
          error:
            "Order not found",
        },
        {
          status: 404,
        }
      );
    }

    const items =
      Array.isArray(
        order.items
      )
        ? order.items
        : [];

    if (items.length === 0) {
      return Response.json(
        {
          error:
            "Order has no items",
        },
        {
          status: 400,
        }
      );
    }

    const orderNumber =
      cleanText(order.id) ||
      cleanText(
        order.stripe_session_id
      );

    const date =
      formatDate(
        order.created_at
      );

    const country =
      countryCode(
        order.shipping_country
      );

    const phone =
      cleanPhone(
        order.customer_phone
      );

    const address1 =
      cleanAddress(
        order
          .shipping_address_line1
      );

    const address2 =
      cleanAddress(
        order
          .shipping_address_line2
      );

    const rows =
      items.map(
        (item) => [
          orderNumber,
          date,
          country,

          cleanText(
            item.product_id
          ),

          makeDsersSkuFromItem(
            item
          ),

          Number(
            item.quantity || 1
          ),

          "",

          cleanText(
            order.customer_name
          ),

          phone,

          cleanText(
            order.customer_email
          ),

          address1,
          address2,

          cleanText(
            order.shipping_state
          ),

          cleanText(
            order.shipping_city
          ),

          cleanText(
            order
              .shipping_postal_code
          ),

          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]
      );

    const csv =
      rowsToCsv(
        HEADERS,
        rows
      );

    return new Response(csv, {
      headers: {
        "Content-Type":
          "text/csv; charset=utf-8",

        "Content-Disposition":
          `attachment; filename="southstar-dsers-order-${orderId}.csv"`,

        "Cache-Control":
          "no-store",
      },
    });
  } catch (error) {
    console.error(
      "DSers order export error:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Order export failed",
      },
      {
        status: 500,
      }
    );
  }
}