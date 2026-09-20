# Amazon SES production-access request

SapienWorx has verified `sapienworx.com` and successful DKIM in Mumbai. The account remains in the SES sandbox. Do not change DKIM records and do not automate the production-access request.

## Request steps

1. Sign in through IAM Identity Center and switch the console region to Asia Pacific (Mumbai), `ap-south-1`.
2. Open Amazon SES -> Account dashboard -> Request production access (or continue the existing AWS Support case).
3. Select transactional mail. Use the verified domain and `info@sapienworx.com` as the operational contact.
4. Describe the initial traffic as approximately 1,000 user-requested messages per month: signup email OTPs and password-reset codes only, triggered immediately by the user rather than bulk scheduled mail.
5. Explain that recipients type their own address into the signup/recovery form; SapienWorx does not use purchased, rented, scraped, or third-party lists.
6. Explain controls: time-limited OTPs, resend cooldowns, verification-attempt limits, account-level suppression for hard bounces/complaints, delivery monitoring, and no intentional resend to suppressed recipients.
7. Provide a representative verification message and password-reset message. Each should identify SapienWorx, show expiry, warn against sharing the code, explain how to ignore an unrequested message, and identify `info@sapienworx.com` for support.
8. Clarify that initial transactional OTP/reset messages are not newsletters. An unsubscribe link is not applicable to a one-time security code, but users can report unwanted messages. Any future marketing email requires separate consent, preference, suppression, and unsubscribe controls before launch.
9. Submit and monitor the Support Center case. Respond there if AWS asks for further detail.

AWS decides whether to approve and may request more evidence. Verification of the domain and DKIM does not guarantee production access. Until approval, SES can send only within sandbox restrictions; do not open public registration while expecting delivery to arbitrary addresses.
