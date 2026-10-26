import { useEffect } from 'react'

// DRAFT legal text for BillBored. Fill every [BRACKETED] item and have a Nigerian lawyer review before launch.
const COMPANY = '[COMPANY NAME]'
const EMAIL = '[CONTACT EMAIL]'
const UPDATED = '[DATE]'

const TERMS = [
  ['About BillBored', `BillBored (“we”, “us”) is a platform run by ${COMPANY} where people can post a genuine bill and others can choose to help pay it. By using the app you agree to these terms. If you don’t agree, please don’t use it.`],
  ['Who can use it', 'You must be 18 or older and give accurate information. You are responsible for your account and for keeping your sign-in email secure.'],
  ['How bills work', 'Anyone signed in can submit a bill with supporting documents. Our reviewers check each bill. Approving a bill does not guarantee it will be funded. We may approve, ask for more information, edit the public title to protect privacy, or decline a bill, and we log those decisions.'],
  ['How gifts work', 'When you back a bill, your payment is made through Paystack. We pay the biller (for example a school, an electricity company or a hospital) directly. We never pay the person who posted the bill. Gifts are voluntary. They are not a loan, an investment or a purchase, and the person who posted the bill owes you nothing. Check the amount before you pay. Fees: [FEE POLICY, e.g. payment processor fees and any platform fee].'],
  ['Refunds', '[REFUND POLICY: for example what happens if a bill is withdrawn or cannot be paid to the biller.] If a payment fails or is duplicated, contact us at ' + EMAIL + ' with your payment reference.'],
  ['Be honest', 'Do not submit false, altered or someone else’s documents, or ask for help with something that is not a genuine bill. We may remove a bill, suspend an account, and report fraud to the proper authorities.'],
  ['Communities and posts', 'Community spaces are for respectful conversation. Posts are text only (up to 500 characters), with no links. Do not harass, threaten, spam, impersonate anyone, or share other people’s private information. Posts that are reported may be hidden or removed, and accounts may be muted or suspended. You are responsible for what you post.'],
  ['Public figures', 'Communities named after public figures are unofficial fan spaces. They are not affiliated with, endorsed by or run by those people unless a profile clearly shows “Official”. A person or their team can ask us to verify their profile, or to correct or remove content about them, by emailing ' + EMAIL + '.'],
  ['Play, points and streaks', 'Points, levels, streaks and the Top 10 are for fun. They have no cash value, cannot be withdrawn, and do not affect how bills are reviewed.'],
  ['Our content and your content', 'The BillBored name, logo and artwork belong to us. The comics are fictional and satirical, and no real person is depicted or quoted. You keep ownership of what you post, and you give us permission to display it in the app so the service can work.'],
  ['Availability and liability', 'We work hard to keep BillBored running, but we cannot promise it will always be available or error-free. To the extent the law allows, we are not liable for losses that come from your use of the app, from a third party’s actions (including payment providers and billers), or from a bill not being funded. Nothing here limits rights you have under Nigerian law that cannot be limited.'],
  ['Changes and ending', 'We may update these terms and will show the new date below. You can stop using the app at any time. We may suspend or close accounts that break these terms.'],
  ['Law and contact', `These terms are governed by the laws of [Nigeria / STATE]. Questions or complaints: ${EMAIL}. ${COMPANY}, [ADDRESS].`],
]

const PRIVACY = [
  ['What this covers', `This explains what personal information ${COMPANY} collects through BillBored, why, and your choices. We aim to follow the Nigeria Data Protection Act 2023.`],
  ['What we collect', 'Your email address (to sign you in), your profile name or handle, bills you submit and the documents you upload (such as invoices, statements or letters), payments you make (amount, time and Paystack reference, not your card details), your posts, likes and replies, notifications, points and streaks, and records of moderation actions. Your device may also store a few small settings, such as your light or dark choice.'],
  ['Why we use it', 'To sign you in, review bills, take and track payments, pay billers, show the Billboard and Cleared wall, run communities, keep the platform safe, prevent fraud, meet legal duties and respond to you.'],
  ['What other people can see', 'Bills appear publicly with a title our reviewers may edit to protect privacy. Your uploaded documents are private. They can be seen by our reviewers, you, and, for payout receipts, people who gave to that bill. If you choose “give quietly”, your name is hidden from the public and from the person you helped, but our staff and payment provider still hold the payment record. Your posts show your handle.'],
  ['Who we share it with', 'Service providers that help us run BillBored: Supabase (database, sign-in and file storage), Paystack (payments), our email sender, and our hosting provider. They only get what they need. We may also share information when the law requires it, or to protect people from fraud or harm. We do not sell your personal information.'],
  ['Where it is stored', 'Our providers may store data on servers outside Nigeria. We choose providers with appropriate security and ask them to protect it.'],
  ['How long we keep it', '[RETENTION PERIOD: for example, account data while your account is open, and payment and payout records for the period the law requires.] We delete or anonymise information we no longer need.'],
  ['Your rights', `You can ask to see the information we hold about you, correct it, delete it, object to how we use it, or withdraw consent, subject to legal limits such as keeping payment records. Email ${EMAIL}. You can also complain to the Nigeria Data Protection Commission.`],
  ['Security', 'We use access controls, private file storage, signed payment confirmations and an append-only payment ledger. No system is perfectly secure, so please use an email account only you can access.'],
  ['Children', 'BillBored is for people 18 and older. We do not knowingly collect information from children.'],
  ['Changes and contact', `We will update this page if our practices change. Questions: ${EMAIL}. ${COMPANY}, [ADDRESS].`],
]

export const LegalLinks = ({ className = 'mu legal-links' }) => (
  <p className={className}><a href="#terms">Terms</a> · <a href="#privacy">Privacy</a></p>
)

export default function LegalPage({ doc, back }) {
  useEffect(() => { window.scrollTo(0, 0) }, [doc])
  const terms = doc === 'terms'
  const rows = terms ? TERMS : PRIVACY
  return (
    <div className="wrap legal">
      <button className="chip" onClick={back} aria-label="Go back">Back</button>
      <h1>{terms ? 'Terms of Use' : 'Privacy Policy'}</h1>
      <p className="mu">Last updated: {UPDATED}</p>
      {rows.map(([h, t]) => <section key={h}><h2>{h}</h2><p>{t}</p></section>)}
      <p className="mu"><a href={terms ? '#privacy' : '#terms'}>{terms ? 'Read the Privacy Policy' : 'Read the Terms of Use'}</a></p>
    </div>
  )
}
