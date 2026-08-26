# Standard Operating Procedure (SOP): Multi-Role Auth & CV Parsing

**Objective:** Execute manual end-to-end tests for concurrent multi-user access (Recruiters and Candidates) to verify Role-Based Access Control (RBAC) and session isolation. Subsequently, manually validate the deterministic CV parsing engine across various file states.

## Prerequisites for the Tester

1.  **Test Accounts Required:**
    - Candidate A & Candidate B (unique emails)
    - Recruiter A & Recruiter B (unique emails, assigned to an Organisation)
2.  **Environment:** Next.js, Spring Boot, PostgreSQL, RabbitMQ, and Redis must be running locally.
3.  **Test Files:** Have three specific files prepared on your desktop:
    - `clean_cv.pdf` (A standard, text-based PDF with an email and phone number)
    - `clean_cv.docx` (A standard Word document)
    - `corrupted_cv.pdf` (An image-only PDF, or a `.jpg` renamed to `.pdf` to force a failure)

---

## Test Phase 1: Concurrent Multi-User & RBAC Validation

**Scenario:** Validating that multiple users across different roles can log in simultaneously without their OTPs or sessions clashing.

1.  **Recruiter Concurrency:**
    - Open **Chrome**. Navigate to `/login` and request an OTP for Recruiter A.
    - Open **Firefox** immediately. Navigate to `/login` and request an OTP for Recruiter B.
    - **Action:** Check Redis or Mailtrap. You should see two distinct OTP keys generated.
    - **Validation:** Enter the respective codes in each browser. Both recruiters must land on their distinct workspaces. Altering a pipeline stage in Chrome (Recruiter A) must not affect the session state in Firefox (Recruiter B) until refreshed.
2.  **Candidate Concurrency & Session Isolation:**
    - Open a **Chrome Incognito** window. Request an OTP and log in as Candidate A.
    - Open a **Firefox Private** window. Log in as Candidate B.
    - **Validation:** Both candidates must access their individual profiles successfully.
3.  **Strict Role-Based Access Control (RBAC) Check:**
    - In Candidate A's browser, manually change the URL to `http://localhost:3000/recruiter/dashboard`.
    - **Expected Outcome:** The Next.js middleware must immediately block access and redirect the candidate back to `/candidate/dashboard` or a 403 Forbidden page.
    - In Recruiter A's browser, attempt to access `/candidate/profile`.
    - **Expected Outcome:** The system must strictly block the recruiter from accessing candidate-specific views.

---

## Test Phase 2: Manual CV Parsing & Real-Time Events (SSE)

**Scenario:** Verifying the deterministic extraction logic (Apache PDFBox/POI) and ensuring the RabbitMQ queues dispatch real-time UI updates via Server-Sent Events (SSE).

### Test A: The PDF Happy Path

1.  **Action:** As Candidate A, navigate to the CV upload screen and upload `clean_cv.pdf`.
2.  **Observation (Real-Time UI):** The UI must immediately show a "Processing..." state while freeing the browser up (no page freezing).
3.  **Validation:** Once RabbitMQ finishes, the Server-Sent Event (SSE) should trigger a UI update automatically (without you refreshing).
4.  **Data Verification:** Review the populated profile fields. The parser must have accurately mapped the exact Email and Phone Number from the PDF using its deterministic Regex rules.

### Test B: The DOCX Happy Path

1.  **Action:** As Candidate B, upload `clean_cv.docx`.
2.  **Validation:** Monitor the real-time processing state. Upon completion, verify that the Apache POI library successfully extracted the text and mapped the contact details identically to the PDF test.

### Test C: The Graceful Failure (Dead Letter Queue)

1.  **Action:** As Candidate A, upload the `corrupted_cv.pdf`.
2.  **Observation:** The backend RabbitMQ worker will fail to extract text and route the message to the Dead Letter Queue (DLQ).
3.  **Validation (The Fallback):** The frontend UI must _not_ crash. It should receive a failure event via SSE and gracefully display an error message: _"We couldn't read your CV automatically. Please fill in your details manually."_
4.  **Domain Categorisation Check:** Because the file failed parsing, the candidate's domain should remain `UNASSIGNED`. The system must prompt the user with the manual Domain Selection UI (Tech vs. Non-Tech) before they can proceed.
