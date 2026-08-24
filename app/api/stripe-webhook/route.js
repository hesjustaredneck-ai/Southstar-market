import Stripe from "stripe";
import { headers } from "next/headers";
import { createAdminClient } from "../../../lib/supabase/admin";

export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const body = await req.text();
  const h = await headers();

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      h.get("stripe-signature"),
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    return new Response(`Webhook error: ${e.message}`, {
      status: 400,
    });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const db = createAdminClient();

    const li = await stripe.checkout.sessions.listLineItems(s.id, {
      limit: 100,
    });

    // Newer Stripe API versions store shipping details here.
    // The fallback keeps compatibility with older sessions too.
    const shipping =
      s.collected_information?.shipping_details ??
      s.shipping_details;

    const a = shipping?.address;

    await db.from("orders").upsert(
      {
        stripe_session_id: s.id,
        amount_total: s.amount_total,
        payment_status: s.payment_status,
        customer_email: s.customer_details?.email || "",
        customer_name:
          shipping?.name ||
          s.customer_details?.name ||
          "",
        shipping_address: a
          ? [
              a.line1,
              a.line2,
              a.city,
              a.state,
              a.postal_code,
              a.country,
            ]
              .filter(Boolean)
              .join(", ")
          : "",
        items: li.data.map((x) => ({
          description: x.description,
          quantity: x.quantity,
          amount_total: x.amount_total,
        })),
      },
      {
        onConflict: "stripe_session_id",
      }
    );
  }

  return Response.json({ received: true });
}