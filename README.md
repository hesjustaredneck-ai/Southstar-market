# Southstar Market
Complete Next.js storefront with Supabase admin/database integration and Stripe-ready checkout.

## Deployment
Upload the CONTENTS of this folder to the root of the GitHub repository. Vercel should detect Next.js automatically.

Required Vercel environment variables:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- NEXT_PUBLIC_SITE_URL

Never commit real secret keys to GitHub.
