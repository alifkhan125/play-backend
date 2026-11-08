# Stripe Verification ও Play Landing Page Plan

## বর্তমান codebase status

- Stripe configuration আছে: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Coin purchase-এর জন্য Stripe PaymentIntent আছে
- Ad payment-এর জন্য Stripe PaymentIntent আছে
- Subscription payment-এর জন্য Stripe PaymentIntent আছে
- Creator payout-এর জন্য Stripe Connect আছে
- Coin payment-এর Stripe webhook আছে
- সাধারণ user login endpoint: `POST /api/v1/auth/login`
- Admin login endpoint: `POST /api/v1/auth/admin-login`
- Admin dashboard: `/play-dashboard/`
- Public landing page এখনো তৈরি হয়নি

## গুরুত্বপূর্ণ Stripe eligibility সতর্কতা

Landing page বানালেই Stripe account verification নিশ্চিত হয় না। Stripe account-এর legal entity, business address, owner/representative identity, bank information, website ownership এবং website-এর business description একে অপরের সঙ্গে মিলতে হবে।

Play-এর business model-এ coins/virtual credits, user-generated content এবং creator payouts আছে। Stripe-এর restricted-business policy অনুযায়ী stored value/virtual credits এবং content-creation platforms অতিরিক্ত review বা approval-এর আওতায় পড়তে পারে। Live payment চালু করার আগে Stripe Support-এর কাছে business model লিখে eligibility confirm করতে হবে।

Official references:

- [Stripe account verification](https://support.stripe.com/questions/what-do-i-need-to-do-to-verify-my-stripe-account/)
- [Stripe website requirement](https://support.stripe.com/questions/do-i-have-to-have-a-business-website-to-sign-up-for-stripe?locale=en-GB)
- [Business verification documents](https://support.stripe.com/questions/documents-for-business-verification?locale=en-GB)
- [Restricted businesses](https://stripe.com/legal/restricted-businesses)

## Landing page structure

নতুন আলাদা web app তৈরি করা উচিত: `play-web/`

Recommended public routes:

```text
/
/pricing
/about
/features
/faq
/contact
/terms
/privacy
/refund-policy
/cancellation-policy
/acceptable-use
/login
/register
```

Landing page-এ থাকতে হবে:

1. Company/business name
2. Play কী service দেয় তার পরিষ্কার ব্যাখ্যা
3. App screenshots বা product demo
4. Subscription pricing
5. Coins/virtual credits কীভাবে কাজ করে তার পরিষ্কার ব্যাখ্যা
6. Creator payout model
7. Customer support email ও contact form
8. Refund এবং cancellation policy
9. Privacy policy এবং Terms of Service
10. Legal business address
11. Login/Register button
12. Google Play/App Store links, যদি প্রযোজ্য হয়

Stripe Dashboard-এ দেওয়া business description এবং website-এর description একই হতে হবে। Fake claim, misleading pricing, hidden recurring charge বা অস্পষ্ট refund policy রাখা যাবে না।

## Login flow

Landing page-এর public user flow:

```text
Visitor
  -> Landing page
  -> Login/Register
  -> POST /api/v1/auth/login
  -> Access/refresh token
  -> User dashboard অথবা Play app redirect
```

Admin flow আলাদা থাকবে:

```text
/play-dashboard/
  -> POST /api/v1/auth/admin-login
  -> Admin dashboard
```

Admin login public landing page-এর সাধারণ login-এর সঙ্গে মেশানো যাবে না।

## Recommended Stripe payment flow

Landing page-এর subscription-এর জন্য Stripe Checkout Session ব্যবহার করা ভালো:

```text
Landing pricing section
  -> User login
  -> Backend creates Checkout Session
  -> Stripe-hosted checkout
  -> Stripe webhook
  -> Backend verifies event
  -> Subscription activated in MongoDB
  -> User dashboard updated
```

Recommended backend endpoints:

```text
POST /api/v1/billing/checkout-session
GET  /api/v1/billing/subscription
POST /api/v1/billing/portal
POST /api/v1/stripe/webhook
```

Recommended webhook events:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
charge.refunded
```

Payment সফল হয়েছে ধরে শুধু success page থেকে subscription activate করা যাবে না। Webhook-কে source of truth হিসেবে ব্যবহার করতে হবে।

## Webhook security requirements

বর্তমান webhook route-এ raw request body নেওয়ার ব্যবস্থা আছে। Production-এর জন্য:

- `stripe-signature` header বাধ্যতামূলক করতে হবে
- `STRIPE_WEBHOOK_SECRET` না থাকলে webhook reject করতে হবে
- Signature verification ছাড়া event process করা যাবে না
- Event ID দিয়ে idempotency রাখতে হবে
- একই event দ্বিতীয়বার এলে duplicate coins/subscription দেওয়া যাবে না
- Payment amount, currency, user এবং plan server-side যাচাই করতে হবে
- Client থেকে পাঠানো price বা amount বিশ্বাস করা যাবে না

Stripe webhook endpoint:

```text
https://playappllc.com/api/v1/stripe/webhook
```

## Environment variables

Backend production `.env`:

```env
NODE_ENV=production
PUBLIC_BASE_URL=https://playappllc.com
WEB_APP_URL=https://playappllc.com
ADMIN_URL=https://playappllc.com/play-dashboard

STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Landing app `.env`:

```env
VITE_API_URL=https://playappllc.com/api/v1
```

Test এবং live mode-এর API keys ও webhook secret আলাদা হবে। Secret key কখনো frontend-এ দেওয়া যাবে না।

## VPS/Nginx layout

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /play-dashboard/ {
    alias /var/www/play-dashboard/dist/;
    index index.html;
    try_files $uri $uri/ /play-dashboard/index.html;
}

location / {
    root /var/www/play-web/dist;
    try_files $uri $uri/ /index.html;
}
```

Backend-এ production frontend origin CORS-এ রাখতে হবে:

```env
CORS_ORIGINS=https://playappllc.com
```

## Implementation phases

### Phase 1: Stripe/account readiness

- Stripe-supported country এবং business type confirm
- Legal business name/address/account representative ঠিক করা
- Bank account এবং identity documents প্রস্তুত করা
- Stripe Dashboard-এ website URL দেওয়া
- Restricted-business eligibility Stripe Support-এর কাছে confirm করা

### Phase 2: Public website

- `play-web` app তৈরি
- Responsive landing page
- Pricing, About, FAQ, Contact
- Terms, Privacy, Refund, Cancellation, Acceptable Use pages
- Login/Register UI
- SEO title, description, favicon এবং Open Graph metadata

### Phase 3: Authentication

- `/api/v1/auth/login` যুক্ত করা
- Register এবং email verification flow যুক্ত করা
- Access/refresh token securely handle করা
- Login হলে user dashboard/app redirect করা
- Admin login আলাদা রাখা

### Phase 4: Stripe billing

- Product এবং recurring Price Stripe Dashboard-এ তৈরি
- Database plan-এর সঙ্গে Stripe Price ID map করা
- Checkout Session endpoint তৈরি
- Billing portal endpoint তৈরি
- Webhook event handler ও idempotency যোগ করা
- Refund/cancellation state sync করা

### Phase 5: Admin integration

- Admin dashboard-এ products/plans দেখা
- Active subscribers দেখা
- Payment status দেখা
- Refund/cancel history দেখা
- Webhook failure monitoring যোগ করা

### Phase 6: Testing ও launch

- Stripe test mode-এ successful payment test
- Failed card test
- 3DS/authentication test
- Duplicate webhook test
- Refund এবং cancellation test
- Email receipt/support test
- Mobile responsive test
- Production HTTPS, CORS, Nginx এবং PM2 যাচাই
- Live keys বসিয়ে live webhook configure

## Launch checklist

- [ ] Stripe account verification requirements সম্পূর্ণ
- [ ] Website domain verified
- [ ] SSL active
- [ ] Business information website ও Stripe Dashboard-এ একই
- [ ] Pricing পরিষ্কারভাবে visible
- [ ] Refund/cancellation/privacy/terms pages live
- [ ] Support email কাজ করছে
- [ ] API domain থেকে response আসছে
- [ ] Webhook signature verification active
- [ ] Duplicate webhook idempotency active
- [ ] Test mode payment successful
- [ ] Stripe Support business model approve করেছে
- [ ] Live mode keys ও webhook secret configured

## Decision

প্রথমে landing page, login এবং legal pages তৈরি করতে হবে। এরপর Stripe Checkout এবং webhook-based subscription flow যোগ করা হবে। Play-এর coins/virtual credits ও creator payout model-এর জন্য Stripe eligibility written confirmation ছাড়া live payment চালু করা উচিত নয়।
