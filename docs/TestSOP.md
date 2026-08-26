# Standard Operating Procedure (SOP): Manual Authentication & Functional Testing

**Objective:** Execute a rigorous manual test of the Sapienworx authentication flow, encompassing New User Registration (Sign Up), Existing User Login (Sign In), OTP validation, and concurrent session handling.

## Prerequisites for the Tester

1.  **Environment:** Ensure the Next.js frontend, Spring Boot backend, PostgreSQL, and Redis containers are running locally via `docker-compose`.
2.  **OTP Access:** Have a database viewer (like RedisInsight) open to monitor the `swx-redis` container, OR ensure a local SMTP catcher (like Mailtrap) is configured to intercept the OTP dispatch emails.
3.  **Browsers:** Have Google Chrome (Standard and Incognito modes) and a secondary browser (e.g., Firefox or Safari) ready for multi-session testing.

---

## Test Phase 1: New User Sign-Up & OTP

**Scenario:** A brand-new candidate registers on the platform.

1.  **Navigate:** Open the frontend application (`http://localhost:3000`) and navigate to the `/register` or Sign-Up page.
2.  **Input:** Enter a fresh, unregistered email address (e.g., `tester.new@sapienworx.local`) and a mobile number.
3.  **Action:** Click **"Request OTP"**.
4.  **Expected UI Behaviour:**
    - The button should show a loading state.
    - The UI should transition to the OTP input screen, displaying "We've sent a code to...".
5.  **OTP Retrieval:** Open Redis or Mailtrap and note the 6-digit cryptographic code generated for this session.
6.  **Validation:** Enter the 6-digit code into the frontend and click **"Verify & Create Account"**.
7.  **Expected Outcome:**
    - The backend validates the code and issues the `HttpOnly` JWT cookie.
    - The frontend routes the user to the Domain Resolution Screen (as their domain is currently `UNASSIGNED`).

---

## Test Phase 2: Existing User Sign-In & Edge Cases

**Scenario:** An existing user logs in, testing both successful authentication and failure states.

1.  **Navigate:** Go to the `/login` page.
2.  **Input:** Enter the email address of the account created in Phase 1. Click **"Request OTP"**.
3.  **Failure Test (Invalid OTP):**
    - Enter a deliberately incorrect code (e.g., `000000`).
    - **Expected Outcome:** The UI must display a clear error message (e.g., "Invalid or expired code") and must _not_ log the user in.
4.  **Failure Test (Expired OTP):**
    - Wait for the Redis TTL to expire (e.g., 10 minutes), or manually delete the key in Redis. Attempt to use the previously correct code.
    - **Expected Outcome:** The UI must reject the code and prompt the user to "Request a new code".
5.  **Success Test:** Request a new OTP, retrieve it, enter it correctly, and submit.
6.  **Expected Outcome:** The user is seamlessly routed to the `/candidate/dashboard` without seeing the Domain Resolution Screen (assuming it was resolved in Phase 1).

---

## Test Phase 3: Multiple Logins & Session Handling

**Scenario:** Testing how the platform behaves when a user attempts to log in from multiple devices or windows simultaneously.

1.  **Standard Session:** Log into Account A using your standard Chrome browser window. Verify the dashboard loads.
2.  **Concurrent Session (Different Browser):** Open Firefox or Safari. Navigate to `/login` and attempt to log into Account A again using a new OTP.
    - **Expected Outcome:** The backend should authorise the new session and issue a new JWT cookie for Firefox. Both browsers should now be logged in simultaneously (unless your business logic strictly forbids concurrent sessions, in which case the Chrome session should be forcefully invalidated).
3.  **Data Isolation (Incognito Mode):**
    - Open a Chrome Incognito window (which does not share cookies with the standard window).
    - Log into Account B.
    - **Expected Outcome:** Actions performed in Account B (Incognito) must not leak into or affect the state of Account A (Standard Chrome). Refreshing both pages should maintain strict data isolation.
4.  **Sign Out Validation:**
    - Click "Sign Out" in the standard Chrome window (Account A).
    - Attempt to navigate back to `/candidate/dashboard` via the browser's "Back" button.
    - **Expected Outcome:** The backend must clear the `HttpOnly` cookie. The Next.js middleware must intercept the unauthenticated request and force-redirect the user back to `/login`.
