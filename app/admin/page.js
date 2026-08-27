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

    // Empty rows are ignored.
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

  const imageUrls = [];

  for (const file of files) {
    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase() || "jpg";

    const path = `${Date.now()}-${randomUUID()}.${extension}`;

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

  const basePrice = Number(
    fd.get("price") || 0
  );

  const baseCost = Number(
    fd.get("cost") || 0
  );

  const variants = buildVariants(
    fd,
    basePrice,
    baseCost
  );

  const { error: insertError } = await db
    .from("products")
    .insert({
      name: String(
        fd.get("name") || ""
      ),

      description: String(
        fd.get("description") || ""
      ),

      category: String(
        fd.get("category") || ""
      ),

      // Existing storefront compatibility.
      image_url:
        imageUrls[0] || "",

      // Full image gallery.
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
        fd.get("supplier_url") || ""
      ),

      supplier_product_id: String(
        fd.get(
          "supplier_product_id"
        ) || ""
      ),

      // These remain useful for products
      // that do NOT have variants.
      supplier_variant_id: String(
        fd.get(
          "supplier_variant_id"
        ) || ""
      ),

      supplier_sku: String(
        fd.get("supplier_sku") || ""
      ),

      variants,

      // We still keep automatic purchasing
      // disabled until fulfillment is tested.
      auto_fulfill: false,

      active: true,
    });

  if (insertError) {
    throw new Error(
      `Product creation failed: ${insertError.message}`
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

function VariantRow({ number }) {
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
        placeholder="Variant name -- e.g. Black / Red"
      />

      <input
        name="variant_price"
        type="number"
        step="0.01"
        placeholder="Selling price -- blank = main price"
      />

      <input
        name="variant_cost"
        type="number"
        step="0.01"
        placeholder="Supplier cost -- blank = main cost"
      />

      <input
        name="variant_id"
        placeholder="AliExpress variant ID"
      />

      <input
        name="variant_sku"
        placeholder="Supplier SKU"
      />
    </div>
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
              Use them for colors,
              sizes, styles, bundles,
              or other choices.
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
          Products
        </h2>

        {(products || []).map(
          (product) => (
            <div
              className="order"
              key={product.id}
            >
              <strong>
                {product.name}
              </strong>

              <p>
                $
                {Number(
                  product.price || 0
                ).toFixed(2)}
              </p>

              <p className="muted">
                Supplier:{" "}
                {product.supplier ||
                  "Not set"}
              </p>

              {Array.isArray(
                product.variants
              ) &&
                product.variants
                  .length > 0 && (
                  <div>
                    <strong>
                      Variants:
                    </strong>

                    <ul>
                      {product.variants.map(
                        (
                          variant,
                          index
                        ) => (
                          <li
                            key={index}
                          >
                            {
                              variant.name
                            }{" "}
                            -- $
                            {Number(
                              variant.price ||
                                product.price ||
                                0
                            ).toFixed(
                              2
                            )}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
            </div>
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
                {
                  order.customer_email
                }
              </p>

              <p>
                {
                  order.shipping_address
                }
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
                {
                  order.payment_status
                }
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