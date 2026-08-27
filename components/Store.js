"use client";

import { useMemo, useState } from "react";

export default function Store({ products }) {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.price) * item.qty,
        0
      ),
    [cart]
  );

  function add(product) {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);

      return found
        ? current.map((item) =>
            item.id === product.id
              ? { ...item, qty: item.qty + 1 }
              : item
          )
        : [...current, { ...product, qty: 1 }];
    });
  }

  async function checkout() {
    setLoading(true);

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: cart.map((item) => ({
          id: item.id,
          qty: item.qty,
        })),
      }),
    });

    const data = await response.json();

    if (data.url) {
      location.href = data.url;
    } else {
      alert(data.error || "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">
            CURATED FINDS • SHIPPED TO YOU
          </p>

          <h1>
            Useful products.
            <br />
            <em>Simple shopping.</em>
          </h1>

          <p>
            Discover practical products with secure checkout
            and straightforward delivery.
          </p>

          <a className="btn primary" href="#products">
            Shop products →
          </a>
        </div>

        <div className="heroCard">
          ✦
          <small>
            SOUTHSTAR
            <br />
            MARKET
          </small>
        </div>
      </section>

      <main className="wrap" id="products">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">THE COLLECTION</p>
            <h2>Products</h2>
          </div>
        </div>

        <div className="grid">
          {products.length ? (
            products.map((product) => (
              <article className="product" key={product.id}>
                <a
                  href={`/product/${product.id}`}
                  className="productLink"
                >
                  <div className="pic">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                      />
                    ) : (
                      "📦"
                    )}
                  </div>

                  <div className="meta">
                    <span>
                      {product.category || "Product"}
                    </span>

                    <b>
                      ${Number(product.price).toFixed(2)}
                    </b>
                  </div>

                  <h3>{product.name}</h3>
                </a>

                <button onClick={() => add(product)}>
                  Add to cart
                </button>
              </article>
            ))
          ) : (
            <div className="panel">
              <b>Southstar is ready.</b>
              <p>
                Add your first product from the private
                admin dashboard.
              </p>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <section className="panel">
            <h2>Cart</h2>

            {cart.map((item) => (
              <div className="row" key={item.id}>
                <span>
                  {item.name} × {item.qty}
                </span>

                <b>
                  $
                  {(
                    Number(item.price) * item.qty
                  ).toFixed(2)}
                </b>
              </div>
            ))}

            <div className="row total">
              <b>Total</b>
              <b>${total.toFixed(2)}</b>
            </div>

            <button
              className="primary"
              onClick={checkout}
              disabled={loading}
            >
              {loading
                ? "Opening checkout…"
                : "Secure checkout →"}
            </button>

            <p className="muted">
              Payment information is securely handled by
              Stripe.
            </p>
          </section>
        )}
      </main>
    </>
  );
}