import Stripe from "stripe";
import { headers } from "next/headers";
import { createAdminClient } from "../../../lib/supabase/admin";

export async function POST(req) {
  const stripe = new Stripe(
    process.env.STRIPE_SECRET_KEY
  );

  const body =
    await req.text();

  const h =
    await headers();

  let event;

  try {
    event =
      stripe.webhooks.constructEvent(
        body,
        h.get(
          "stripe-signature"
        ),
        process.env
          .STRIPE_WEBHOOK_SECRET
      );
  } catch (error) {
    return new Response(
      `Webhook error: ${error.message}`,
      {
        status: 400,
      }
    );
  }

  if (
    event.type ===
    "checkout.session.completed"
  ) {
    const session =
      event.data.object;

    const db =
      createAdminClient();

    const lineItems =
      await stripe.checkout.sessions
        .listLineItems(
          session.id,
          {
            limit: 100,

            expand: [
              "data.price.product",
            ],
          }
        );

    const shipping =
      session
        .collected_information
        ?.shipping_details ??
      session.shipping_details;

    const address =
      shipping?.address;

    const items =
      lineItems.data.map(
        (lineItem) => {
          const stripeProduct =
            lineItem.price
              ?.product;

          const metadata =
            stripeProduct &&
            typeof stripeProduct ===
              "object"
              ? stripeProduct.metadata ||
                {}
              : {};

          const quantity =
            Number(
              lineItem.quantity ||
                1
            );

          const amountTotal =
            Number(
              lineItem.amount_total ||
                0
            );

          const unitPrice =
            quantity > 0
              ? amountTotal /
                quantity /
                100
              : 0;

          return {
            product_id:
              metadata.product_id ||
              "",

            product_name:
              metadata.product_name ||
              lineItem.description ||
              "",

            variant_name:
              metadata.variant_name ||
              "",

            quantity,

            unit_price:
              unitPrice,

            amount_total:
              amountTotal,

            supplier:
              metadata.supplier ||
              "",

            supplier_url:
              metadata.supplier_url ||
              "",

            supplier_product_id:
              metadata
                .supplier_product_id ||
              "",

            supplier_variant_id:
              metadata
                .supplier_variant_id ||
              "",

            supplier_sku:
              metadata.supplier_sku ||
              "",

            supplier_cost:
              Number(
                metadata
                  .supplier_cost ||
                  0
              ),
          };
        }
      );

    const totalSupplierCost =
      items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.supplier_cost ||
              0
          ) *
            Number(
              item.quantity ||
                1
            ),
        0
      );

    const saleAmount =
      Number(
        session.amount_total ||
          0
      ) / 100;

    const estimatedProfit =
      saleAmount -
      totalSupplierCost;

    const customerPhone =
      session
        .customer_details
        ?.phone ||
      shipping?.phone ||
      "";

    const {
      error: orderError,
    } = await db
      .from("orders")
      .upsert(
        {
          stripe_session_id:
            session.id,

          amount_total:
            session.amount_total,

          payment_status:
            session.payment_status,

          customer_email:
            session
              .customer_details
              ?.email || "",

          customer_name:
            shipping?.name ||
            session
              .customer_details
              ?.name ||
            "",

          customer_phone:
            customerPhone,

          shipping_address:
            address
              ? [
                  address.line1,
                  address.line2,
                  address.city,
                  address.state,
                  address.postal_code,
                  address.country,
                ]
                  .filter(
                    Boolean
                  )
                  .join(", ")
              : "",

          shipping_address_line1:
            address?.line1 ||
            "",

          shipping_address_line2:
            address?.line2 ||
            "",

          shipping_city:
            address?.city ||
            "",

          shipping_state:
            address?.state ||
            "",

          shipping_postal_code:
            address
              ?.postal_code ||
            "",

          shipping_country:
            address?.country ||
            "",

          items,

          supplier_cost:
            totalSupplierCost,

          estimated_profit:
            estimatedProfit,

          fulfillment_status:
            "unfulfilled",
        },
        {
          onConflict:
            "stripe_session_id",
        }
      );

    if (orderError) {
      console.error(
        "Order save failed:",
        orderError
      );

      return new Response(
        "Order save failed",
        {
          status: 500,
        }
      );
    }
  }

  return Response.json({
    received: true,
  });
}