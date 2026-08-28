import { randomUUID } from "crypto";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const s = await createClient();

  const {
    data: { user },
  } = await s.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await s
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) redirect("/");

  return user;
}

function buildVariants(fd, basePrice, baseCost) {
  const names = fd.getAll("variant_name");
  const prices = fd.getAll("variant_price");
  const costs = fd.getAll("variant_cost");
  const variantIds = fd.getAll("variant_id");
  const skus = fd.getAll("variant_sku");

  const variants = [];

  for (let i = 0; i < names.length; i++) {
    const name = String(names[i] || "").trim();

    if (!name) continue;

    const priceValue = String(
      prices[i] || ""
    ).trim();

    const costValue = String(
      costs[i] || ""
    ).trim();

    variants.push({
      name,

      price:
        priceValue !== ""
          ? Number(priceValue)
          : basePrice,

      cost:
        costValue !== ""
          ? Number(costValue)
          : baseCost,

      supplier_variant_id: String(
        variantIds[i] || ""
      ).trim(),

      supplier_sku: String(
        skus[i] || ""
      ).trim(),
    });
  }

  return variants;
}

async function uploadImages(db, files) {
  const imageUrls = [];

  for (const file of files) {
    if (
      !(file instanceof File) ||
      file.size <= 0
    ) {
      continue;
    }

    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase() || "jpg";

    const path =
      `${Date.now()}-${randomUUID()}.${extension}`;

    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    const { error: uploadError } =
      await db.storage
        .from("Product-image")
        .upload(path, buffer, {
          contentType:
            file.type || "image/jpeg",
          upsert: false,
        });

    if (uploadError) {
      throw new Error(
        `Image upload failed: ${uploadError.message}`
      );
    }

    const { data } = db.storage
      .from("Product-image")
      .getPublicUrl(path);

    imageUrls.push(
      data.publicUrl
    );
  }

  return imageUrls;
}

async function addProduct(fd) {
  "use server";

  await requireAdmin();

  const db =
    createAdminClient();

  const files = fd
    .getAll("images")
    .filter(
      (file) =>
        file instanceof File &&
        file.size > 0
    );

  const imageUrls =
    await uploadImages(
      db,
      files
    );

  const basePrice =
    Number(
      fd.get("price") || 0
    );

  const baseCost =
    Number(
      fd.get("cost") || 0
    );

  const variants =
    buildVariants(
      fd,
      basePrice,
      baseCost
    );

  const { error } = await db
    .from("products")
    .insert({
      name: String(
        fd.get("name") || ""
      ),

      description: String(
        fd.get(
          "description"
        ) || ""
      ),

      category: String(
        fd.get("category") ||
          ""
      ),

      image_url:
        imageUrls[0] || "",

      image_urls:
        imageUrls,

      price:
        basePrice,

      cost:
        baseCost,

      supplier: String(
        fd.get("supplier") ||
          "aliexpress"
      ),

      supplier_url: String(
        fd.get(
          "supplier_url"
        ) || ""
      ),

      supplier_product_id:
        String(
          fd.get(
            "supplier_product_id"
          ) || ""
        ),

      supplier_variant_id:
        String(
          fd.get(
            "supplier_variant_id"
          ) || ""
        ),

      supplier_sku: String(
        fd.get(
          "supplier_sku"
        ) || ""
      ),

      variants,

      auto_fulfill:
        false,

      active:
        true,
    });

  if (error) {
    throw new Error(
      `Product creation failed: ${error.message}`
    );
  }

  redirect("/admin");
}

async function updateProduct(fd) {
  "use server";

  await requireAdmin();

  const db =
    createAdminClient();

  const productId =
    String(
      fd.get("product_id") ||
        ""
    );

  if (!productId) {
    throw new Error(
      "Missing product ID"
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await db
    .from("products")
    .select("*")
    .eq(
      "id",
      productId
    )
    .maybeSingle();

  if (
    existingError ||
    !existing
  ) {
    throw new Error(
      "Product not found"
    );
  }

  const files = fd
    .getAll("images")
    .filter(
      (file) =>
        file instanceof File &&
        file.size > 0
    );

  let imageUrls =
    Array.isArray(
      existing.image_urls
    )
      ? existing.image_urls
      : [];

  let mainImage =
    existing.image_url ||
    "";

  if (files.length > 0) {
    imageUrls =
      await uploadImages(
        db,
        files
      );

    mainImage =
      imageUrls[0] || "";
  }

  const basePrice =
    Number(
      fd.get("price") || 0
    );

  const baseCost =
    Number(
      fd.get("cost") || 0
    );

  const variants =
    buildVariants(
      fd,
      basePrice,
      baseCost
    );

  const { error } = await db
    .from("products")
    .update({
      name: String(
        fd.get("name") ||
          ""
      ),

      description: String(
        fd.get(
          "description"
        ) || ""
      ),

      category: String(
        fd.get(
          "category"
        ) || ""
      ),

      image_url:
        mainImage,

      image_urls:
        imageUrls,

      price:
        basePrice,

      cost:
        baseCost,

      supplier: String(
        fd.get("supplier") ||
          "aliexpress"
      ),

      supplier_url: String(
        fd.get(
          "supplier_url"
        ) || ""
      ),

      supplier_product_id:
        String(
          fd.get(
            "supplier_product_id"
          ) || ""
        ),

      supplier_variant_id:
        String(
          fd.get(
            "supplier_variant_id"
          ) || ""
        ),

      supplier_sku: String(
        fd.get(
          "supplier_sku"
        ) || ""
      ),

      variants,
    })
    .eq(
      "id",
      productId
    );

  if (error) {
    throw new Error(
      `Product update failed: ${error.message}`
    );
  }

  redirect("/admin");
}

async function toggleProduct(fd) {
  "use server";

  await requireAdmin();

  const db =
    createAdminClient();

  const productId =
    String(
      fd.get("product_id") ||
        ""
    );

  const currentActive =
    String(
      fd.get(
        "current_active"
      )
    ).toLowerCase() ===
    "true";

  const { error } = await db
    .from("products")
    .update({
      active:
        !currentActive,
    })
    .eq(
      "id",
      productId
    );

  if (error) {
    throw new Error(
      `Product status update failed: ${error.message}`
    );
  }

  redirect("/admin");
}

async function deleteProduct(fd) {
  "use server";

  await requireAdmin();

  const db =
    createAdminClient();

  const productId =
    String(
      fd.get("product_id") ||
        ""
    );

  const confirmation =
    String(
      fd.get(
        "delete_confirmation"
      ) || ""
    )
      .trim()
      .toUpperCase();

  if (
    confirmation !==
    "DELETE"
  ) {
    throw new Error(
      "Type DELETE exactly to confirm."
    );
  }

  const { error } = await db
    .from("products")
    .delete()
    .eq(
      "id",
      productId
    );

  if (error) {
    throw new Error(
      `Product deletion failed: ${error.message}`
    );
  }

  redirect("/admin");
}

async function updateOrder(fd) {
  "use server";

  await requireAdmin();

  const db =
    createAdminClient();

  const orderId =
    String(
      fd.get("order_id") ||
        ""
    );

  if (!orderId) {
    throw new Error(
      "Missing order ID"
    );
  }

  const {
    data: existingOrder,
    error: orderError,
  } = await db
    .from("orders")
    .select("*")
    .eq(
      "id",
      orderId
    )
    .maybeSingle();

  if (
    orderError ||
    !existingOrder
  ) {
    throw new Error(
      "Order not found"
    );
  }

  const fulfillmentStatus =
    String(
      fd.get(
        "fulfillment_status"
      ) || "unfulfilled"
    );

  const supplierCostValue =
    String(
      fd.get(
        "supplier_cost"
      ) || ""
    ).trim();

  const supplierCost =
    supplierCostValue ===
    ""
      ? null
      : Number(
          supplierCostValue
        );

  const saleAmount =
    Number(
      existingOrder.amount_total ||
        0
    ) / 100;

  const estimatedProfit =
    supplierCost !== null &&
    Number.isFinite(
      supplierCost
    )
      ? saleAmount -
        supplierCost
      : null;

  const updates = {
    fulfillment_status:
      fulfillmentStatus,

    tracking_number:
      String(
        fd.get(
          "tracking_number"
        ) || ""
      ).trim(),

    carrier:
      String(
        fd.get("carrier") ||
          ""
      ).trim(),

    supplier_order_id:
      String(
        fd.get(
          "supplier_order_id"
        ) || ""
      ).trim(),

    supplier_order_status:
      String(
        fd.get(
          "supplier_order_status"
        ) || ""
      ).trim(),

    supplier_cost:
      supplierCost,

    estimated_profit:
      estimatedProfit,
  };

  if (
    fulfillmentStatus ===
      "shipped" &&
    !existingOrder.fulfilled_at
  ) {
    updates.fulfilled_at =
      new Date().toISOString();
  }

  if (
    fulfillmentStatus ===
      "delivered" &&
    !existingOrder.delivered_at
  ) {
    updates.delivered_at =
      new Date().toISOString();
  }

  if (
    fulfillmentStatus ===
      "refunded" &&
    !existingOrder.refunded_at
  ) {
    updates.refunded_at =
      new Date().toISOString();
  }

  const { error } = await db
    .from("orders")
    .update(updates)
    .eq(
      "id",
      orderId
    );

  if (error) {
    throw new Error(
      `Order update failed: ${error.message}`
    );
  }

  redirect("/admin");
}

async function logout() {
  "use server";

  const s =
    await createClient();

  await s.auth.signOut();

  redirect("/login");
}

/*
  DSERS CSV HELPERS
*/

const DSERS_PRODUCT_HEADERS =
  [
    "product_id",
    "SKU（your product SKU）",
    "Supplier_url（Optional）",
    "SKU（Supplier SKU）（Optional）",
  ];

const DSERS_ORDER_HEADERS =
  [
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
  const text =
    String(
      value ?? ""
    );

  return `"${text.replace(
    /"/g,
    '""'
  )}"`;
}

function rowsToCsv(
  headers,
  rows
) {
  return [
    headers,
    ...rows,
  ]
    .map((row) =>
      row
        .map(csvCell)
        .join(",")
    )
    .join("\r\n");
}

function csvDownloadHref(csv) {
  const content =
    `\uFEFF${csv}`;

  return (
    "data:text/csv;charset=utf-8," +
    encodeURIComponent(
      content
    )
  );
}

function cleanText(value) {
  return String(
    value || ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function cleanDsersAddress(
  value
) {
  return cleanText(value)
    .replace(
      /[^a-zA-Z0-9\s-]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function cleanDsersPhone(
  value
) {
  const original =
    cleanText(value);

  const hasPlus =
    original.startsWith(
      "+"
    );

  const digits =
    original.replace(
      /\D/g,
      ""
    );

  if (!digits) {
    return "";
  }

  return (
    (hasPlus ? "+" : "") +
    digits
  );
}

function fullCountryName(
  value
) {
  const country =
    cleanText(value);

  const upper =
    country.toUpperCase();

  if (
    upper === "US" ||
    upper === "USA" ||
    upper ===
      "UNITED STATES OF AMERICA"
  ) {
    return "United States";
  }

  return country;
}

function makeDsersSkuFromProduct(
  product,
  variant = null,
  variantIndex = 0
) {
  const variantSupplierSku =
    cleanText(
      variant?.supplier_sku
    );

  if (
    variantSupplierSku
  ) {
    return variantSupplierSku;
  }

  if (variant) {
    const variantId =
      cleanText(
        variant
          ?.supplier_variant_id
      );

    if (variantId) {
      return (
        `SS-${product.id}-${variantId}`
      );
    }

    return (
      `SS-${product.id}-V${variantIndex + 1}`
    );
  }

  const productSupplierSku =
    cleanText(
      product.supplier_sku
    );

  if (
    productSupplierSku
  ) {
    return productSupplierSku;
  }

  return `SS-${product.id}`;
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
    return (
      `SS-${productId}-${variantId}`
    );
  }

  if (productId) {
    return `SS-${productId}`;
  }

  return "";
}

function buildDsersProductsCsv(
  products
) {
  const rows = [];

  for (
    const product of products
  ) {
    const variants =
      Array.isArray(
        product.variants
      )
        ? product.variants
        : [];

    if (
      variants.length >
      0
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
        product.supplier_url
      ),

      cleanText(
        product.supplier_sku
      ),
    ]);
  }

  return rowsToCsv(
    DSERS_PRODUCT_HEADERS,
    rows
  );
}

function formatDsersDate(
  value
) {
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

function getDsersOrderMissingInfo(
  order,
  items
) {
  const missing = [];

  if (
    !cleanText(
      order.customer_phone
    )
  ) {
    missing.push(
      "Customer phone"
    );
  }

  if (
    !cleanText(
      order
        .shipping_address_line1
    )
  ) {
    missing.push(
      "Street address"
    );
  }

  if (
    !cleanText(
      order.shipping_city
    )
  ) {
    missing.push(
      "City"
    );
  }

  if (
    !cleanText(
      order.shipping_state
    )
  ) {
    missing.push(
      "State"
    );
  }

  if (
    !cleanText(
      order
        .shipping_postal_code
    )
  ) {
    missing.push(
      "ZIP code"
    );
  }

  if (
    !cleanText(
      order
        .shipping_country
    )
  ) {
    missing.push(
      "Country"
    );
  }

  if (
    !Array.isArray(
      items
    ) ||
    items.length === 0
  ) {
    missing.push(
      "Order items"
    );

    return missing;
  }

  items.forEach(
    (item, index) => {
      const productId =
        cleanText(
          item.product_id
        );

      if (!productId) {
        missing.push(
          `Item ${index + 1} product ID`
        );
      }

      const hasVariant =
        Boolean(
          cleanText(
            item.variant_name
          )
        );

      if (
        hasVariant &&
        !cleanText(
          item.supplier_sku
        ) &&
        !cleanText(
          item
            .supplier_variant_id
        )
      ) {
        missing.push(
          `Item ${index + 1} variant mapping`
        );
      }

      if (
        !makeDsersSkuFromItem(
          item
        )
      ) {
        missing.push(
          `Item ${index + 1} SKU`
        );
      }
    }
  );

  return missing;
}

function buildDsersOrderCsv(
  order,
  items
) {
  const orderNumber =
    cleanText(order.id) ||
    cleanText(
      order.stripe_session_id
    );

  const date =
    formatDsersDate(
      order.created_at
    );

  const country =
    fullCountryName(
      order.shipping_country
    );

  const mobile =
    cleanDsersPhone(
      order.customer_phone
    );

  const address1 =
    cleanDsersAddress(
      order
        .shipping_address_line1
    );

  const address2 =
    cleanDsersAddress(
      order
        .shipping_address_line2
    );

  const rows =
    items.map((item) => [
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

      mobile,

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
    ]);

  return rowsToCsv(
    DSERS_ORDER_HEADERS,
    rows
  );
}

function VariantRow({
  number,
  variant = null,
}) {
  return (
    <div
      style={{
        border:
          "1px solid #ddd",
        padding: "14px",
        borderRadius: "7px",
        display: "grid",
        gap: "10px",
      }}
    >
      <strong>
        Variant {number}
      </strong>

      <input
        name="variant_name"
        defaultValue={
          variant?.name || ""
        }
        placeholder="Variant name -- e.g. Black / Red"
      />

      <input
        name="variant_price"
        type="number"
        step="0.01"
        defaultValue={
          variant?.price ??
          ""
        }
        placeholder="Selling price -- blank = main price"
      />

      <input
        name="variant_cost"
        type="number"
        step="0.01"
        defaultValue={
          variant?.cost ??
          ""
        }
        placeholder="Supplier cost -- blank = main cost"
      />

      <input
        name="variant_id"
        defaultValue={
          variant
            ?.supplier_variant_id ||
          ""
        }
        placeholder="AliExpress variant ID"
      />

      <input
        name="variant_sku"
        defaultValue={
          variant
            ?.supplier_sku ||
          ""
        }
        placeholder="Supplier SKU"
      />
    </div>
  );
}

function ProductEditor({
  product,
}) {
  const variants =
    Array.isArray(
      product.variants
    )
      ? product.variants
      : [];

  return (
    <details
      className="panel"
      style={{
        marginTop:
          "16px",
      }}
    >
      <summary
        style={{
          cursor:
            "pointer",
          fontWeight:
            "700",
        }}
      >
        {product.name}
        {" -- "}$
        {Number(
          product.price || 0
        ).toFixed(2)}
        {" -- "}
        {product.active
          ? "Active"
          : "Inactive"}
      </summary>

      <div
        style={{
          marginTop:
            "20px",
        }}
      >
        <form
          action={
            updateProduct
          }
          className="form"
        >
          <input
            type="hidden"
            name="product_id"
            value={
              product.id
            }
          />

          <input
            name="name"
            defaultValue={
              product.name ||
              ""
            }
            placeholder="Product name"
            required
          />

          <textarea
            name="description"
            defaultValue={
              product.description ||
              ""
            }
            placeholder="Description"
          />

          <input
            name="category"
            defaultValue={
              product.category ||
              ""
            }
            placeholder="Category"
          />

          <label>
            Replace product
            images

            <input
              name="images"
              type="file"
              accept="image/*"
              multiple
            />
          </label>

          <p className="muted">
            Leave images blank
            to keep the current
            gallery.
          </p>

          <input
            name="price"
            type="number"
            step="0.01"
            defaultValue={
              product.price ??
              ""
            }
            placeholder="Southstar price"
            required
          />

          <input
            name="cost"
            type="number"
            step="0.01"
            defaultValue={
              product.cost ??
              ""
            }
            placeholder="Supplier cost"
          />

          <input
            name="supplier"
            defaultValue={
              product.supplier ||
              "aliexpress"
            }
            placeholder="Supplier"
          />

          <input
            name="supplier_url"
            defaultValue={
              product
                .supplier_url ||
              ""
            }
            placeholder="AliExpress product URL"
          />

          <input
            name="supplier_product_id"
            defaultValue={
              product
                .supplier_product_id ||
              ""
            }
            placeholder="AliExpress product ID"
          />

          <input
            name="supplier_variant_id"
            defaultValue={
              product
                .supplier_variant_id ||
              ""
            }
            placeholder="Default AliExpress variant ID"
          />

          <input
            name="supplier_sku"
            defaultValue={
              product
                .supplier_sku ||
              ""
            }
            placeholder="Default supplier SKU"
          />

          <hr />

          <h3>
            Variants
          </h3>

          {[0, 1, 2, 3, 4, 5].map(
            (index) => (
              <VariantRow
                key={
                  index
                }
                number={
                  index + 1
                }
                variant={
                  variants[
                    index
                  ] ||
                  null
                }
              />
            )
          )}

          <button
            type="submit"
            className="primary"
          >
            Save changes
          </button>
        </form>

        <hr
          style={{
            margin:
              "28px 0",
          }}
        />

        <form
          action={
            toggleProduct
          }
        >
          <input
            type="hidden"
            name="product_id"
            value={
              product.id
            }
          />

          <input
            type="hidden"
            name="current_active"
            value={
              product.active
                ? "true"
                : "false"
            }
          />

          <button type="submit">
            {product.active
              ? "Deactivate product"
              : "Activate product"}
          </button>
        </form>

        <hr
          style={{
            margin:
              "28px 0",
          }}
        />

        <h3>
          Delete product
        </h3>

        <form
          action={
            deleteProduct
          }
          className="form"
        >
          <input
            type="hidden"
            name="product_id"
            value={
              product.id
            }
          />

          <input
            name="delete_confirmation"
            placeholder='Type "DELETE" to confirm'
          />

          <button type="submit">
            Delete product
          </button>
        </form>
      </div>
    </details>
  );
}

function getItemMissingInfo(
  item
) {
  const missing = [];

  if (
    !String(
      item.supplier_url ||
        ""
    ).trim()
  ) {
    missing.push(
      "Supplier URL"
    );
  }

  const supplierCost =
    Number(
      item.supplier_cost
    );

  if (
    item.supplier_cost ===
      null ||
    item.supplier_cost ===
      undefined ||
    item.supplier_cost ===
      "" ||
    !Number.isFinite(
      supplierCost
    ) ||
    supplierCost <= 0
  ) {
    missing.push(
      "Supplier cost"
    );
  }

  const productId =
    String(
      item
        .supplier_product_id ||
        ""
    ).trim();

  const variantId =
    String(
      item
        .supplier_variant_id ||
        ""
    ).trim();

  const sku =
    String(
      item.supplier_sku ||
        ""
    ).trim();

  const hasVariant =
    Boolean(
      String(
        item.variant_name ||
          ""
      ).trim()
    );

  if (hasVariant) {
    if (
      !variantId &&
      !sku
    ) {
      missing.push(
        "Variant ID or SKU"
      );
    }
  } else {
    if (
      !productId &&
      !sku
    ) {
      missing.push(
        "Product ID or SKU"
      );
    }
  }

  return missing;
}

function SupplierPrep({
  order,
  items,
}) {
  const hasAddress =
    Boolean(
      String(
        order.shipping_address ||
          ""
      ).trim()
    );

  const itemChecks =
    items.map(
      (item) => ({
        item,
        missing:
          getItemMissingInfo(
            item
          ),
      })
    );

  const allItemsReady =
    items.length > 0 &&
    itemChecks.every(
      (check) =>
        check.missing
          .length === 0
    );

  const orderReady =
    hasAddress &&
    allItemsReady;

  const totalExpectedSupplierCost =
    items.reduce(
      (sum, item) => {
        const quantity =
          Number(
            item.quantity ||
              1
          );

        const cost =
          Number(
            item.supplier_cost ||
              0
          );

        return (
          sum +
          cost *
            quantity
        );
      },
      0
    );

  const prepText = [
    "SOUTHSTAR SUPPLIER ORDER",
    "",
    `STATUS: ${
      orderReady
        ? "READY TO ORDER"
        : "MISSING REQUIRED INFO"
    }`,
    "",
    "CUSTOMER",
    `${
      order.customer_name ||
      ""
    }`,
    `${
      order.customer_email ||
      ""
    }`,
    `${
      order.customer_phone ||
      ""
    }`,
    "",
    "SHIP TO",
    `${
      order.shipping_address ||
      ""
    }`,
    "",
    "ITEMS",

    ...items.flatMap(
      (
        item,
        index
      ) => {
        const missing =
          getItemMissingInfo(
            item
          );

        return [
          "",
          `${index + 1}. ${
            item.product_name ||
            "Product"
          }`,

          item.variant_name
            ? `Variant: ${item.variant_name}`
            : null,

          `Quantity: ${
            item.quantity ||
            1
          }`,

          item.supplier
            ? `Supplier: ${item.supplier}`
            : null,

          item.supplier_product_id
            ? `Product ID: ${item.supplier_product_id}`
            : null,

          item.supplier_variant_id
            ? `Variant ID: ${item.supplier_variant_id}`
            : null,

          item.supplier_sku
            ? `SKU: ${item.supplier_sku}`
            : null,

          item.supplier_cost !==
            undefined &&
          item.supplier_cost !==
            null
            ? `Supplier cost each: $${Number(
                item.supplier_cost ||
                  0
              ).toFixed(2)}`
            : null,

          item.supplier_url
            ? `Supplier URL: ${item.supplier_url}`
            : null,

          missing.length >
          0
            ? `MISSING: ${missing.join(
                ", "
              )}`
            : "READY",
        ].filter(
          Boolean
        );
      }
    ),

    "",
    `EXPECTED SUPPLIER TOTAL: $${totalExpectedSupplierCost.toFixed(
      2
    )}`,
  ].join("\n");

  return (
    <div
      style={{
        border:
          orderReady
            ? "2px solid #1f7a3d"
            : "2px solid #b7791f",

        padding:
          "18px",

        borderRadius:
          "10px",

        margin:
          "24px 0",

        background:
          orderReady
            ? "#f3faf5"
            : "#fffaf0",
      }}
    >
      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          gap:
            "12px",

          alignItems:
            "center",

          flexWrap:
            "wrap",
        }}
      >
        <h3
          style={{
            margin: 0,
          }}
        >
          Supplier Order
          Prep
        </h3>

        <strong
          style={{
            fontSize:
              "14px",
          }}
        >
          {orderReady
            ? "✓ READY TO ORDER"
            : "⚠ MISSING REQUIRED INFO"}
        </strong>
      </div>

      <p
        style={{
          marginBottom:
            "6px",
        }}
      >
        <strong>
          Fulfillment
          validation
        </strong>
      </p>

      {hasAddress ? (
        <p>
          ✓ Shipping address
          present
        </p>
      ) : (
        <p>
          ⚠ Missing customer
          shipping address
        </p>
      )}

      {items.length ===
        0 && (
        <p>
          ⚠ No order items
          available
        </p>
      )}

      {itemChecks.map(
        (
          {
            item,
            missing,
          },
          index
        ) => {
          const quantity =
            Number(
              item.quantity ||
                1
            );

          const itemCost =
            Number(
              item.supplier_cost ||
                0
            );

          const expectedTotal =
            quantity *
            itemCost;

          return (
            <div
              key={
                index
              }
              style={{
                borderTop:
                  "1px solid #ddd",

                paddingTop:
                  "14px",

                marginTop:
                  "14px",
              }}
            >
              <strong>
                {index +
                  1}
                .{" "}
                {item.product_name ||
                  "Product"}
              </strong>

              {item.variant_name && (
                <p>
                  <strong>
                    Variant:
                  </strong>{" "}
                  {
                    item.variant_name
                  }
                </p>
              )}

              <p>
                <strong>
                  Quantity:
                </strong>{" "}
                {quantity}
              </p>

              <p>
                <strong>
                  Expected
                  supplier total:
                </strong>{" "}
                $
                {expectedTotal.toFixed(
                  2
                )}
              </p>

              {missing.length ===
              0 ? (
                <div
                  style={{
                    border:
                      "1px solid #b7ddc1",

                    background:
                      "#edf8f0",

                    padding:
                      "10px",

                    borderRadius:
                      "7px",

                    marginBottom:
                      "12px",
                  }}
                >
                  <strong>
                    ✓ Item ready
                    for supplier
                    order
                  </strong>
                </div>
              ) : (
                <div
                  style={{
                    border:
                      "1px solid #ecd29b",

                    background:
                      "#fff7e6",

                    padding:
                      "10px",

                    borderRadius:
                      "7px",

                    marginBottom:
                      "12px",
                  }}
                >
                  <strong>
                    ⚠ Missing:
                  </strong>{" "}
                  {missing.join(
                    ", "
                  )}
                </div>
              )}

              <p>
                <strong>
                  Supplier:
                </strong>{" "}
                {item.supplier ||
                  "Not set"}
              </p>

              <p>
                <strong>
                  Product ID:
                </strong>{" "}
                {item.supplier_product_id ||
                  "Not set"}
              </p>

              <p>
                <strong>
                  Variant ID:
                </strong>{" "}
                {item.supplier_variant_id ||
                  "Not set"}
              </p>

              <p>
                <strong>
                  SKU:
                </strong>{" "}
                {item.supplier_sku ||
                  "Not set"}
              </p>

              <p>
                <strong>
                  Supplier cost
                  each:
                </strong>{" "}
                $
                {Number(
                  item.supplier_cost ||
                    0
                ).toFixed(2)}
              </p>

              {item.supplier_url ? (
                <a
                  href={
                    item.supplier_url
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{
                    display:
                      "inline-block",

                    background:
                      "#eee",
                  }}
                >
                  Open supplier
                  product →
                </a>
              ) : (
                <p>
                  No supplier URL
                  available.
                </p>
              )}
            </div>
          );
        }
      )}

      <hr />

      <p>
        <strong>
          Expected supplier
          order total
        </strong>
      </p>

      <p
        style={{
          fontSize:
            "24px",

          fontWeight:
            "800",

          marginTop:
            0,
        }}
      >
        $
        {totalExpectedSupplierCost.toFixed(
          2
        )}
      </p>

      <p>
        <strong>
          Copy-friendly order
          details
        </strong>
      </p>

      <textarea
        readOnly
        value={
          prepText
        }
        style={{
          width:
            "100%",

          minHeight:
            "340px",

          padding:
            "12px",

          fontFamily:
            "monospace",

          fontSize:
            "13px",
        }}
      />

      <p className="muted">
        On iPhone, press and
        hold inside this box
        to select and copy the
        order information.
      </p>
    </div>
  );
}

function DsersOrderExport({
  order,
  items,
}) {
  const missing =
    getDsersOrderMissingInfo(
      order,
      items
    );

  const ready =
    missing.length === 0;

  const csv =
    ready
      ? buildDsersOrderCsv(
          order,
          items
        )
      : "";

  return (
    <div
      style={{
        border:
          ready
            ? "2px solid #1f7a3d"
            : "2px solid #b7791f",

        background:
          ready
            ? "#f3faf5"
            : "#fffaf0",

        padding:
          "18px",

        borderRadius:
          "10px",

        margin:
          "24px 0",
      }}
    >
      <h3
        style={{
          marginTop:
            0,
        }}
      >
        DSers Order Export
      </h3>

      {ready ? (
        <>
          <p>
            ✓ Customer and
            product information
            needed for the DSers
            order file is present.
          </p>

          <p>
            <strong>
              DSers SKU
              mapping
            </strong>
          </p>

          {items.map(
            (
              item,
              index
            ) => (
              <p
                key={
                  index
                }
              >
                {item.product_name ||
                  "Product"}
                {item.variant_name
                  ? ` -- ${item.variant_name}`
                  : ""}
                <br />
                <strong>
                  SKU:
                </strong>{" "}
                {makeDsersSkuFromItem(
                  item
                )}
              </p>
            )
          )}

          <a
            href={`/api/dsers-order?id=${encodeURIComponent(
              order.id
            )}`}
            className="btn"
            style={{
              display:
                "inline-block",

              padding:
                "13px 18px",

              background:
                "#1d2a20",

              color:
                "white",

              textDecoration:
                "none",

              borderRadius:
                "7px",

              fontWeight:
                "700",
            }}
          >
            Download DSers
            Order CSV
          </a>

          <p
            className="muted"
            style={{
              marginTop:
                "14px",
            }}
          >
            Upload this file
            under DSers → CSV
            Upload → Orders.
          </p>
        </>
      ) : (
        <>
          <p>
            ⚠ This order cannot
            be exported to DSers
            yet.
          </p>

          <p>
            <strong>
              Missing:
            </strong>{" "}
            {missing.join(
              ", "
            )}
          </p>
        </>
      )}
    </div>
  );
}

function OrderManager({
  order,
}) {
  const status =
    order.fulfillment_status ||
    "unfulfilled";

  const amount =
    Number(
      order.amount_total ||
        0
    ) / 100;

  const supplierCost =
    order.supplier_cost ===
      null ||
    order.supplier_cost ===
      undefined
      ? ""
      : order.supplier_cost;

  const items =
    Array.isArray(
      order.items
    )
      ? order.items
      : [];

  const supplierReady =
    Boolean(
      String(
        order.shipping_address ||
          ""
      ).trim()
    ) &&
    items.length > 0 &&
    items.every(
      (item) =>
        getItemMissingInfo(
          item
        ).length === 0
    );

  const dsersMissing =
    getDsersOrderMissingInfo(
      order,
      items
    );

  const dsersReady =
    dsersMissing.length ===
    0;

  const orderReady =
    supplierReady &&
    dsersReady;

  return (
    <details
      className="panel"
      style={{
        marginTop:
          "16px",
      }}
    >
      <summary
        style={{
          cursor:
            "pointer",

          fontWeight:
            "700",
        }}
      >
        {order.customer_name ||
          "Customer"}
        {" -- "}$
        {amount.toFixed(2)}
        {" -- "}
        {status}
        {" -- "}
        {orderReady
          ? "READY"
          : "NEEDS INFO"}
      </summary>

      <div
        style={{
          marginTop:
            "20px",
        }}
      >
        <div
          style={{
            border:
              orderReady
                ? "1px solid #b7ddc1"
                : "1px solid #ecd29b",

            background:
              orderReady
                ? "#edf8f0"
                : "#fff7e6",

            padding:
              "12px",

            borderRadius:
              "8px",

            marginBottom:
              "20px",
          }}
        >
          <strong>
            {orderReady
              ? "✓ This order has the required supplier and DSers information."
              : "⚠ This order is not completely ready for fulfillment yet."}
          </strong>
        </div>

        <p>
          <strong>
            Customer
          </strong>
        </p>

        <p>
          {order.customer_name}
        </p>

        <p>
          {order.customer_email}
        </p>

        <p>
          {order.customer_phone ||
            "No phone number"}
        </p>

        <p>
          <strong>
            Shipping address
          </strong>
        </p>

        <p>
          {
            order.shipping_address
          }
        </p>

        {order.shipping_address_line1 && (
          <div
            style={{
              fontSize:
                "13px",
            }}
          >
            <p>
              <strong>
                Structured
                address:
              </strong>
            </p>

            <p>
              {
                order
                  .shipping_address_line1
              }

              {order
                .shipping_address_line2
                ? `, ${order.shipping_address_line2}`
                : ""}
            </p>

            <p>
              {
                order.shipping_city
              }
              ,{" "}
              {
                order.shipping_state
              }{" "}
              {
                order
                  .shipping_postal_code
              }
            </p>

            <p>
              {fullCountryName(
                order
                  .shipping_country
              )}
            </p>
          </div>
        )}

        <hr />

        <h3>
          Items
        </h3>

        {items.length >
        0 ? (
          items.map(
            (
              item,
              index
            ) => {
              const quantity =
                Number(
                  item.quantity ||
                    1
                );

              const unitPrice =
                Number(
                  item.unit_price ||
                    0
                );

              const itemSupplierCost =
                Number(
                  item.supplier_cost ||
                    0
                );

              const saleTotal =
                unitPrice *
                quantity;

              const supplierTotal =
                itemSupplierCost *
                quantity;

              const margin =
                saleTotal -
                supplierTotal;

              return (
                <div
                  key={
                    index
                  }
                  style={{
                    border:
                      "1px solid #ddd",

                    padding:
                      "16px",

                    borderRadius:
                      "8px",

                    marginBottom:
                      "14px",
                  }}
                >
                  <h4
                    style={{
                      marginTop:
                        0,
                    }}
                  >
                    {item.product_name ||
                      "Product"}
                  </h4>

                  {item.variant_name && (
                    <p>
                      <strong>
                        Variant:
                      </strong>{" "}
                      {
                        item.variant_name
                      }
                    </p>
                  )}

                  <p>
                    <strong>
                      Quantity:
                    </strong>{" "}
                    {quantity}
                  </p>

                  <p>
                    <strong>
                      Sale price:
                    </strong>{" "}
                    $
                    {unitPrice.toFixed(
                      2
                    )}
                  </p>

                  <p>
                    <strong>
                      Supplier cost:
                    </strong>{" "}
                    $
                    {itemSupplierCost.toFixed(
                      2
                    )}
                  </p>

                  <p>
                    <strong>
                      Estimated
                      margin:
                    </strong>{" "}
                    $
                    {margin.toFixed(
                      2
                    )}
                  </p>

                  <p>
                    <strong>
                      Supplier:
                    </strong>{" "}
                    {item.supplier ||
                      "Not set"}
                  </p>

                  {item.supplier_product_id && (
                    <p>
                      <strong>
                        Supplier
                        product ID:
                      </strong>{" "}
                      {
                        item
                          .supplier_product_id
                      }
                    </p>
                  )}

                  {item.supplier_variant_id && (
                    <p>
                      <strong>
                        Supplier
                        variant ID:
                      </strong>{" "}
                      {
                        item
                          .supplier_variant_id
                      }
                    </p>
                  )}

                  {item.supplier_sku && (
                    <p>
                      <strong>
                        Supplier
                        SKU:
                      </strong>{" "}
                      {
                        item
                          .supplier_sku
                      }
                    </p>
                  )}

                  <p>
                    <strong>
                      DSers SKU:
                    </strong>{" "}
                    {makeDsersSkuFromItem(
                      item
                    )}
                  </p>

                  {item.supplier_url && (
                    <p>
                      <a
                        href={
                          item.supplier_url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                        style={{
                          display:
                            "inline-block",

                          background:
                            "#eee",
                        }}
                      >
                        Open supplier
                        product →
                      </a>
                    </p>
                  )}
                </div>
              );
            }
          )
        ) : (
          <p>
            No item details
            available.
          </p>
        )}

        <DsersOrderExport
          order={order}
          items={items}
        />

        <SupplierPrep
          order={order}
          items={items}
        />

        <hr />

        <p>
          <strong>
            Payment
          </strong>
        </p>

        <p>
          Status:{" "}
          {order.payment_status}
        </p>

        <p>
          Sale amount: $
          {amount.toFixed(2)}
        </p>

        {order.estimated_profit !==
          null &&
          order.estimated_profit !==
            undefined && (
            <p>
              <strong>
                Order estimated
                profit: $
                {Number(
                  order
                    .estimated_profit
                ).toFixed(2)}
              </strong>
            </p>
          )}

        <hr />

        <h3>
          Fulfillment
        </h3>

        <form
          action={
            updateOrder
          }
          className="form"
        >
          <input
            type="hidden"
            name="order_id"
            value={
              order.id
            }
          />

          <label>
            Fulfillment
            status

            <select
              name="fulfillment_status"
              defaultValue={
                status
              }
              style={{
                width:
                  "100%",

                padding:
                  "13px",
              }}
            >
              <option value="unfulfilled">
                Unfulfilled
              </option>

              <option value="processing">
                Processing
              </option>

              <option value="ordered_from_supplier">
                Ordered from
                supplier
              </option>

              <option value="shipped">
                Shipped
              </option>

              <option value="delivered">
                Delivered
              </option>

              <option value="refunded">
                Refunded
              </option>
            </select>
          </label>

          <input
            name="supplier_order_id"
            defaultValue={
              order
                .supplier_order_id ||
              ""
            }
            placeholder="Supplier order ID"
          />

          <input
            name="supplier_order_status"
            defaultValue={
              order
                .supplier_order_status ||
              ""
            }
            placeholder="Supplier order status"
          />

          <input
            name="supplier_cost"
            type="number"
            step="0.01"
            defaultValue={
              supplierCost
            }
            placeholder="Actual supplier cost"
          />

          <input
            name="carrier"
            defaultValue={
              order.carrier ||
              ""
            }
            placeholder="Carrier -- e.g. USPS"
          />

          <input
            name="tracking_number"
            defaultValue={
              order
                .tracking_number ||
              ""
            }
            placeholder="Tracking number"
          />

          <button
            type="submit"
            className="primary"
          >
            Save order
          </button>
        </form>

        {order.fulfilled_at && (
          <p className="muted">
            Shipped:{" "}
            {new Date(
              order.fulfilled_at
            ).toLocaleString()}
          </p>
        )}

        {order.delivered_at && (
          <p className="muted">
            Delivered:{" "}
            {new Date(
              order.delivered_at
            ).toLocaleString()}
          </p>
        )}

        {order.refunded_at && (
          <p className="muted">
            Refunded:{" "}
            {new Date(
              order.refunded_at
            ).toLocaleString()}
          </p>
        )}
      </div>
    </details>
  );
}

export default async function Admin() {
  await requireAdmin();

  const db =
    createAdminClient();

  const [
    { data: products },
    { data: orders },
  ] =
    await Promise.all([
      db
        .from("products")
        .select("*")
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        ),

      db
        .from("orders")
        .select("*")
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        ),
    ]);

  const revenue =
    (orders || []).reduce(
      (
        sum,
        order
      ) =>
        sum +
        Number(
          order.amount_total ||
            0
        ),
      0
    ) / 100;

  const activeProducts =
    (products || []).filter(
      (product) =>
        product.active
    );

  const dsersProductsCsv =
    buildDsersProductsCsv(
      activeProducts
    );

  return (
    <main className="wrap">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">
            PRIVATE ADMIN
          </p>

          <h1>
            Southstar
            dashboard
          </h1>
        </div>

        <form
          action={
            logout
          }
        >
          <button>
            Sign out
          </button>
        </form>
      </div>

      <div className="stats">
        <div>
          ORDERS

          <b>
            {orders?.length ||
              0}
          </b>
        </div>

        <div>
          REVENUE

          <b>
            $
            {revenue.toFixed(
              2
            )}
          </b>
        </div>

        <div>
          PRODUCTS

          <b>
            {products?.length ||
              0}
          </b>
        </div>
      </div>

      <section className="panel">
        <h2>
          DSers CSV Bridge
        </h2>

        <p>
          Southstar can now
          prepare the product
          and order files needed
          for your DSers CSV
          sales channel.
        </p>

        <p>
          <strong>
            Step 1:
          </strong>{" "}
          Import your Southstar
          products into DSers
          and map them to their
          AliExpress supplier
          products.
        </p>

        <p>
          <strong>
            Step 2:
          </strong>{" "}
          When a customer order
          is ready, download its
          DSers Order CSV from
          the order below and
          upload it to DSers.
        </p>

        {activeProducts.length >
        0 ? (
          <a
            href="/api/dsers-products"
            className="btn"
            style={{
              display:
                "inline-block",

              padding:
                "13px 18px",

              background:
                "#1d2a20",

              color:
                "white",

              textDecoration:
                "none",

              borderRadius:
                "7px",

              fontWeight:
                "700",
            }}
          >
            Download DSers
            Products CSV
          </a>
        ) : (
          <p>
            No active products
            are available to
            export.
          </p>
        )}

        <p
          className="muted"
          style={{
            marginTop:
              "14px",
          }}
        >
          This export contains
          your active Southstar
          products and variants.
          Upload it under DSers
          → CSV Upload → Product.
        </p>
      </section>

      <section className="panel">
        <h2>
          Add product
        </h2>

        <form
          action={
            addProduct
          }
          className="form"
        >
          <input
            name="name"
            placeholder="Product name"
            required
          />

          <textarea
            name="description"
            placeholder="Description"
          />

          <input
            name="category"
            placeholder="Category"
          />

          <label>
            Product images

            <input
              name="images"
              type="file"
              accept="image/*"
              multiple
            />
          </label>

          <input
            name="price"
            type="number"
            step="0.01"
            placeholder="Southstar price"
            required
          />

          <input
            name="cost"
            type="number"
            step="0.01"
            placeholder="Supplier cost"
          />

          <input
            name="supplier"
            defaultValue="aliexpress"
            placeholder="Supplier"
          />

          <input
            name="supplier_url"
            placeholder="AliExpress product URL"
          />

          <input
            name="supplier_product_id"
            placeholder="AliExpress product ID"
          />

          <input
            name="supplier_variant_id"
            placeholder="Default AliExpress variant ID"
          />

          <input
            name="supplier_sku"
            placeholder="Default supplier SKU"
          />

          <hr />

          <h3>
            Product variants
          </h3>

          <p className="muted">
            Leave these blank
            if the product has
            no options.
          </p>

          <VariantRow
            number={1}
          />
          <VariantRow
            number={2}
          />
          <VariantRow
            number={3}
          />
          <VariantRow
            number={4}
          />
          <VariantRow
            number={5}
          />
          <VariantRow
            number={6}
          />

          <button
            type="submit"
            className="primary"
          >
            Add product
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>
          Manage products
        </h2>

        {(products || []).map(
          (product) => (
            <ProductEditor
              key={
                product.id
              }
              product={
                product
              }
            />
          )
        )}
      </section>

      <section className="panel">
        <h2>
          Orders &
          Fulfillment
        </h2>

        <p className="muted">
          Open an order to
          manage DSers export,
          supplier purchasing,
          shipping, tracking,
          and delivery.
        </p>

        {(orders || []).length >
        0 ? (
          (orders || []).map(
            (order) => (
              <OrderManager
                key={
                  order.id
                }
                order={
                  order
                }
              />
            )
          )
        ) : (
          <p>
            No orders yet.
          </p>
        )}
      </section>
    </main>
  );
}