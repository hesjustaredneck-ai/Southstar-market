import BuyNowButton from "../../../components/BuyNowButton";
import { notFound } from "next/navigation";
import { createAdminClient } from "../../../lib/supabase/admin";

export default async function ProductPage({ params }) {
  const { id } = await params;

  const db = createAdminClient();

  const { data: product, error } = await db
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !product || !product.active) {
    notFound();
  }

  const images =
    Array.isArray(product.image_urls) &&
    product.image_urls.length > 0
      ? product.image_urls
      : product.image_url
      ? [product.image_url]
      : [];

  const variants =
    Array.isArray(product.variants)
      ? product.variants
      : [];

  return (
    <main className="wrap">
      <section className="panel productPage">
        <a href="/" className="backLink">
          ← Back to shop
        </a>

        <div className="productGallery">
          {images.length > 0 ? (
            <div className="galleryScroller">
              {images.map((src, index) => (
                <img
                  key={`${src}-${index}`}
                  src={src}
                  alt={`${product.name} image ${index + 1}`}
                  className="productGalleryImage"
                />
              ))}
            </div>
          ) : (
            <div className="productImagePlaceholder">
              No image available
            </div>
          )}
        </div>

        <div className="productInfo">
          <p className="eyebrow">
            {product.category || "SOUTHSTAR FIND"}
          </p>

          <h1>{product.name}</h1>

          <p className="productPrice">
            {variants.length > 0
              ? `From $${Math.min(
                  ...variants.map((variant) =>
                    Number(
                      variant.price ??
                        product.price ??
                        0
                    )
                  )
                ).toFixed(2)}`
              : `$${Number(
                  product.price || 0
                ).toFixed(2)}`}
          </p>

          <p className="productDescription">
            {product.description}
          </p>

          <BuyNowButton
            productId={product.id}
            variants={variants}
            basePrice={Number(product.price || 0)}
          />

          <div className="productTrust">
            <p>Secure checkout</p>
            <p>Tracked orders</p>
            <p>Customer support</p>
          </div>
        </div>
      </section>
    </main>
  );
}