"use client";

import { useState } from "react";

export default function BuyNowButton({ productId }) {
  const [loading, setLoading] = useState(false);

  async function buyNow() {
    setLoading(true);

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            id: productId,
            qty: 1,
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={buyNow}
      disabled={loading}
    >
      {loading ? "Opening checkout…" : "Buy now"}
    </button>
  );
}