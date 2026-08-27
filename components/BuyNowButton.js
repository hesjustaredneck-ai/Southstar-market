"use client";

import { useState } from "react";

export default function BuyNowButton({
  productId,
  variants = [],
  basePrice = 0,
}) {
  const hasVariants =
    Array.isArray(variants) && variants.length > 0;

  const [selectedIndex, setSelectedIndex] =
    useState(hasVariants ? "" : null);

  const [loading, setLoading] = useState(false);

  const selectedVariant =
    hasVariants && selectedIndex !== ""
      ? variants[Number(selectedIndex)]
      : null;

  const displayedPrice = selectedVariant
    ? Number(selectedVariant.price ?? basePrice)
    : Number(basePrice);

  async function buyNow() {
    if (hasVariants && selectedIndex === "") {
      alert("Please choose an option first.");
      return;
    }

    setLoading(true);

    try {
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

              variantIndex: hasVariants
                ? Number(selectedIndex)
                : null,
            },
          ],
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      alert(data.error || "Checkout failed");
    } catch (error) {
      alert("Checkout failed. Please try again.");
    }

    setLoading(false);
  }

  return (
    <div className="buyNowArea">
      {hasVariants && (
        <div className="variantSelector">
          <label htmlFor="variant">
            <strong>Choose an option</strong>
          </label>

          <select
            id="variant"
            value={selectedIndex}
            onChange={(event) =>
              setSelectedIndex(event.target.value)
            }
          >
            <option value="">
              Select an option
            </option>

            {variants.map((variant, index) => (
              <option
                key={`${variant.name}-${index}`}
                value={index}
              >
                {variant.name} -- $
                {Number(
                  variant.price ?? basePrice
                ).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedVariant && (
        <p className="selectedVariantPrice">
          ${displayedPrice.toFixed(2)}
        </p>
      )}

      <button
        type="button"
        className="primary"
        onClick={buyNow}
        disabled={loading}
      >
        {loading
          ? "Opening checkout…"
          : hasVariants && selectedIndex === ""
          ? "Choose an option"
          : "Buy now"}
      </button>
    </div>
  );
}