# BillBored (real build, v0.1)

## Set up (about 20 minutes)
1. Create a free project at supabase.com.
2. SQL Editor: run `supabase/001_schema.sql`, then `supabase/002_auth_storage_review.sql`.
3. Authentication > Providers > Email: keep it on and turn OFF "Confirm email" so people can sign up with email and password and get in straight away, with no emailed code. (Password reset will need working email later, see the email setup notes.)
4. Copy `.env.example` to `.env` and paste your project URL and anon key (Project Settings > API).
5. `npm install` then `npm run dev`. Sign in with your email.
6. Make yourself a reviewer: SQL Editor > `update profiles set role = 'admin' where handle = (select handle from profiles order by created_at limit 1);` (or filter by your id). A Review tab then appears.
7. Deploy: push to GitHub, import in Vercel, add the same two environment variables.

## What works
Email code sign-in, bill submission with private PDF/JPG/PNG upload, My bills, reviewer queue (approve with a redacted public title / need info / decline, all logged), public Open bills list.

## Not built yet
Payments (Paystack/Flutterwave webhook writing to the ledger), follows and public-figure profiles wired to the database, cheers, notifications. Supabase's built-in email sender is rate-limited: add your own SMTP (e.g. Resend) before launch.

## Payments (Paystack, test mode first)
1. Run `supabase/003_payments.sql`.
2. Install the Supabase CLI, then in this folder: `supabase login` and `supabase link --project-ref YOUR_REF`.
3. Set secrets (use your Paystack TEST secret key, `sk_test_...`):
   `supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx SITE_URL=https://your-app.vercel.app`
4. Deploy: `supabase functions deploy paystack-init` and `supabase functions deploy paystack-webhook --no-verify-jwt`
5. Paystack dashboard > Settings > API Keys & Webhooks > Test Webhook URL:
   `https://YOUR_REF.supabase.co/functions/v1/paystack-webhook`
6. Approve a bill as a reviewer, then back it with Paystack's test card. The ledger row and funding bar update when the webhook lands.
7. Going live needs Paystack's compliance approval, your `sk_live_` key, and the live webhook URL. A Registered Business is needed for Transfers (paying billers).

Safety rules built in: webhook signature check, a second check against Paystack's verify API, a unique payment reference so repeats can't double-count, and the ledger can only be added to.

## Payout and Cleared (run `supabase/004_payout_cleared.sql`)
- Reviewers see "Ready to pay out" at the top of the Review tab for bills that have received money. Pay the biller (school, electricity company, hospital) directly from your bank or Paystack dashboard, then record the amount, payment reference and receipt there.
- A bill becomes Cleared only when recorded payouts reach its target. You can't record more than has been received.
- The person whose bill cleared can send an anonymous thank-you. The Cleared wall shows it with a WhatsApp share button. Receipts are visible only to staff, the requester and people who gave to that bill.
- Later, this manual step can be replaced by Paystack Transfers once you have a Registered Business account.

## Communities (run `supabase/005_communities.sql`)
- Seeds the 11 public figures and gives each a fan community, plus Student Support. Naija Hustlers is not built yet.
- Anyone signed in can read; members can post text (500 characters, no links, 10 posts per hour). Posts with 3 reports drop out of the feed. Authors and reviewers can delete.
- Figure communities are labelled as unofficial fan spaces. A post shows "Official" only when the figure is authorized and claimed by that account: set `figures.authorized = true` and `figures.claimed_by = <their profile id>` in SQL after you verify them. Never create posts in a real person's name yourself.
- The Community tab replaces My bills in the bottom bar; My bills now sits under Profile.

## Moderation, likes, replies, notifications (run `supabase/006_moderation_social.sql`)
- Review tab now starts with "Reported posts" (when any exist): Remove, Remove + mute 7 days, or Dismiss. All actions go in the audit log. Muted users can't post; they can't undo it themselves.
- Likes and one-level replies in every community. Replies are removed when their post is removed.
- Notifications (shown on the Profile tab, with a count in the bottom bar): your bill changes status, someone gives to your bill (anonymous), someone replies to or likes your post. The count refreshes every minute; push/email/WhatsApp alerts are not built.

## Figure profiles and claims (run `supabase/007_figure_profiles_claims.sql`)
- Community > Profile on any figure opens their page: About, Activity (Official posts only), Backed bills, plus real Followers, Bills backed and Given numbers.
- Everything starts as "Unofficial profile · not affiliated". A person or their team can request access (role, how you can verify, optional document). Reviewers see it under "Profile access requests" in the Review tab. Verify them yourself first (call, official email) before approving.
- Approving makes that account the figure's team: their posts in the community show Official, they can edit About, and gifts they give openly count as the figure's "Bills backed" and "Given". The requester gets an in-app notification either way.
- Email is used only for sign-in codes. Nothing here sends email. Paystack may send its own payment receipts to payers; check its notification settings if you want that off.

## Arena, streaks, points, Top 10, swipe deck (run `supabase/008_play.sql`)
Built from the v2 design. The Arena tab (replaces Cleared in the bottom bar; Cleared and Top 10 are buttons on the Billboard) has three parts:
- Swipe deck: swipe right to save a bill to your watchlist, left for the next one (a People mode lets you follow public figures the same way).
- Quiz: 8 Naija business questions (10 after you also run `supabase/009_quiz_don_jazzy.sql`, which adds the Jazzy's Burger and producer-tag questions). +5 points the first time you answer each one right; replays are free. Finishing the quiz counts as the day's check-in. Questions live in `quiz_questions`; right answers never reach the browser before you answer. Check the facts before adding more, they go out of date (Tony Elumelu retired as UBA chairman on 21 Aug 2026).
- Top 10: this week's biggest supporters (Mon to Sun, Lagos time), confirmed payments only. "Give quietly" gifts count but show as Anonymous supporter.
Profile has the streak card (M-S dots, check in for +10) and level bar (a level every 30 points). A flame chip in the top bar shows your streak. Backing a bill earns +2 points. Points are play-money: no cash value, no withdrawals, no effect on bill review.

## Password reset
"Forgot your password?" on the sign-in screen emails a reset link, so it only works once real email is set up (custom SMTP, e.g. Resend). In Supabase: Authentication > URL Configuration, set Site URL to your live address and add it (and `http://localhost:5173` for testing) to the redirect URLs. Authentication > Email Templates > "Reset Password" must keep `{{ .ConfirmationURL }}`. The link opens the app on a "Choose a new password" screen.

## Display names (run `supabase/010_private_display_name.sql`)
New accounts get a neutral public name like "Member 4f2a" instead of the first part of their email, because profiles are readable by everyone. Emails stay private: they live in Supabase's auth table and the app only shows a person their own email on their Profile.

## Usernames
After first sign-in people are asked to choose a username (3 to 20 lowercase letters, numbers or underscores, unique). They can skip, and change it later on Profile. The username is also their public display name. No SQL change is needed: the existing profile policy lets people edit their own row.

## Reserved usernames (run `supabase/011_reserved_usernames.sql`)
A database rule blocks usernames and display names that match a public figure in the `figures` table (full name anywhere in the name, any name part of five or more letters on its own, or a long surname inside it), plus platform words like admin, support, staff, official and anything containing billbored. Letters only are compared, so `don_jazzy` and `donjazzy01` are both blocked. A figure's verified team (`figures.claimed_by`) may use their own name, and reviewers and admins may use platform words. New figures are protected automatically. Run the commented review query at the bottom of the file to find existing accounts that already use such a name, then deal with them by hand.

## Bug-fix patch (2026-10-26)

This patch adds safer profile and data-loading states, bounds swipe-deck funding percentages, reports quiz daily-claim failures, and introduces an atomic payment reservation.

### Required database migration

Apply `supabase/012_atomic_payment_reservations.sql` **after** migrations `001` through `003` (and after the rest of the existing migrations if you normally apply them in sequence). The Paystack initialization Edge Function now calls `reserve_bill_payment`; deploying the updated function without this migration will cause payment initialization to fail safely.

### Deploy and test

1. Apply the new SQL migration to the intended Supabase project.
2. Deploy the updated `paystack-init` Edge Function.
3. Test using Paystack test credentials and test bills before enabling live payments.
4. Verify two simultaneous contributions cannot reserve more than the remaining target.
5. Verify Paystack initialization failures are marked failed, while network timeouts retain a pending reservation because the provider may have accepted the request.
6. Test signed-in profile loading with network errors, empty bill lists, and database permission errors.

**Operational note:** Pending payment reservations deliberately remain reserved until Paystack confirms success or an initialization failure is definitively returned. A request timeout may leave a reservation pending because automatically releasing it could permit overfunding if Paystack accepted the transaction. Add a reconciliation process before production launch to resolve abandoned or ambiguous transactions against Paystack's verify API; do not blindly mark old pending transactions failed.

The patch has not been validated against a live Supabase database or Paystack account. Run the production build and integration tests in the deployment environment before launch.
