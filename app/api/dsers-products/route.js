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

function skuPart(value) {
  return cleanText(value)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getVariantSkuLabel(variant, variantIndex) {
  const option1 = skuPart(
    variant?.option1_value
  );

  const option2 = skuPart(
    variant?.option2_value
  );

  if (option1 && option2) {
    return `${option1}-${option2}`;
  }

  if (option1) {
    return option1;
  }

  const variantName = skuPart(
    variant?.name
  );

  if (variantName) {
    return variantName;
  }

  return `V${variantIndex + 1}`;
}

function makeSouthstarSku(
  product,
  variant = null,
  variantIndex = 0
) {
  if (variant) {
    const label =
      getVariantSkuLabel(
        variant,
        variantIndex
      );

    return `SS-${product.id}-${label}`;
  }

  return `SS-${product.id}`;
}

function getSupplierSku(
  product,
  variant = null
) {
  if (variant) {
    return cleanText(
      variant?.supplier_sku
    );
  }

  return cleanText(
    product?.supplier_sku
  );
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

    for (const product of products || []) {
      const variants =
        Array.isArray(
          product?.variants
        )
          ? product.variants
          : [];

      if (variants.length > 0) {
        variants.forEach(
          (variant, index) => {
            rows.push([
              product.id,

              makeSouthstarSku(
                product,
                variant,
                index
              ),

              cleanText(
                product?.supplier_url
              ),

              getSupplierSku(
                product,
                variant
              ),
            ]);
          }
        );

        continue;
      }

      rows.push([
        product.id,

        makeSouthstarSku(
          product
        ),

        cleanText(
          product?.supplier_url
        ),

        getSupplierSku(
          product
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
            "no-store, no-cache, must-revalidate",

          Pragma:
            "no-cache",

          Expires:
            "0",
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