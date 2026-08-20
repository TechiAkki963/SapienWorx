Absolutely. Below is the **complete detailed `prompt.md`**, designed to be used as the master build prompt for generating/developing the Portal application. It is aligned with the expanded PRD above and explicitly fixes the parser architecture.

# `prompt.md`

````md
# PORTAL PROJECT — MASTER DEVELOPMENT PROMPT

Version: 2.0
Status: Final Development Specification
Date: 20 August 2026

---

# 1. ROLE

You are the lead software architect, product engineer, UI/UX engineer, backend engineer, database engineer, security engineer, QA engineer, and DevOps engineer responsible for designing and implementing the complete Portal application.

You must build the application according to this specification.

Do not treat this as a parser-only project.

The Portal application consists of:

1. Candidate Portal
2. Recruiter Portal
3. Organization/Recruitment Workspace
4. Master Admin / Super Admin Portal
5. Shared Parser Service
6. Document Management
7. Authentication and Authorization
8. Search
9. Notifications
10. Monetization
11. Subscriptions
12. Billing
13. Usage Metering
14. Analytics
15. Audit Logging
16. Platform Configuration
17. Background Processing
18. Storage
19. Security
20. Observability

The architecture must be modular, secure, extensible, and suitable for production.

---

# 2. CRITICAL ARCHITECTURE RULE

## DO NOT make the Parser an Admin feature.

This is one of the most important requirements.

The Parser is a SHARED PLATFORM SERVICE.

The Parser must be accessible to:

### Candidate

Primary use case:

Resume → Structured Data → Profile

### Recruiter

Authorized use cases:

- Resume parsing
- Candidate onboarding
- Recruitment documents
- Structured document extraction

### Master Admin

Authorized use cases:

- Invoices
- Platform documents
- Business documents
- Administrative document processing

Therefore:

```text
                    SHARED PLATFORM
                          |
                       PARSER
                          |
          +---------------+---------------+
          |               |               |
      Candidate        Recruiter      Master Admin
       Resume          Recruitment      Documents
       Parsing         Documents        / Invoices
```
````

Do not place parser business logic inside `/admin`.

Create a reusable parser service/module.

---

# 3. PRODUCT VISION

Build Portal as a professional recruitment and career-management platform.

The product should allow:

## Candidates

- Register
- Create professional profiles
- Upload resumes
- Parse resumes
- Review parsed information
- Edit extracted information
- Populate their profile
- Manage documents
- Search jobs
- Save jobs
- Apply for jobs
- Track applications
- Receive notifications

## Recruiters

- Register
- Create/join organizations
- Manage recruitment teams
- Create jobs
- Publish jobs
- Search candidates
- Review candidate profiles
- Manage applications
- Manage recruitment pipelines
- Schedule/manage interviews
- Add notes and activities
- Manage recruitment documents
- Use the shared parser
- View recruitment reports

## Master Admin / Super Admin

Provide complete platform-level administration:

- Users
- Candidates
- Recruiters
- Organizations
- Roles
- Permissions
- Jobs
- Applications
- Documents
- Parser administration
- Plans
- Pricing
- Monetization
- Subscriptions
- Billing
- Usage
- Analytics
- Reports
- Notifications
- Audit logs
- Security
- Platform configuration
- Feature flags
- System health
- Background jobs

---

# 4. PRODUCT PRINCIPLES

Follow these principles throughout development:

1. Candidate-first experience.
2. Parser is a shared platform service.
3. Candidate resume parsing is a core MVP workflow.
4. No AI dependency for MVP parsing.
5. Human review is required before parsed information becomes authoritative.
6. Never silently overwrite existing profile information.
7. Backend authorization is mandatory.
8. Tenant isolation is mandatory.
9. Documents are private by default.
10. Master Admin is the highest privilege role.
11. Master Admin actions must be audited.
12. Monetization must be configurable.
13. Billing provider must be abstracted.
14. Usage tracking must be independent from pricing logic.
15. Background processing must be used for expensive tasks.
16. Prefer open-source technologies where practical.
17. Avoid unnecessary infrastructure complexity.
18. Design for future AI integration without requiring AI today.
19. Build reusable services instead of duplicating business logic.
20. Never hard-code business rules in UI components.

---

# 5. TECHNOLOGY DIRECTION

Use a modern TypeScript-based architecture.

Preferred stack:

## Frontend

- TypeScript
- React
- Next.js or equivalent
- Responsive UI
- Component-based architecture
- Form validation
- API-driven state

## Backend

Preferred:

- Node.js
- TypeScript
- NestJS / Fastify / equivalent

Use a modular backend architecture.

## Database

PostgreSQL.

## Cache / Queue

Redis.

## Object Storage

AWS S3 or S3-compatible storage.

## Parser

Use open-source libraries for:

- PDF parsing
- DOCX parsing
- TXT parsing
- OCR
- Text normalization
- Pattern recognition
- Entity extraction

Do not introduce AI APIs for MVP parser functionality.

---

# 6. ARCHITECTURE STYLE

For MVP, prefer a modular monolith with background workers rather than unnecessary microservices.

Suggested structure:

```text
portal/
│
├── frontend/
│
├── backend/
│   ├── auth/
│   ├── users/
│   ├── candidates/
│   ├── recruiters/
│   ├── organizations/
│   ├── jobs/
│   ├── applications/
│   ├── documents/
│   ├── parser/
│   ├── notifications/
│   ├── search/
│   ├── plans/
│   ├── subscriptions/
│   ├── usage/
│   ├── billing/
│   ├── reports/
│   ├── admin/
│   ├── audit/
│   ├── system/
│   └── shared/
│
├── workers/
│   ├── parser-worker/
│   ├── document-worker/
│   ├── notification-worker/
│   ├── billing-worker/
│   └── report-worker/
│
├── database/
│   ├── migrations/
│   └── seeds/
│
└── infrastructure/
```

The exact structure may be adapted to the selected framework, but responsibilities must remain separated.

---

# 7. APPLICATION ROUTING

Separate application experiences.

Suggested routes:

```text
/
 /login
 /register

 /candidate/*
 /recruiter/*
 /organization/*
 /admin/*
```

Do not expose Admin functionality to candidates or recruiters.

Do not rely solely on frontend route protection.

Backend authorization is mandatory.

---

# 8. AUTHENTICATION

Implement:

- Registration
- Login
- Logout
- Email verification
- Password reset
- Secure session/token management
- Account activation/deactivation
- Session expiration
- Rate limiting

Design authentication so MFA can be added later.

Never store plain-text passwords.

Use a secure password hashing algorithm.

---

# 9. AUTHORIZATION

Implement RBAC.

Core roles:

```text
MASTER_ADMIN
ORGANIZATION_ADMIN
RECRUITER
HIRING_MANAGER
CANDIDATE
```

Permissions must be explicit.

Example:

```text
USER_VIEW
USER_EDIT
USER_SUSPEND

ORG_VIEW
ORG_EDIT
ORG_MEMBER_MANAGE

JOB_CREATE
JOB_EDIT
JOB_PUBLISH
JOB_CLOSE

CANDIDATE_VIEW
CANDIDATE_SEARCH

APPLICATION_VIEW
APPLICATION_EDIT
APPLICATION_STAGE_CHANGE

DOCUMENT_UPLOAD
DOCUMENT_VIEW
DOCUMENT_DELETE

PARSER_USE
PARSER_ADMIN

PLAN_MANAGE
SUBSCRIPTION_MANAGE
BILLING_VIEW
BILLING_MANAGE

REPORT_VIEW
REPORT_EXPORT

AUDIT_VIEW

PLATFORM_SETTINGS_MANAGE
FEATURE_FLAG_MANAGE
```

Backend authorization must verify:

1. User identity.
2. Role.
3. Permission.
4. Resource ownership.
5. Organization/tenant scope.

---

# 10. MASTER ADMIN / SUPER ADMIN

Master Admin is the highest-level role.

Create a dedicated Admin application.

Admin navigation:

```text
Dashboard
Users
Candidates
Recruiters
Organizations
Jobs
Applications
Documents
Parser
Plans
Monetization
Subscriptions
Billing
Usage
Reports
Analytics
Notifications
Security
Audit Logs
System
Settings
Feature Flags
```

---

# 11. MASTER ADMIN DASHBOARD

Show:

## User KPIs

- Total users
- Candidates
- Recruiters
- Active users
- New registrations

## Organization KPIs

- Total organizations
- Active organizations
- Suspended organizations

## Recruitment KPIs

- Active jobs
- Applications
- Interviews
- Offers
- Hires

## Financial KPIs

- Active subscriptions
- Revenue
- Recurring revenue where applicable
- Failed payments
- Trials
- Cancellations

## Platform KPIs

- Parser jobs
- Parser failures
- Storage usage
- Background jobs
- Error rate

Use cards, charts, tables and recent activity.

---

# 12. MASTER ADMIN USER MANAGEMENT

Create:

- User list
- Search
- Filters
- User detail page
- Role management
- Account status
- Subscription
- Usage
- Activity
- Security information

Actions:

- Activate
- Deactivate
- Suspend
- Restore
- Reset access
- Assign roles
- View activity
- Impersonate where authorized

All sensitive actions must be audited.

---

# 13. MASTER ADMIN ORGANIZATION MANAGEMENT

Create:

- Organization list
- Organization details
- Members
- Jobs
- Applications
- Subscription
- Usage
- Billing
- Activity

Actions:

- Create
- Edit
- Suspend
- Restore
- Deactivate
- Manage organization administrator

---

# 14. MASTER ADMIN IMPERSONATION

Implement secure impersonation.

Workflow:

```text
Master Admin
     ↓
Select User
     ↓
Provide Reason
     ↓
Confirm
     ↓
Enter User Context
```

Show a clear banner:

"Impersonation Mode"

The admin must be able to exit impersonation.

Record:

- Admin ID
- User ID
- Reason
- Start time
- End time
- Actions taken

Do not allow unrestricted impersonation without logging.

---

# 15. CANDIDATE PORTAL

Candidate navigation:

```text
Dashboard
Profile
Resume
Jobs
Applications
Documents
Notifications
Settings
```

---

# 16. CANDIDATE ONBOARDING

Design onboarding as:

```text
Registration
 ↓
Email Verification
 ↓
Basic Profile
 ↓
Upload Resume
 ↓
Parse Resume
 ↓
Review
 ↓
Confirm
 ↓
Profile Created
 ↓
Complete Profile
```

The user should be able to skip parsing and manually complete the profile if necessary.

---

# 17. CANDIDATE DASHBOARD

Show:

- Profile completion
- Resume status
- Parse resume CTA
- Recent applications
- Application statuses
- Saved jobs
- Notifications
- Recommended actions

Do not overwhelm the candidate.

The primary action should be obvious.

---

# 18. CANDIDATE PROFILE

Implement:

## Personal Information

- Name
- Email
- Phone
- Location
- Photo

## Professional Summary

- Headline
- Summary
- Experience

## Experience

Fields:

- Company
- Role
- Location
- Start date
- End date
- Current job
- Description
- Achievements

Allow multiple records.

## Education

Allow multiple records.

Fields:

- Institution
- Degree
- Field
- Start date
- End date
- Grade

## Skills

Allow multiple skills.

## Certifications

Allow:

- Name
- Issuer
- Issue date
- Expiry
- Credential ID
- URL

## Projects

Allow:

- Name
- Description
- Role
- Technology
- URL
- Dates

## Languages

Allow:

- Language
- Proficiency

## Links

- LinkedIn
- GitHub
- Portfolio
- Website

---

# 19. PROFILE COMPLETION

Calculate a profile completion percentage.

Example:

```text
Personal Information       20%
Professional Summary       15%
Experience                 25%
Education                  15%
Skills                     10%
Certifications              5%
Projects                    5%
Links                       5%
```

Weights may be configured.

Show actionable missing fields.

---

# 20. RESUME MANAGEMENT

Candidate can:

- Upload resume
- Replace resume
- View resume
- Download resume
- Parse resume
- Re-parse
- Delete resume
- View parsing status
- View versions

Store resume metadata separately from binary storage.

---

# 21. SHARED PARSER SERVICE

Create a reusable parser module:

```text
ParserService
ParserJobService
ParserExtractor
ParserNormalizer
ParserSchema
ParserValidator
ParserResultService
```

The parser must be callable by multiple modules.

Example:

```text
CandidateModule
      ↓
ParserService

RecruiterModule
      ↓
ParserService

AdminModule
      ↓
ParserService
```

Do not duplicate parser code.

SHARED PARSER SERVICE Add: "Pluggable Strategy Pattern: Build ParserExtractor using interchangeable modules for PDF, DOCX, and TXT to allow seamless swapping of underlying open-source libraries".

# 22. PARSER INPUT

Accept:

- PDF
- DOCX
- TXT

Validate:

- File extension
- MIME type
- File size
- File integrity

Reject unsafe or unsupported files.

---

# 23. PARSER PROCESSING

Implement:

```text
Validate
 ↓
Store
 ↓
Create Parser Job
 ↓
Extract Text
 ↓
OCR if necessary
 ↓
Normalize
 ↓
Detect Sections
 ↓
Extract Fields
 ↓
Normalize Fields
 ↓
Validate
 ↓
Calculate Confidence
 ↓
Generate Result
```

Parser processing should be asynchronous.

PARSER PROCESSING Update the processing workflow text to include: Validate → Extract Fields → (On Repeated Failure) Route to Dead Letter Queue.

# 24. PARSER EXTRACTION

Extract:

```text
Personal
- Name
- Email
- Phone
- Location

Professional
- Headline
- Summary

Experience
- Company
- Role
- Dates
- Location
- Description

Education
- Institution
- Degree
- Field
- Dates

Skills
- Skill

Certifications
- Name
- Issuer
- Dates

Projects
- Name
- Description
- Technologies

Languages
- Language
- Proficiency

Links
- LinkedIn
- GitHub
- Portfolio
- Website
```

---

# 25. PARSER NORMALIZATION

Normalize:

## Dates

Convert detected dates into standard formats.

Example:

```text
Jan 2020 → 2020-01
January 2020 → 2020-01
2020 → 2020
Present → null + current=true
```

## Phone

Normalize where possible.

## Email

Validate.

## URLs

Normalize to canonical URLs.

## Skills

Normalize spelling and common variations where deterministic mapping is available.

Do not use AI for normalization in MVP.

---

# 26. PARSER RESULT

Use a strongly typed structure.

Conceptually:

```json
{
  "schemaVersion": "1.0",
  "parserVersion": "1.0",
  "personal": {},
  "summary": "",
  "experience": [],
  "education": [],
  "skills": [],
  "certifications": [],
  "projects": [],
  "languages": [],
  "links": [],
  "warnings": [],
  "metadata": {}
}
```

Do not expose internal implementation details unnecessarily.

---

# 27. PARSER REVIEW UI

After parsing, show a review page.

Each field should be editable.

Example:

```text
Personal Information

Name
[ John Doe ]

Email
[ john@example.com ]

Phone
[ +91 XXXXX XXXXX ]

Experience

Company
[ ABC Technologies ]

Role
[ Software Engineer ]

Start
[ Jan 2022 ]

End
[ Present ]

[ Edit ] [ Confirm ]
```

Provide:

- Edit
- Accept
- Reject
- Add
- Delete

for appropriate fields.

## PARSER REVIEW UI: Add the following UI layout directive: "Implement a side-by-side view (desktop) or stacked view (mobile). The user's original document must remain visible whilst they are editing and confirming the parsed fields".

# 28. PARSER CONFIRMATION

The candidate must explicitly confirm parsed information.

Only confirmed data should populate the profile.

Never automatically overwrite existing profile information.

If profile data already exists:

```text
Existing Value
vs
Parsed Value
```

Show the difference.

Allow:

- Keep existing
- Use parsed
- Edit manually

---

# 29. PARSER JOB STATUS

Statuses:

```text
QUEUED
PROCESSING
COMPLETED
FAILED
CANCELLED
RETRYING
```

Frontend should poll or subscribe to status changes.

---

# 30. PARSER ERROR HANDLING

Support:

- Unsupported file
- File too large
- Corrupt file
- Empty document
- Text extraction failure
- OCR failure
- Parser failure
- Timeout
- Queue failure

Display user-friendly errors.

Log technical details securely.

---

# 31. PARSER ADMIN

Master Admin can view:

- Parser job list
- Status
- User
- Organization
- File type
- Processing duration
- Parser version
- Failure reason
- Retry option

Admin can configure:

- Supported formats
- File size
- Usage limits
- OCR
- Parser version
- Feature availability

---

# 32. RECRUITER PORTAL

Navigation:

```text
Dashboard
Jobs
Candidates
Applications
Pipeline
Interviews
Documents
Reports
Organization
Settings
```

---

# 33. ORGANIZATION

Organization is a tenant.

Every recruiter belongs to an organization.

Implement strict organization isolation.

Example:

```text
Organization A
 ├── Recruiter A
 ├── Jobs
 ├── Applications
 └── Documents

Organization B
 ├── Recruiter B
 ├── Jobs
 ├── Applications
 └── Documents
```

Organization A must never access Organization B's protected data.

---

# 34. ORGANIZATION MEMBER MANAGEMENT

Organization Admin can:

- Invite members
- Remove members
- Suspend members
- Assign roles

Invitation lifecycle:

```text
Invited
 ↓
Accepted
 ↓
Active
```

---

# 35. JOB MANAGEMENT

Create job form.

Fields:

- Job title
- Description
- Department
- Location
- Work mode
- Employment type
- Experience
- Education
- Required skills
- Preferred skills
- Salary
- Openings
- Closing date

Statuses:

```text
DRAFT
PUBLISHED
CLOSED
ARCHIVED
```

## JOB MANAGEMENT: Update the job actions to include the sharing mechanism. Add: "Implement a 'Share' function that generates a canonical, public-facing URL for the job listing (e.g., /jobs/:jobId/:slug)."

# 36. JOB LIST

Provide:

- Search
- Filter
- Sort
- Pagination
- Status
- Recruiter
- Created date
- Application count

---

# 37. JOB DETAIL

Show:

- Job information
- Status
- Applications
- Recruiter
- Activity
- Edit controls
- Publish/close controls

---

# 38. CANDIDATE SEARCH FOR RECRUITERS

Search fields:

- Name
- Skill
- Location
- Experience
- Education
- Certification
- Keyword

Filters:

- Availability
- Application
- Job
- Status

Do not expose unauthorized candidate data.

---

# 39. APPLICATION SYSTEM

Candidate applies to a job.

Create:

```text
Application
Candidate
Job
Organization
Recruiter
Stage
Status
CreatedAt
UpdatedAt
```

Prevent accidental duplicate applications according to business rules.

---

# 40. APPLICATION PIPELINE

Default:

```text
Applied
Screening
Shortlisted
Interview
Assessment
Offer
Hired
```

Terminal:

```text
Rejected
Withdrawn
```

Allow organizations to customize stages later.

---

# 41. APPLICATION DETAIL

Show:

- Candidate
- Job
- Resume
- Profile
- Stage
- Activity
- Notes
- Interviews
- Documents

Recruiters should be able to change stage where authorized.

---

# 42. APPLICATION ACTIVITY

Record:

- Application created
- Stage changes
- Notes
- Interviews
- Documents
- Status changes

Display chronological timeline.

---

# 43. INTERVIEWS

MVP:

- Interview date
- Time
- Type
- Interviewer
- Status
- Notes

Future:

- Calendar integration
- Meeting links
- Automated scheduling

---

# 44. RECRUITER DOCUMENTS

Support:

- Candidate resumes
- Cover letters
- Offer documents
- Internal documents

All access must be permission-controlled.

---

# 45. NOTIFICATIONS

Create a notification service.

Events:

```text
USER_REGISTERED
EMAIL_VERIFIED
APPLICATION_SUBMITTED
APPLICATION_STATUS_CHANGED
JOB_PUBLISHED
JOB_CLOSED
INTERVIEW_CREATED
SUBSCRIPTION_CREATED
PAYMENT_FAILED
SYSTEM_ANNOUNCEMENT
```

Channels:

- In-app
- Email

---

# 46. NOTIFICATION PREFERENCES

Candidates and recruiters can manage permitted preferences.

Examples:

```text
Application Updates
Job Alerts
Recruiter Messages
Billing
Security
System
```

Security notifications should not be fully disableable.

---

# 47. SEARCH

Implement search independently from UI.

Candidate search:

```text
/search/candidates
```

Job search:

```text
/search/jobs
```

Admin search:

```text
/admin/search
```

Support:

- Pagination
- Filtering
- Sorting
- Indexing

---

# 48. DOCUMENT SERVICE

Implement a shared document service.

Responsibilities:

- Upload
- Metadata
- Access control
- Storage
- Download
- Delete
- Versioning
- Retention

Do not store large binary files directly in PostgreSQL.

---

# 49. OBJECT STORAGE

Use S3-compatible storage.

Suggested key structure:

```text
organizations/{organizationId}/documents/{documentId}
candidates/{candidateId}/resumes/{resumeId}
users/{userId}/documents/{documentId}
invoices/{invoiceId}
```

Do not expose predictable public file URLs.

Use signed temporary URLs where necessary.

## OBJECT STORAGE: Specify standard presigned URL time-to-live (TTL) limits (e.g., 900 seconds) and forbid generating permanent object access points.

# 50. MONETIZATION

Create dedicated modules:

```text
Plans
PlanFeatures
Subscriptions
Usage
Billing
Invoices
Payments
```

Do not hard-code plan logic into candidate/recruiter components.

---

# 51. PLANS

Support configurable plans.

Possible candidate plans:

```text
FREE
PREMIUM
```

Possible recruiter plans:

```text
STARTER
PROFESSIONAL
BUSINESS
ENTERPRISE
```

Do not assume these exact plans must be used.

Master Admin must be able to configure plans.

---

# 52. PLAN LIMITS

Possible:

```text
Parser credits
Storage
Jobs
Recruiter seats
Candidate records
Reports
Premium features
```

Create a generic feature/limit model.

---

# 53. USAGE METERING

Record usage independently.

Example:

```text
UsageRecord

userId
organizationId
resourceType
quantity
timestamp
metadata
```

Resource types:

```text
PARSER
STORAGE
JOB
RECRUITER_SEAT
DOCUMENT
```

---

# 54. SUBSCRIPTIONS

Support:

- Create
- Activate
- Upgrade
- Downgrade
- Renew
- Cancel
- Expire
- Suspend

Maintain subscription history.

---

# 55. BILLING

Create provider abstraction:

```text
BillingProvider
 ├── createCustomer()
 ├── createSubscription()
 ├── cancelSubscription()
 ├── createInvoice()
 ├── refundPayment()
 └── handleWebhook()
```

The rest of Portal must not depend directly on a specific payment provider.

---

# 56. INVOICES

Invoice data:

- Invoice number
- Customer
- Organization/user
- Billing period
- Items
- Discount
- Tax
- Total
- Currency
- Status
- Payment status
- Document

---

# 57. ADMIN MONETIZATION UI

Master Admin must be able to:

- Create plans
- Edit plans
- Activate/deactivate plans
- Configure prices
- Configure limits
- Configure features
- Configure trial
- View subscriptions
- View usage
- View billing

---

# 58. REPORTING

Reports:

## Platform

- User growth
- Organization growth
- Jobs
- Applications

## Recruitment

- Application funnel
- Hiring conversion
- Recruiter performance

## Parser

- Total parses
- Success rate
- Failure rate
- Processing time
- Usage by plan

## Financial

- Subscriptions
- Revenue
- Failed payments
- Churn
- Plan distribution

---

# 59. ANALYTICS

Analytics should be permission-controlled.

Do not expose platform-wide financial information to recruiters.

Do not expose other organizations' data.

---

# 60. AUDIT LOGGING

Create centralized AuditService.

Use it for:

- Login/security events
- Role changes
- User changes
- Organization changes
- Parser configuration
- Document access
- Billing changes
- Subscription changes
- Admin actions
- Impersonation
- Data exports
- Destructive operations

---

# 61. DATABASE DESIGN

Use normalized relational structures.

Important relationships:

```text
User
 ├── CandidateProfile
 ├── RecruiterProfile
 └── OrganizationMembership

Organization
 ├── Members
 ├── Jobs
 ├── Applications
 ├── Documents
 └── Subscription

Candidate
 ├── Resumes
 ├── Experience
 ├── Education
 ├── Skills
 ├── Certifications
 ├── Projects
 ├── Applications
 └── Documents

Job
 ├── Applications
 └── Organization

Application
 ├── Candidate
 ├── Job
 ├── Recruiter
 ├── Activities
 └── Interviews

```

## DATABASE DESIGN: Insert the SQL schemas for the custom enumerations (document_type, scan_status) and the primary documents and organization_storage_usage tables directly into this section. This guarantees the engineers understand the exact relational structure required.

DATABASE DESIGN: Add a data_nominees table to the core entities list to manage the DPDP nomination requirement. Additionally, instruct the engineers to add a consent_purpose and notice_language column to the audit_logs table to strictly track under what terms the user agreed to share their CV data.

# 62. DATABASE RULES

Use:

- Foreign keys
- Unique constraints
- Check constraints
- Indexes
- Timestamps
- Soft deletion where appropriate

Avoid storing derived information unnecessarily.

## DATABASE RULES: Add a bullet point mandating the use of UUIDs for primary keys and the inclusion of soft-deletion (deleted_at) columns for GDPR compliance. Also, explicitly require the CONSTRAINT check_bytes_positive CHECK (total_bytes_used >= 0) rule.

API ARCHITECTURE: Append two new necessary API domains to the suggested routes list: /grievances (to handle privacy complaints) and /nominees (to manage DPDP data nominees).

# 63. API DESIGN

Use consistent response structures.

Example:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": []
  }
}
```

Never expose stack traces.

---

# 64. PAGINATION

All potentially large collections must be paginated.

Examples:

- Users
- Candidates
- Jobs
- Applications
- Documents
- Audit logs
- Parser jobs
- Billing records

---

# 65. BACKGROUND JOBS

Use Redis-backed queues or equivalent.

Jobs:

```text
parse_resume
process_document
send_email
generate_report
sync_billing
cleanup_documents
```

Each job must have:

- ID
- Type
- Status
- Created time
- Started time
- Completed time
- Retry count
- Error

Add: "Define specific queues in Redis: queue:parser_high_priority for candidates and queue:parser_low_priority for recruiters".
Add: "Mandate tenant-level rate limiting within the worker configuration to prevent a single organisation from monopolising worker threads."

# 66. SECURITY

Implement:

- Secure password hashing
- Secure sessions
- RBAC
- Tenant isolation
- Rate limiting
- Input validation
- Output encoding
- File validation
- Secure storage
- Signed URLs
- CSRF protection where applicable
- CORS restrictions
- Security headers
- Audit logs

---

# 67. FILE SECURITY

Never trust uploaded file extension alone.

Validate:

- MIME type
- File signature where possible
- Size
- Content

Reject malicious or malformed uploads.

## FILE SECURITY: Mandate buffer-level magic byte checking inside the file upload pipeline before initiating any S3 write or worker dispatch.

# 68. TENANT ISOLATION

Every organization-scoped entity must be associated with an organization where appropriate.

Backend queries must include tenant scope.

Never rely on the frontend to enforce tenant isolation.

Test cross-tenant access explicitly.

---

# 69. ADMIN DATA ACCESS

Master Admin has cross-tenant authority.

However:

- Access must be authenticated.
- Sensitive actions must be audited.
- Impersonation must be explicit.
- Data exports must be audited.
- Destructive actions require confirmation.

---

# 70. FEATURE FLAGS

Implement:

```text
FeatureFlag
- key
- name
- description
- enabled
- environment
- targetType
- targetId
```

Allow future targeting by:

- Global
- Role
- Organization
- User

---

# 71. PLATFORM SETTINGS

Create configurable settings.

Examples:

```text
PLATFORM_NAME
MAX_FILE_SIZE
DEFAULT_PARSER_LIMIT
DEFAULT_STORAGE_LIMIT
SESSION_TIMEOUT
PASSWORD_POLICY
EMAIL_ENABLED
MAINTENANCE_MODE
```

Do not store secrets in ordinary platform settings.

---

# 72. ENVIRONMENT CONFIGURATION

Create:

```text
.env.example
```

Environment variables may include:

```text
DATABASE_URL
REDIS_URL
S3_ENDPOINT
S3_BUCKET
S3_ACCESS_KEY
S3_SECRET_KEY
AUTH_SECRET
EMAIL_PROVIDER
BILLING_PROVIDER
```

Never commit real credentials.

---

# 73. UI COMPONENT SYSTEM

Create reusable components:

```text
Button
Input
Select
Textarea
Modal
Drawer
Table
Pagination
Tabs
Card
Badge
Dropdown
Toast
Alert
FileUploader
ProgressBar
Timeline
EmptyState
LoadingState
ErrorState
```

Do not duplicate components.

## UI COMPONENT SYSTEM: Instruct the frontend team to build two distinct React components to prevent data leakage. Add the following to the components list: JobCardInternal (includes sensitive application metrics and recruiter controls) and JobCardPublic (strictly candidate-facing information and application CTAs).

# 74. DESIGN SYSTEM

Use a consistent design language.

Requirements:

- Professional
- Modern
- Clean
- Responsive
- Accessible
- Recruitment-focused

Candidate and recruiter experiences can have different navigation structures but should share the same design system.

---

# 75. RESPONSIVE DESIGN

Support:

- Desktop
- Tablet
- Mobile

Candidate workflows must be usable on mobile.

Admin tables should gracefully adapt.

## RESPONSIVE DESIGN: Update the existing text to mandate: "Both Candidate workflows AND core Recruiter workflows (Pipeline management, Candidate review, Interview notes) must be fully usable on mobile devices".

# 76. ACCESSIBILITY

Follow WCAG-oriented best practices.

Ensure:

- Keyboard navigation
- Focus visibility
- Semantic HTML
- Labels
- Accessible dialogs
- Accessible validation
- Screen-reader-friendly controls

---

# 77. EMPTY STATES

Every list needs an empty state.

Example:

```text
No jobs found.

Create your first job to start receiving applications.

[Create Job]
```

## EMPTY STATES: Add a strict UI rule: "Never render a dead-end empty state. Every empty state must contain an illustration/icon, a clear explanation of what goes here, and a primary Button component to initiate the creation process".

# 78. LOADING STATES

Use:

- Skeletons
- Progress indicators
- Processing states

Do not leave users staring at blank pages.

---

# 79. ERROR STATES

Provide:

- Clear message
- Recovery action
- Retry where appropriate

Parser errors should offer retry/upload options when possible.

---

# 80. TESTING

Write tests for:

## Authentication

- Registration
- Login
- Logout
- Password reset

## Authorization

- Candidate cannot access Admin
- Recruiter cannot access other organization
- Organization Admin permissions
- Master Admin permissions

## Parser

- PDF
- DOCX
- TXT
- Invalid files
- Missing fields
- Multiple experiences
- Multiple education records
- Dates
- URLs

## Candidate

- Profile
- Resume
- Applications

## Recruiter

- Organization
- Jobs
- Applications
- Pipeline

## Billing

- Plans
- Subscriptions
- Usage
- Payment states

---

# 81. END-TO-END TESTS

Mandatory:

### Candidate Journey

```text
Register
→ Verify
→ Upload Resume
→ Parse
→ Review
→ Confirm
→ Profile
→ Search
→ Apply
→ Track
```

### Recruiter Journey

```text
Register
→ Organization
→ Create Job
→ Publish
→ Application
→ Screening
→ Interview
→ Offer
```

### Admin Journey

```text
Login
→ Dashboard
→ User
→ Organization
→ Parser
→ Plan
→ Billing
→ Audit
```

---

# 82. PERFORMANCE

Optimize:

- Database queries
- Indexes
- API response sizes
- Pagination
- Image/file handling
- Background processing

Never perform expensive parsing synchronously in the main API request.

## ACCOUNT DELETION: Add a strict backend rule: "When a user revokes consent or triggers account deletion, the system must execute a hard delete of all associated records across PostgreSQL and S3 within the legally mandated timeframe, leaving only an anonymised transaction hash in the audit log to prove the deletion occurred".

# 83. OBSERVABILITY

Implement:

- Structured logs
- Metrics
- Error tracking
- Health checks
- Queue monitoring
- Parser metrics
- Billing event logs

Provide:

```text
GET /health
GET /health/ready
```

where appropriate.

---

# 84. BACKUP

Provide:

- Database backup strategy
- Object storage durability
- Recovery documentation
- Backup monitoring

Do not expose raw backup credentials through Admin UI.

---

# 85. MVP BOUNDARY

Do not build unnecessary advanced functionality before the core system works.

MVP priority:

## Priority 1

Authentication
Candidate profile
Resume upload
Parser
Profile population

## Priority 2

Jobs
Applications
Recruiter workflow

## Priority 3

Master Admin
Organizations
RBAC
Audit

## Priority 4

Plans
Subscriptions
Usage
Billing foundation

## Priority 5

Analytics
Advanced reports
Advanced integrations

---

# 86. DO NOT IMPLEMENT AI IN MVP

Do not add:

- OpenAI
- Gemini
- Claude
- LLM parsing
- AI scoring
- AI matching

unless explicitly requested later.

The architecture must allow these features to be added later.

---

# 87. FUTURE AI EXTENSION

Create an interface that could later support:

```text
ParserEngine
 ├── DeterministicParser
 └── AIParser
```

Both should produce the same normalized schema.

The application should not care which parser implementation generated the result.

Add: "The core API must never bypass the ParserEngine abstraction layer, ensuring the deterministic and AI parsers remain perfectly interchangeable".

# 88. FUTURE INTEGRATIONS

Architecture should allow:

- Payment gateways
- Email providers
- Calendar providers
- ATS integrations
- Job boards
- SSO
- Cloud storage providers
- AI services

Use interfaces/adapters where integration complexity justifies it.

---

# 89. CODE QUALITY

Follow:

- Strong typing
- Modular design
- Clear naming
- Small reusable functions
- Separation of concerns
- Dependency injection where appropriate
- Validation
- Error handling
- Tests

Avoid:

- Massive components
- Massive controllers
- Duplicate logic
- Hard-coded business rules
- Hidden global state
- Unnecessary abstractions

---

# 90. DEVELOPMENT ORDER

Build in this order:

## Step 1

Project foundation.

## Step 2

Database and migrations.

## Step 3

Authentication.

## Step 4

RBAC.

## Step 5

Candidate profile.

## Step 6

Document storage.

## Step 7

Parser service.

## Step 8

Candidate resume workflow.

## Step 9

Jobs.

## Step 10

Applications.

## Step 11

Recruiter organization workflow.

## Step 12

Recruiter candidate search.

## Step 13

Master Admin.

## Step 14

Plans and usage.

## Step 15

Billing.

## Step 16

Notifications.

## Step 17

Reports and analytics.

## Step 18

Audit and security hardening.

## Step 19

Testing.

## Step 20

Deployment.

---

# 91. DATABASE MIGRATION RULE

Never manually modify production database structure.

All schema changes must use migrations.

Seed data should be separated from migrations.

## DATABASE MIGRATION RULE: Append the following strict instruction: "All object storage uploads must initiate within a database transaction. If the S3 upload succeeds but the documents table insert fails, the S3 object must be immediately rolled back (deleted) to prevent orphaned files".

# 92. SEED DATA

Development environment should include:

## Users

- Master Admin
- Organization Admin
- Recruiter
- Candidate

## Organization

- Example organization

## Jobs

- Example published job
- Example draft job

## Application

- Example application

## Plans

- Free
- Starter
- Professional

These are development defaults only.

---

# 93. DEMO DATA

Do not use real people's personal data.

Use clearly fictional test data.

---

# 94. API SECURITY

Every protected API endpoint must verify authentication.

Admin endpoints must additionally verify Master Admin permissions.

Organization endpoints must verify tenant scope.

Candidate endpoints must verify candidate ownership or explicit authorization.

---

# 95. DOCUMENT ACCESS RULE

Never return a raw permanent storage URL for private documents.

Generate temporary signed URLs where appropriate.

## DOCUMENT ACCESS RULE: Instruct the engineering team that access control checks (verifying tenant scope and user permissions) must occur immediately before generating presigned URLs

# 96. PARSER DATA PRIVACY

Resume contents are sensitive personal/professional information.

Do not:

- Log complete resumes unnecessarily.
- Expose parser results publicly.
- Send resumes to external AI services in MVP.
- Store duplicate copies unnecessarily.

---

# 97. BILLING DATA PRIVACY

Billing information must only be accessible to:

- Relevant organization administrators
- Authorized Master Admin
- Authorized billing services

Recruiters without billing permission must not access billing information.

---

# 98. MASTER ADMIN AUDIT REQUIREMENT

At minimum audit:

```text
Login
Logout/security events
Role changes
User suspension
User activation
Organization suspension
Organization changes
Impersonation
Parser configuration
Plan changes
Pricing changes
Subscription actions
Billing actions
Data exports
Document access
Destructive operations
Platform setting changes
Feature flag changes
```

---

# 99. FINAL VALIDATION CHECKLIST

Before considering the project complete, verify:

## Architecture

- [ ] Parser is shared.
- [ ] Parser is not Admin-only.
- [ ] Modules are separated.
- [ ] Background jobs exist.
- [ ] Storage is separate from DB.

## Candidate

- [ ] Registration
- [ ] Login
- [ ] Profile
- [ ] Resume upload
- [ ] Parser
- [ ] Review
- [ ] Confirmation
- [ ] Profile population
- [ ] Jobs
- [ ] Applications
- [ ] Documents
- [ ] Notifications

## Recruiter

- [ ] Organization
- [ ] Members
- [ ] Roles
- [ ] Jobs
- [ ] Candidates
- [ ] Applications
- [ ] Pipeline
- [ ] Interviews
- [ ] Documents
- [ ] Parser
- [ ] Reports

## Master Admin

- [ ] Dashboard
- [ ] Users
- [ ] Candidates
- [ ] Recruiters
- [ ] Organizations
- [ ] RBAC
- [ ] Parser administration
- [ ] Documents
- [ ] Plans
- [ ] Monetization
- [ ] Subscriptions
- [ ] Billing
- [ ] Usage
- [ ] Analytics
- [ ] Reports
- [ ] Notifications
- [ ] Security
- [ ] Audit
- [ ] System
- [ ] Settings
- [ ] Feature flags

## Security

- [ ] Authentication
- [ ] Authorization
- [ ] Tenant isolation
- [ ] File validation
- [ ] Private storage
- [ ] Audit logging
- [ ] Rate limiting
- [ ] Secure secrets

## Quality

- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Error states
- [ ] Loading states
- [ ] Empty states
- [ ] Responsive UI
- [ ] Accessibility

---

# 100. ABSOLUTE IMPLEMENTATION RULES

The following rules override convenience during implementation:

### RULE 1

Do not turn Portal into a parser application.

### RULE 2

Do not make Parser an Admin-only module.

### RULE 3

Candidate resume parsing is a first-class workflow.

### RULE 4

Parser must work without AI in MVP.

### RULE 5

Do not silently overwrite candidate profile information.

### RULE 6

All organization data must be tenant-isolated.

### RULE 7

Frontend authorization is not sufficient.

### RULE 8

Master Admin is the Super Admin.

### RULE 9

Master Admin has complete platform authority, but sensitive operations must be audited.

### RULE 10

Monetization, subscriptions and billing must be configurable from Master Admin.

### RULE 11

Business rules must not be hard-coded into individual UI components.

### RULE 12

Use background workers for parsing and expensive document operations.

### RULE 13

Use PostgreSQL for structured application data.

### RULE 14

Use S3-compatible object storage for binary documents.

### RULE 15

Use Redis or equivalent for queues/cache where appropriate.

### RULE 16

Do not introduce unnecessary microservices.

### RULE 17

Do not introduce AI unless explicitly requested.

### RULE 18

Do not expose private documents publicly.

### RULE 19

Do not expose sensitive information in logs.

### RULE 20

Do not mark the project complete until the Candidate → Parser → Profile workflow, Recruiter → Job → Application workflow, and Master Admin → Platform Management workflow all function end-to-end.

---

# 101. FINAL EXPECTED PRODUCT

The finished application should behave conceptually as:

```text
                           PORTAL
                              |
        +---------------------+---------------------+
        |                     |                     |
        ▼                     ▼                     ▼
   CANDIDATE             RECRUITER             MASTER ADMIN
     PORTAL                PORTAL              / SUPER ADMIN
        |                     |                     |
        |                     |                     |
        +---------------------+---------------------+
                              |
                     SHARED PLATFORM SERVICES
                              |
       +-----------+----------+----------+-----------+
       |           |          |          |           |
       ▼           ▼          ▼          ▼           ▼
    PARSER     DOCUMENTS    SEARCH   NOTIFICATIONS BILLING
       |           |          |          |           |
       +-----------+----------+----------+-----------+
                              |
                    PLATFORM CORE SERVICES
                              |
          +-------------------+-------------------+
          |                   |                   |
          ▼                   ▼                   ▼
      PostgreSQL            Redis             S3 Storage
```

The core product experience must be:

```text
CANDIDATE

Resume
  ↓
Parser
  ↓
Review
  ↓
Profile
  ↓
Jobs
  ↓
Application
  ↓
Tracking


RECRUITER

Organization
  ↓
Job
  ↓
Candidates
  ↓
Application
  ↓
Pipeline
  ↓
Interview
  ↓
Offer
  ↓
Hire


MASTER ADMIN

Platform
  ↓
Users
  ↓
Organizations
  ↓
Parser
  ↓
Plans
  ↓
Subscriptions
  ↓
Billing
  ↓
Analytics
  ↓
Security
  ↓
Audit
  ↓
Configuration
```

Build the application around these three experiences and the shared platform services.

Do not deviate from the fundamental architecture unless explicitly instructed.

```

### Important implementation clarification

The two files should now be treated as:

- **`PRD.md`** → defines **what Portal is, what it must do, business requirements, modules, workflows, rules, architecture and acceptance criteria**.
- **`prompt.md`** → defines **how the development/build system should actually implement Portal**, including architecture, modules, routes, services, database, parser, security, testing, development order and implementation constraints.

This separation should be maintained when we move into the actual application build.
```
