# Switching payments on: setup, test and go-live

The plan: **30-day free trial for everyone, card collected up front, then $39 a year, cancel any time, 14-day refund after any
charge.** The code is finished and does nothing until `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` exist in Vercel. Do every
step below in **test mode** first. I (the assistant) cannot enter keys or create the Stripe account; each step says who does what.

## 1. Account (you)
1. Create or open your Stripe account at dashboard.stripe.com. Stay in **Test mode** (toggle at top right).
2. Settings, Business details: legal name, support email (use the same address as the site's support email), statement descriptor "NEXTSTAMP".

## 2. Keys (you paste, I guide)
1. Developers, API keys: copy the **Secret key** (starts `sk_test_`).
2. Vercel, Environment Variables, add `STRIPE_SECRET_KEY` as **Secret**, **Production only** for now (previews share the live database).

## 3. Webhook (you paste, I guide)
1. Developers, Webhooks, Add endpoint. URL: `https://<your-site>/api/stripe/webhook`.
2. Select exactly these events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
   `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
3. Copy the **Signing secret** (`whsec_...`) into Vercel as `STRIPE_WEBHOOK_SECRET` (Secret, Production), then redeploy.

## 4. Customer portal (you)
Settings, Billing, Customer portal: turn it on, allow **Cancel subscription** (at end of period) and **Update payment method**, show
invoice history, add your Terms and Privacy links, Save. Without this the "Manage billing or cancel" button shows an error.

## 5. Emails and retries (you) — required, not optional
Settings, Billing, Subscriptions and emails:
- Turn on **trial-ending reminder emails** (Stripe sends one before the first charge). Auto-renewal rules in several places
  expect a reminder before a trial converts to paid.
- Turn on **successful payment receipts** and **failed payment** emails.
- Retries: use Smart Retries; set "if all retries fail" to **Cancel the subscription** (the app keeps access during `past_due`
  and ends it when Stripe cancels).

## 6. Tax (you + an accountant)
Settings, Tax: set your origin address, add registrations where you must collect, then set `STRIPE_AUTOMATIC_TAX=1` in Vercel.
`STRIPE_TAX_BEHAVIOR=inclusive` (default) keeps the price at exactly $39; `exclusive` adds tax on top.

## 7. Test it (you drive, I can watch logs and the database)
Use card `4242 4242 4242 4242`, any future date and any CVC.
1. Sign in, Pricing, Start your 30-day free trial. You should land on your profile with "Free trial until ...". 
2. Profile, Manage billing or cancel: cancel; the profile should say you will not be charged.
3. Fresh account: start the trial, then in Stripe use a **test clock** to advance 31 days. The first $39 charge should happen and
   the profile should say "Renews ... at $39 a year".
4. Refund that charge in Stripe: access should switch off and the subscription should be cancelled (no second charge).
5. Card `4000 0000 0000 0341` fails the first charge: access should stay on while `past_due`, then end when Stripe cancels.
6. Delete an account that has a trial: the subscription must be cancelled in Stripe and the account removed.

## 8. Go live
1. Complete Stripe's account activation. Switch to **Live mode**, repeat steps 2 to 5 with live keys (a new webhook endpoint in live mode).
2. Replace the two Vercel variables with the live values, redeploy.
3. Do one real purchase with your own card, refund it, confirm access switches off.

## Before any of this goes live
- Lawyer review of `/terms` (the "Free trial, subscription, cancelling and refunds" section) and `/privacy`.
- Confirm the trial-ending reminder is switched on (step 5). Do not skip it.
- Decide `PAID_GRANDFATHER_BEFORE`: leave it **unset**. The trial replaces grandfathering; setting it would give everyone created before
  that date free access forever.
