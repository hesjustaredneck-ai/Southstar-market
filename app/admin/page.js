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

    const priceValue = String(prices[i] || "").trim();
    const costValue = String(costs[i] || "").trim();

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
    if (!(file instanceof File) || file.size <= 0) {
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

    imageUrls.push(data.publicUrl);
  }

  return imageUrls;
}

async function addProduct(fd) {
  "use server";

  await requireAdmin();

  const db = createAdminClient();

  const files = fd
    .getAll("images")
    .filter(
      (file) =>
        file instanceof File &&
        file.size > 0
    );

  const imageUrls =
    await uploadImages(db, files);

  const basePrice =
    Number(fd.get("price") || 0);

  const baseCost =
    Number(fd.get("cost") || 0);

  const variants =
    buildVariants(
      fd,
      basePrice,
      baseCost
    );

  const { error } = await db
    .from("products")
    .insert({
      name:
        String(fd.get("name") || ""),

      description:
        String(
          fd.get("description") || ""
        ),

      category:
        String(
          fd.get("category") || ""
        ),

      image_url:
        imageUrls[0] || "",

      image_urls:
        imageUrls,

      price:
        basePrice,

      cost:
        baseCost,

      supplier:
        String(
          fd.get("supplier") ||
            "aliexpress"
        ),

      supplier_url:
        String(
          fd.get("supplier_url") || ""
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

      supplier_sku:
        String(
          fd.get("supplier_sku") || ""
        ),

      variants,

      auto_fulfill: false,

      active: true,
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

  const db = createAdminClient();

  const productId =
    String(fd.get("product_id") || "");

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
    .eq("id", productId)
    .maybeSingle();

  if (existingError || !existing) {
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
    Array.isArray(existing.image_urls)
      ? existing.image_urls
      : [];

  let mainImage =
    existing.image_url || "";

  /*
    If new images are uploaded while editing,
    they replace the current gallery.
    If no images are uploaded, the old images remain.
  */
  if (files.length > 0) {
    imageUrls =
      await uploadImages(db, files);

    mainImage =
      imageUrls[0] || "";
  }

  const basePrice =
    Number(fd.get("price") || 0);

  const baseCost =
    Number(fd.get("cost") || 0);

  const variants =
    buildVariants(
      fd,
      basePrice,
      baseCost
    );

  const { error } = await db
    .from("products")
    .update({
      name:
        String(fd.get("name") || ""),

      description:
        String(
          fd.get("description") || ""
        ),

      category:
        String(
          fd.get("category") || ""
        ),

      image_url:
        mainImage,

      image_urls:
        imageUrls,

      price:
        basePrice,

      cost:
        baseCost,

      supplier:
        String(
          fd.get("supplier") ||
            "aliexpress"
        ),

      supplier_url:
        String(
          fd.get("supplier_url") || ""
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

      supplier_sku:
        String(
          fd.get("supplier_sku") || ""
        ),

      variants,
    })
    .eq("id", productId);

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

  const db = createAdminClient();

  const productId =
    String(fd.get("product_id") || "");

  const currentActive =
    String(fd.get("current_active"))
      .toLowerCase() === "true";

  const { error } = await db
    .from("products")
    .update({
      active: !currentActive,
    })
    .eq("id", productId);

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

  const db = createAdminClient();

  const productId =
    String(fd.get("product_id") || "");

  const confirmation =
    String(
      fd.get("delete_confirmation") || ""
    )
      .trim()
      .toUpperCase();

  if (confirmation !== "DELETE") {
    throw new Error(
      "Delete cancelled. Type DELETE exactly to confirm."
    );
  }

  const { error } = await db
    .from("products")
    .delete()
    .eq("id", productId);

  if (error) {
    throw new Error(
      `Product deletion failed: ${error.message}`
    );
  }

  redirect("/admin");
}

async function logout() {
  "use server";

  const s = await createClient();

  await s.auth.signOut();

  redirect("/login");
}

function VariantRow({
  number,
  variant = null,
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
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
          variant?.price ?? ""
        }
        placeholder="Selling price -- blank = main price"
      />

      <input
        name="variant_cost"
        type="number"
        step="0.01"
        defaultValue={
          variant?.cost ?? ""
        }
        placeholder="Supplier cost -- blank = main cost"
      />

      <input
        name="variant_id"
        defaultValue={
          variant?.supplier_variant_id ||
          ""
        }
        placeholder="AliExpress variant ID"
      />

      <input
        name="variant_sku"
        defaultValue={
          variant?.supplier_sku || ""
        }
        placeholder="Supplier SKU"
      />
    </div>
  );
}

function ProductEditor({ product }) {
  const variants =
    Array.isArray(product.variants)
      ? product.variants
      : [];

  return (
    <details
      className="panel"
      style={{
        marginTop: "16px",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: "700",
        }}
      >
        {product.name}
        {" -- "}
        $
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
          marginTop: "20px",
        }}
      >
        <form
          action={updateProduct}
          className="form"
        >
          <input
            type="hidden"
            name="product_id"
            value={product.id}
          />

          <input
            name="name"
            defaultValue={
              product.name || ""
            }
            placeholder="Product name"
            required
          />

          <textarea
            name="description"
            defaultValue={
              product.description || ""
            }
            placeholder="Description"
          />

          <input
            name="category"
            defaultValue={
              product.category || ""
            }
            placeholder="Category"
          />

          <label>
            Replace product images
            <input
              name="images"
              type="file"
              accept="image/*"
              multiple
            />
          </label>

          <p className="muted">
            Leave images blank to keep
            the current gallery.
          </p>

          <input
            name="price"
            type="number"
            step="0.01"
            defaultValue={
              product.price ?? ""
            }
            placeholder="Southstar price"
            required
          />

          <input
            name="cost"
            type="number"
            step="0.01"
            defaultValue={
              product.cost ?? ""
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
              product.supplier_url || ""
            }
            placeholder="AliExpress product URL"
          />

          <input
            name="supplier_product_id"
            defaultValue={
              product.supplier_product_id ||
              ""
            }
            placeholder="AliExpress product ID"
          />

          <input
            name="supplier_variant_id"
            defaultValue={
              product.supplier_variant_id ||
              ""
            }
            placeholder="Default AliExpress variant ID"
          />

          <input
            name="supplier_sku"
            defaultValue={
              product.supplier_sku || ""
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
                key={index}
                number={index + 1}
                variant={
                  variants[index] ||
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
            margin: "28px 0",
          }}
        />

        <form action={toggleProduct}>
          <input
            type="hidden"
            name="product_id"
            value={product.id}
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
            margin: "28px 0",
          }}
        />

        <div>
          <h3>
            Delete product
          </h3>

          <p className="muted">
            This removes the product
            listing. Historical order
            records remain in the
            orders table.
          </p>

          <form
            action={deleteProduct}
            className="form"
          >
            <input
              type="hidden"
              name="product_id"
              value={product.id}
            />

            <input
              name="delete_confirmation"
              placeholder='Type "DELETE" to confirm'
            />

            <button
              type="submit"
              style={{
                background: "#eee",
              }}
            >
              Delete product
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}

export default async function Admin() {
  await requireAdmin();

  const db = createAdminClient();

  const [
    { data: products },
    { data: orders },
  ] = await Promise.all([
    db
      .from("products")
      .select("*")
      .order("created_at", {
        ascending: false,
      }),

    db
      .from("orders")
      .select("*")
      .order("created_at", {
        ascending: false,
      }),
  ]);

  const revenue =
    (orders || []).reduce(
      (sum, order) =>
        sum +
        Number(
          order.amount_total || 0
        ),
      0
    ) / 100;

  return (
    <main className="wrap">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">
            PRIVATE ADMIN
          </p>

          <h1>
            Southstar dashboard
          </h1>
        </div>

        <form action={logout}>
          <button>
            Sign out
          </button>
        </form>
      </div>

      <div className="stats">
        <div>
          ORDERS
          <b>
            {orders?.length || 0}
          </b>
        </div>

        <div>
          REVENUE
          <b>
            ${revenue.toFixed(2)}
          </b>
        </div>

        <div>
          PRODUCTS
          <b>
            {products?.length || 0}
          </b>
        </div>
      </div>

      <section className="panel">
        <h2>
          Add product
        </h2>

        <form
          action={addProduct}
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

          <div>
            <p className="eyebrow">
              OPTIONAL
            </p>

            <h3>
              Product variants
            </h3>

            <p className="muted">
              Leave these blank if the
              product has no options.
            </p>
          </div>

          <VariantRow number={1} />
          <VariantRow number={2} />
          <VariantRow number={3} />
          <VariantRow number={4} />
          <VariantRow number={5} />
          <VariantRow number={6} />

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

        <p className="muted">
          Tap a product below to edit
          its listing, variants,
          supplier information, status,
          or images.
        </p>

        {(products || []).map(
          (product) => (
            <ProductEditor
              key={product.id}
              product={product}
            />
          )
        )}
      </section>

      <section className="panel">
        <h2>
          Orders
        </h2>

        {(orders || []).map(
          (order) => (
            <div
              className="order"
              key={order.id}
            >
              <p>
                <strong>
                  {order.customer_name ||
                    "Customer"}
                </strong>
              </p>

              <p>
                {order.customer_email}
              </p>

              <p>
                {order.shipping_address}
              </p>

              <p>
                Amount: $
                {(
                  Number(
                    order.amount_total ||
                      0
                  ) / 100
                ).toFixed(2)}
              </p>

              <p>
                Payment:{" "}
                {order.payment_status}
              </p>

              <p>
                Fulfillment:{" "}
                {order.fulfillment_status ||
                  "unfulfilled"}
              </p>

              <pre>
                {JSON.stringify(
                  order.items,
                  null,
                  2
                )}
              </pre>
            </div>
          )
        )}
      </section>
    </main>
  );
}