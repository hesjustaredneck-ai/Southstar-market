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

async function addProduct(fd) {
  "use server";

  await requireAdmin();

  const db = createAdminClient();

  const files = fd
    .getAll("images")
    .filter((file) => file instanceof File && file.size > 0);

  const imageUrls = [];

  for (const file of files) {
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const path = `${Date.now()}-${randomUUID()}.${extension}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await db.storage
      .from("Product-image")
      .upload(path, buffer, {
        contentType: file.type || "image/jpeg",
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

  const { error: insertError } = await db
    .from("products")
    .insert({
      name: String(fd.get("name") || ""),
      description: String(fd.get("description") || ""),
      category: String(fd.get("category") || ""),

      // First image is used by the existing storefront.
      image_url: imageUrls[0] || "",

      // All uploaded images are stored here.
      image_urls: imageUrls,

      price: Number(fd.get("price")),
      cost: Number(fd.get("cost")),

      supplier: String(
        fd.get("supplier") || "aliexpress"
      ),

      supplier_url: String(
        fd.get("supplier_url") || ""
      ),

      supplier_product_id: String(
        fd.get("supplier_product_id") || ""
      ),

      supplier_variant_id: String(
        fd.get("supplier_variant_id") || ""
      ),

      supplier_sku: String(
        fd.get("supplier_sku") || ""
      ),

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

export default async function Admin() {
  await requireAdmin();

  const db = createAdminClient();

  const [{ data: products }, { data: orders }] =
    await Promise.all([
      db
        .from("products")
        .select("*")
        .order("created_at", { ascending: false }),

      db
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

  const revenue =
    (orders || []).reduce(
      (sum, order) =>
        sum + Number(order.amount_total || 0),
      0
    ) / 100;

  return (
    <main className="wrap">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">PRIVATE ADMIN</p>
          <h1>Southstar dashboard</h1>
        </div>

        <form action={logout}>
          <button>Sign out</button>
        </form>
      </div>

      <div className="stats">
        <div>
          ORDERS
          <b>{orders?.length || 0}</b>
        </div>

        <div>
          REVENUE
          <b>${revenue.toFixed(2)}</b>
        </div>

        <div>
          PRODUCTS
          <b>{products?.length || 0}</b>
        </div>
      </div>

      <section className="panel">
        <h2>Add product</h2>

        <form action={addProduct} className="form">
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
            placeholder="AliExpress variant ID"
          />

          <input
            name="supplier_sku"
            placeholder="Supplier SKU"
          />

          <button type="submit">
            Add product
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Orders</h2>

        {(orders || []).map((order) => (
          <div key={order.id}>
            <p>
              <strong>
                {order.customer_name || "Customer"}
              </strong>
            </p>

            <p>{order.customer_email}</p>

            <p>{order.shipping_address}</p>

            <p>
              Amount: $
              {(
                Number(order.amount_total || 0) / 100
              ).toFixed(2)}
            </p>

            <p>
              Payment: {order.payment_status}
            </p>

            <p>
              Fulfillment:{" "}
              {order.fulfillment_status ||
                "unfulfilled"}
            </p>

            <pre>
              {JSON.stringify(order.items, null, 2)}
            </pre>
          </div>
        ))}
      </section>
    </main>
  );
}