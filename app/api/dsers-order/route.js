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
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function skuPart(value) {
  return cleanText(value)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanAddress(value) {
  return cleanText(value)
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPhone(value) {
  const original = cleanText(value);
  const hasPlus = original.startsWith("+");
  const digits = original.replace(/\D/g, "");

  if (!digits) return "";

  return (hasPlus ? "+" : "") + digits;
}

function countryCode(value) {
  const country = cleanText(value);
  const upper = country.toUpperCase();

  if (
    upper === "US" ||
    upper === "USA" ||
    upper === "UNITED STATES" ||
    upper === "UNITED STATES OF AMERICA"
  ) {
    return "US";
  }

  return country;
}

function formatDate(value) {
  const date = value
    ? new Date(value)
    : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function getVariantSkuLabel(
  variant,
  variantIndex
) {
  const option1 =
    skuPart(
      variant?.option1_value
    );

  const option2 =
    skuPart(
      variant?.option2_value
    );

  if (option1 && option2) {
    return `${option1}-${option2}`;
  }

  if (option1) {
    return option1;
  }

  const variantName =
    skuPart(
      variant?.name
    );

  if (variantName) {
    return variantName;
  }

  return `V${variantIndex + 1}`;
}

function makeDsersSkuFromItem(
  item,
  product
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

  if (!productId) {
    return "";
  }

  const variantId =
    cleanText(
      item.supplier_variant_id
    );

  const variantName =
    cleanText(
      item.variant_name
    );

  /*
    If an actual AliExpress variant ID
    has already been stored, preserve
    the existing mapping behavior.
  */
  if (
    variantName &&
    variantId
  ) {
    return `SS-${productId}-${variantId}`;
  }

  /*
    For Southstar variants, find the
    matching current product variant
    and create the same readable SKU
    used by the Products CSV.
  */
  if (
    variantName &&
    product
  ) {
    const variants =
      Array.isArray(
        product.variants
      )
        ? product.variants
        : [];

    const variantIndex =
      variants.findIndex(
        (variant) =>
          cleanText(
            variant?.name
          ).toLowerCase() ===
          variantName.toLowerCase()
      );

    if (
      variantIndex >= 0
    ) {
      const variant =
        variants[
          variantIndex
        ];

      const label =
        getVariantSkuLabel(
          variant,
          variantIndex
        );

      return `SS-${productId}-${label}`;
    }
  }

  /*
    Non-variant product fallback.
  */
  return `SS-${productId}`;
}

async function requireAdmin() {
  const s =
    await createClient();

  const {
    data: { user },
  } = await s.auth.getUser();

  if (!user) {
    return false;
  }

  const { data } = await s
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
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
      .eq("id", orderId)
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

    if (
      items.length === 0
    ) {
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

    /*
      Load the current product variants
      so order SKUs can use the same
      readable names as Products CSV.
    */
    const productIds = [
      ...new Set(
        items
          .map((item) =>
            cleanText(
              item.product_id
            )
          )
          .filter(Boolean)
      ),
    ];

    let productMap =
      new Map();

    if (
      productIds.length >
      0
    ) {
      const {
        data: products,
        error:
          productsError,
      } = await db
        .from("products")
        .select(
          "id, variants"
        )
        .in(
          "id",
          productIds
        );

      if (
        productsError
      ) {
        throw new Error(
          productsError.message
        );
      }

      productMap =
        new Map(
          (products || []).map(
            (product) => [
              String(
                product.id
              ),
              product,
            ]
          )
        );
    }

    const orderNumber =
      cleanText(
        order.id
      ) ||
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
      items.map((item) => {
        const productId =
          cleanText(
            item.product_id
          );

        const product =
          productMap.get(
            productId
          );

        const sku =
          makeDsersSkuFromItem(
            item,
            product
          );

        return [
          orderNumber,
          date,
          country,
          productId,
          sku,
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
        ];
      });

    const csv =
      rowsToCsv(
        HEADERS,
        rows
      );

    return new Response(
      csv,
      {
        headers: {
          "Content-Type":
            "text/csv; charset=utf-8",

          "Content-Disposition":
            `attachment; filename="southstar-dsers-order-${orderId}.csv"`,

          "Cache-Control":
            "no-store",
        },
      }
    );
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