import { createAdminClient } from "../../../lib/supabase/admin";

const HEADERS = [
  "product_id",
  "SKU（your product SKU）",
  "Supplier_url（Optional）",
  "SKU（Supplier SKU）（Optional）",
];

/*
  ---------------------------------------------------------
  SOUTHSTAR -> DSERS PRODUCT EXPORT
  ---------------------------------------------------------

  Two different SKUs are involved:

  1. Southstar Store SKU
     Example:
     SS-product-id-Light-grey-For-iPhone-16-Plus

  2. AliExpress Supplier SKU
     Example:
     10:350383#For iPhone 16 Plus;14:771#Grey

  These must remain separate.

  Future products:
  - variant.supplier_sku is used when available.
  - product.supplier_sku is used for non-variant products.

  The current Leather Case has a fallback mapping because we
  recovered its AliExpress variant information directly from DSers.
*/

const LEATHER_CASE_SUPPLIER_PRODUCT_ID =
  "3256805858072800";


/*
  AliExpress phone-model mappings.
*/
const LEATHER_CASE_MODEL_SKUS = {
  "for iphone 16 plus":
    "10:350383#For iPhone 16 Plus",

  "for iphone 16pro max":
    "10:4#For iPhone 16Pro Max",

  "for iphone 16 pro":
    "10:1169#For iPhone 16 Pro",

  "for iphone 8 plus":
    "10:350466#For iPhone 8 Plus",

  "for iphone 7 plus":
    "10:202622813#For iPhone 7 Plus",

  "for iphone 14 plus":
    "10:352621#For iPhone 14 Plus",

  "for iphone 16":
    "10:1042#For iPhone 16",

  "for iphone 11 pro":
    "10:439#For iPhone 11 Pro",

  "for iphone 11pro max":
    "10:1170#For iPhone 11Pro Max",

  "for iphone xs max":
    "10:100006966#For iPhone XS Max",

  "for iphone 8 7":
    "10:201662808#For iPhone 8 7",

  "for iphone xr":
    "10:1179#For iPhone XR",

  "for iphone x xs":
    "10:501#For iPhone X XS",

  "for iphone 13 pro":
    "10:63#For iPhone 13 Pro",

  "for iphone 13pro max":
    "10:437#For iPhone 13Pro Max",

  "for iphone 14pro max":
    "10:365213#For iPhone 14Pro Max",

  "for iphone 13":
    "10:1064#For iPhone 13",

  "for iphone 12pro max":
    "10:438#For iPhone 12Pro Max",

  "for iphone 11":
    "10:452#For iPhone 11",

  "for iphone 12":
    "10:124#For iPhone 12",

  "for iphone 12 pro":
    "10:48#For iPhone 12 Pro",

  "for iphone 15":
    "10:351785#For iPhone 15",

  "for iphone 15 plus":
    "10:477#For iPhone 15 Plus",

  "for iphone 14":
    "10:365212#For iPhone 14",

  "for iphone 14 pro":
    "10:395#For iPhone 14 Pro",

  "for iphone 15 pro":
    "10:529#For iPhone 15 Pro",

  "for iphone 15pro max":
    "10:365211#For iPhone 15Pro Max",
};


/*
  AliExpress color mappings.

  Southstar may use slightly different customer-facing names,
  so aliases are included where needed.
*/
const LEATHER_CASE_COLOR_SKUS = {
  grey:
    "14:771#Grey",

  "light grey":
    "14:771#Grey",

  "light gray":
    "14:771#Grey",

  "light blue":
    "14:200013901",

  blue:
    "14:200013901",

  green:
    "14:175",

  "dark grey":
    "14:200004890",

  "dark gray":
    "14:200004890",
};


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


function normalize(value) {
  return cleanText(value)
    .toLowerCase();
}


function skuPart(value) {
  return cleanText(value)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


/*
  ---------------------------------------------------------
  SOUTHSTAR STORE SKU
  ---------------------------------------------------------
*/

function getVariantSkuLabel(
  variant,
  variantIndex
) {
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


/*
  ---------------------------------------------------------
  LEATHER CASE SUPPLIER SKU
  ---------------------------------------------------------
*/

function makeLeatherCaseSupplierSku(
  variant
) {
  const option1Name = normalize(
    variant?.option1_name
  );

  const option2Name = normalize(
    variant?.option2_name
  );

  const option1Value = normalize(
    variant?.option1_value
  );

  const option2Value = normalize(
    variant?.option2_value
  );


  let color = "";
  let model = "";


  /*
    Normal setup:

    Option 1 = Color
    Option 2 = iPhone Model
  */
  if (
    option1Name.includes("color") ||
    option1Name.includes("colour")
  ) {
    color = option1Value;
    model = option2Value;
  }


  /*
    Also support reversed option order.
  */
  if (
    option2Name.includes("color") ||
    option2Name.includes("colour")
  ) {
    color = option2Value;
    model = option1Value;
  }


  /*
    Fallback for older variants where
    option names may be missing.
  */
  if (!color && !model) {
    color = option1Value;
    model = option2Value;
  }


  const modelSku =
    LEATHER_CASE_MODEL_SKUS[
      model
    ];

  const colorSku =
    LEATHER_CASE_COLOR_SKUS[
      color
    ];


  /*
    Never fabricate an AliExpress SKU.
  */
  if (!modelSku || !colorSku) {
    return "";
  }


  return `${modelSku};${colorSku}`;
}


/*
  ---------------------------------------------------------
  UNIVERSAL SUPPLIER SKU RESOLUTION
  ---------------------------------------------------------

  Priority:

  1. Stored variant supplier_sku
  2. Current Leather Case fallback
  3. Product supplier_sku for non-variant products
  4. Blank when supplier SKU is unknown
*/

function getSupplierSku(
  product,
  variant = null
) {
  if (variant) {
    const storedVariantSupplierSku =
      cleanText(
        variant?.supplier_sku
      );


    if (storedVariantSupplierSku) {
      return storedVariantSupplierSku;
    }


    const supplierProductId =
      cleanText(
        product?.supplier_product_id
      );


    if (
      supplierProductId ===
      LEATHER_CASE_SUPPLIER_PRODUCT_ID
    ) {
      return makeLeatherCaseSupplierSku(
        variant
      );
    }


    /*
      Fallback if supplier_product_id was not
      saved but the full AliExpress URL contains it.
    */
    const supplierUrl =
      cleanText(
        product?.supplier_url
      );


    if (
      supplierUrl.includes(
        LEATHER_CASE_SUPPLIER_PRODUCT_ID
      )
    ) {
      return makeLeatherCaseSupplierSku(
        variant
      );
    }


    return "";
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


    for (
      const product of
        products || []
    ) {
      const variants =
        Array.isArray(
          product?.variants
        )
          ? product.variants
          : [];


      /*
        Product with variants.
      */
      if (variants.length > 0) {
        variants.forEach(
          (
            variant,
            index
          ) => {
            rows.push([
              /*
                Product ID
              */
              product.id,


              /*
                Southstar Store SKU
              */
              makeSouthstarSku(
                product,
                variant,
                index
              ),


              /*
                AliExpress Supplier URL
              */
              cleanText(
                product?.supplier_url
              ),


              /*
                AliExpress Supplier SKU
              */
              getSupplierSku(
                product,
                variant
              ),
            ]);
          }
        );


        continue;
      }


      /*
        Product without variants.
      */
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