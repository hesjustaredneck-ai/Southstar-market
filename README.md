# Southstar Market — production starter

This version is a real full-stack starter rather than the single-file preview.

## What is wired
- Public product catalog
- Server-validated cart pricing
- Stripe Checkout
- Optional "save payment method" checkbox managed by Stripe
- Shipping address collection
- Stripe webhook -> order database
- Supabase database
- Private admin login
- Admin-only supplier cost and supplier URL
- Add/delete products
- Paid-order dashboard

## What still needs your accounts before it can go live
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Create one Auth user for yourself in Supabase.
4. Copy that user's UUID and run:
   `insert into public.admins(user_id) values ('YOUR-USER-UUID');`
5. Create a Stripe account and copy the test secret key.
6. Fill `.env.local` using `.env.example`.
7. Install and run:
   `npm install`
   `npm run dev`
8. In Stripe, add a webhook pointing to:
   `https://YOUR-DOMAIN.com/api/stripe-webhook`
   Subscribe to `checkout.session.completed`.
9. Put the Stripe webhook signing secret into `.env.local`.

## Security notes
- Never put `STRIPE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in browser code.
- Never store full card numbers, CVCs, or raw payment credentials yourself.
- Supplier URL and cost are fetched only inside the admin.
- Before launch, add Terms, Privacy, Shipping, Returns, and supplier/IP checks.

## Next implementation step
Add fulfillment-status editing, tracking emails, and an SMS/push provider call inside the Stripe webhook.


## Southstar deployment note
Use the Supabase project named `Southstar` for the Vercel environment variables. Keep all secret keys in Vercel and never commit them to GitHub.
