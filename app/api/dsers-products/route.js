import { createAdminClient } from "../../../lib/supabase/admin";

const HEADERS = [
  "product_id",
  "SKU（your product SKU）",
  "Supplier_url（Optional）",
  "SKU（Supplier SKU）（Optional）",
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

/*
  Makes a value safe and readable inside
  a Southstar/DSers SKU.

  Example:

  "Dark Grey"
  becomes
  "Dark-Grey"

  "For iPhone 16 Pro Max"
  becomes
  "For-iPhone-16-Pro-Max"
*/
function skuPart(value) {
  return cleanText(value)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

  /*
    New two-option products.

    Example:
    Dark-Grey-For-iPhone-15-Pro
  */
  if (option1 && option2) {
    return `${option1}-${option2}`;
  }

  /*
    One-option products created with the
    newer option system.
  */
  if (option1) {
    return option1;
  }

  /*
    Older single-variant products.
  */
  const variantName =
    skuPart(
      variant?.name
    );

  if (variantName) {
    return variantName;
  }

  /*
    Absolute fallback.
  */
  return `V${variantIndex + 1}`;
}

function makeDsersSkuFromProduct(
  product,
  variant = null,
  variantIndex = 0
) {
  /*
    If we ever obtain a real supplier SKU,
    preserve the existing behavior.
  */
  const variantSupplierSku =
    cleanText(
      variant?.supplier_sku
    );

  if (variantSupplierSku) {
    return variantSupplierSku;
  }

  if (variant) {
    const variantId =
      cleanText(
        variant?.supplier_variant_id
      );

    if (variantId) {
      return `SS-${product.id}-${variantId}`;
    }

    /*
      NEW:

      Instead of:

      SS-product-id-V57

      we now get:

      SS-product-id-Dark-Grey-For-iPhone-15-Pro
    */
    const label =
      getVariantSkuLabel(
        variant,
        variantIndex
      );

    return `SS-${product.id}-${label}`;
  }

  const productSupplierSku =
    cleanText(
      product.supplier_sku
    );

  if (productSupplierSku) {
    return productSupplierSku;
  }

  return `SS-${product.id}`;
}

export async function GET() {
  try {
    const db =
      createAdminClient();

    const {
      data: products,
      error,
    } = await db
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw new Error(
        error.message
      );
    }

    const rows = [];

    for (
      const product of
        products || []
    ) {
      const variants =
        Array.isArray(
          product.variants
        )
          ? product.variants
          : [];

      if (
        variants.length > 0
      ) {
        variants.forEach(
          (
            variant,
            index
          ) => {
            rows.push([
              product.id,

              makeDsersSkuFromProduct(
                product,
                variant,
                index
              ),

              cleanText(
                product
                  .supplier_url
              ),

              cleanText(
                variant
                  .supplier_sku
              ),
            ]);
          }
        );

        continue;
      }

      rows.push([
        product.id,

        makeDsersSkuFromProduct(
          product
        ),

        cleanText(
          product
            .supplier_url
        ),

        cleanText(
          product
            .supplier_sku
        ),
      ]);
    }

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
            'attachment; filename="southstar-dsers-products.csv"',

          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "DSers product export error:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Export failed",
      },
      {
        status: 500,
      }
    );
  }
}