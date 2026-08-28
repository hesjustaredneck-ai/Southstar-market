"use client";

import { useMemo, useState } from "react";

function clean(value) {
  return String(value || "").trim();
}

export default function BuyNowButton({
  productId,
  variants = [],
  basePrice = 0,
}) {
  const hasVariants =
    Array.isArray(variants) &&
    variants.length > 0;

  /*
    New multi-option variants can contain:
    option1_name
    option1_value
    option2_name
    option2_value

    Old products still work with the
    original single "name" field.
  */
  const isMultiOption =
    hasVariants &&
    variants.some(
      (variant) =>
        clean(variant?.option1_value) ||
        clean(variant?.option2_value)
    );

  const option1Name =
    clean(
      variants.find((v) =>
        clean(v?.option1_name)
      )?.option1_name
    ) || "Option 1";

  const option2Name =
    clean(
      variants.find((v) =>
        clean(v?.option2_name)
      )?.option2_name
    ) || "Option 2";

  const option1Values = useMemo(() => {
    if (!isMultiOption) return [];

    return [
      ...new Set(
        variants
          .map((variant) =>
            clean(
              variant?.option1_value
            )
          )
          .filter(Boolean)
      ),
    ];
  }, [variants, isMultiOption]);

  const option2Values = useMemo(() => {
    if (!isMultiOption) return [];

    return [
      ...new Set(
        variants
          .map((variant) =>
            clean(
              variant?.option2_value
            )
          )
          .filter(Boolean)
      ),
    ];
  }, [variants, isMultiOption]);

  const [selectedIndex, setSelectedIndex] =
    useState(
      hasVariants && !isMultiOption
        ? ""
        : null
    );

  const [option1, setOption1] =
    useState("");

  const [option2, setOption2] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const selectedMultiVariant =
    isMultiOption
      ? variants.find((variant) => {
          const matches1 =
            !option1Values.length ||
            clean(
              variant?.option1_value
            ) === option1;

          const matches2 =
            !option2Values.length ||
            clean(
              variant?.option2_value
            ) === option2;

          return (
            matches1 &&
            matches2
          );
        }) || null
      : null;

  const selectedVariant =
    isMultiOption
      ? selectedMultiVariant
      : hasVariants &&
        selectedIndex !== ""
      ? variants[
          Number(selectedIndex)
        ]
      : null;

  const selectedVariantIndex =
    selectedVariant
      ? variants.findIndex(
          (variant) =>
            variant ===
            selectedVariant
        )
      : -1;

  const displayedPrice =
    selectedVariant
      ? Number(
          selectedVariant.price ??
            basePrice
        )
      : Number(basePrice);

  const multiSelectionComplete =
    !isMultiOption ||
    ((!option1Values.length ||
      option1) &&
      (!option2Values.length ||
        option2));

  async function buyNow() {
    if (
      isMultiOption &&
      !multiSelectionComplete
    ) {
      alert(
        "Please choose all options first."
      );
      return;
    }

    if (
      isMultiOption &&
      !selectedVariant
    ) {
      alert(
        "That option combination is not available."
      );
      return;
    }

    if (
      hasVariants &&
      !isMultiOption &&
      selectedIndex === ""
    ) {
      alert(
        "Please choose an option first."
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/checkout",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              items: [
                {
                  id: productId,
                  qty: 1,

                  variantIndex:
                    hasVariants
                      ? selectedVariantIndex
                      : null,
                },
              ],
            }),
          }
        );

      const data =
        await response.json();

      if (data.url) {
        window.location.href =
          data.url;
        return;
      }

      alert(
        data.error ||
          "Checkout failed"
      );
    } catch (error) {
      alert(
        "Checkout failed. Please try again."
      );
    }

    setLoading(false);
  }

  const needsChoice =
    isMultiOption
      ? !multiSelectionComplete
      : hasVariants &&
        selectedIndex === "";

  return (
    <div className="buyNowArea">
      {isMultiOption ? (
        <>
          {option1Values.length >
            0 && (
            <div className="variantSelector">
              <label htmlFor="option1">
                <strong>
                  {option1Name}
                </strong>
              </label>

              <select
                id="option1"
                value={option1}
                onChange={(event) =>
                  setOption1(
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  Select{" "}
                  {option1Name}
                </option>

                {option1Values.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          {option2Values.length >
            0 && (
            <div className="variantSelector">
              <label htmlFor="option2">
                <strong>
                  {option2Name}
                </strong>
              </label>

              <select
                id="option2"
                value={option2}
                onChange={(event) =>
                  setOption2(
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  Select{" "}
                  {option2Name}
                </option>

                {option2Values.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                  )
                )}
              </select>
            </div>
          )}
        </>
      ) : (
        hasVariants && (
          <div className="variantSelector">
            <label htmlFor="variant">
              <strong>
                Choose an option
              </strong>
            </label>

            <select
              id="variant"
              value={
                selectedIndex
              }
              onChange={(
                event
              ) =>
                setSelectedIndex(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                Select an option
              </option>

              {variants.map(
                (
                  variant,
                  index
                ) => (
                  <option
                    key={`${variant.name}-${index}`}
                    value={index}
                  >
                    {variant.name}{" "}
                    -- $
                    {Number(
                      variant.price ??
                        basePrice
                    ).toFixed(2)}
                  </option>
                )
              )}
            </select>
          </div>
        )
      )}

      {selectedVariant && (
        <p className="selectedVariantPrice">
          $
          {displayedPrice.toFixed(
            2
          )}
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
          : needsChoice
          ? "Choose your options"
          : "Buy now"}
      </button>
    </div>
  );
}