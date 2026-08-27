import Stripe from "stripe";
import { createAdminClient } from "../../../lib/supabase/admin";

export async function POST(req) {
  try {
    const stripe = new Stripe(
      process.env.STRIPE_SECRET_KEY
    );

    const db =
      createAdminClient();

    const { items } =
      await req.json();

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return Response.json(
        {
          error: "Cart empty",
        },
        {
          status: 400,
        }
      );
    }

    const productIds = [
      ...new Set(
        items.map(
          (item) => item.id
        )
      ),
    ];

    const {
      data: products,
      error: productError,
    } = await db
      .from("products")
      .select(`
        id,
        name,
        price,
        cost,
        supplier,
        supplier_url,
        supplier_product_id,
        supplier_variant_id,
        supplier_sku,
        variants,
        active
      `)
      .in(
        "id",
        productIds
      )
      .eq(
        "active",
        true
      );

    if (productError) {
      throw new Error(
        productError.message
      );
    }

    const productMap =
      new Map(
        (
          products || []
        ).map(
          (product) => [
            product.id,
            product,
          ]
        )
      );

    const line_items =
      items.map((item) => {
        const product =
          productMap.get(
            item.id
          );

        if (!product) {
          throw new Error(
            "Invalid product"
          );
        }

        const quantity =
          Math.max(
            1,
            Math.min(
              20,
              Number(
                item.qty
              ) || 1
            )
          );

        const variants =
          Array.isArray(
            product.variants
          )
            ? product.variants
            : [];

        let finalPrice =
          Number(
            product.price
          );

        let productName =
          product.name;

        let selectedVariant =
          null;

        if (
          variants.length >
          0
        ) {
          const variantIndex =
            Number(
              item.variantIndex
            );

          if (
            !Number.isInteger(
              variantIndex
            ) ||
            variantIndex <
              0 ||
            variantIndex >=
              variants.length
          ) {
            throw new Error(
              `Please select a valid option for ${product.name}`
            );
          }

          selectedVariant =
            variants[
              variantIndex
            ];

          finalPrice =
            Number(
              selectedVariant
                .price ??
                product.price
            );

          productName =
            `${product.name} -- ${selectedVariant.name}`;
        }

        if (
          !Number.isFinite(
            finalPrice
          ) ||
          finalPrice <= 0
        ) {
          throw new Error(
            `Invalid price for ${product.name}`
          );
        }

        const supplierCost =
          Number(
            selectedVariant
              ?.cost ??
              product.cost ??
              0
          );

        const supplierVariantId =
          selectedVariant
            ?.supplier_variant_id ||
          product
            .supplier_variant_id ||
          "";

        const supplierSku =
          selectedVariant
            ?.supplier_sku ||
          product.supplier_sku ||
          "";

        return {
          quantity,

          price_data: {
            currency:
              "usd",

            unit_amount:
              Math.round(
                finalPrice *
                  100
              ),

            product_data: {
              name:
                productName,

              metadata: {
                product_id:
                  String(
                    product.id ||
                      ""
                  ),

                product_name:
                  String(
                    product.name ||
                      ""
                  ),

                variant_name:
                  String(
                    selectedVariant
                      ?.name ||
                      ""
                  ),

                variant_index:
                  selectedVariant
                    ? String(
                        item.variantIndex
                      )
                    : "",

                supplier:
                  String(
                    product
                      .supplier ||
                      ""
                  ),

                supplier_url:
                  String(
                    product
                      .supplier_url ||
                      ""
                  ).slice(
                    0,
                    500
                  ),

                supplier_product_id:
                  String(
                    product
                      .supplier_product_id ||
                      ""
                  ),

                supplier_variant_id:
                  String(
                    supplierVariantId
                  ),

                supplier_sku:
                  String(
                    supplierSku
                  ),

                supplier_cost:
                  String(
                    Number.isFinite(
                      supplierCost
                    )
                      ? supplierCost
                      : 0
                  ),
              },
            },
          },
        };
      });

    const origin =
      process.env
        .NEXT_PUBLIC_SITE_URL;

    if (!origin) {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL is missing"
      );
    }

    const session =
      await stripe.checkout.sessions.create(
        {
          mode:
            "payment",

          line_items,

          customer_creation:
            "always",

          phone_number_collection:
            {
              enabled:
                true,
            },

          shipping_address_collection:
            {
              allowed_countries:
                ["US"],
            },

          saved_payment_method_options:
            {
              payment_method_save:
                "enabled",
            },

          success_url:
            `${origin}/success`,

          cancel_url:
            `${origin}/`,
        }
      );

    return Response.json({
      url:
        session.url,
    });
  } catch (error) {
    console.error(
      "Checkout error:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Checkout failed",
      },
      {
        status: 500,
      }
    );
  }
}