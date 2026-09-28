# Master Admin completion roadmap

Approved direction: implement all eight workstreams in independently reviewable local phases. No automatic commit, push, existing-account mutation, cloud provisioning or deployment. The active checkout contains earlier work that must be preserved.

1. **Read-only foundation implemented and locally tested:** recruitment/application/interview metadata and recorded timelines, precise dashboard links, organization/country reporting scope. Existing stage/interview audits are used; missing historical actors or job edits are not invented. Independent issued-offer/employment ledgers and comprehensive recruiter job-edit history remain pending.
2. **Partially implemented and locally tested:** candidate onboarding/completion/consent counts and recruiter activity summaries. Organization restrictions/invitations/reassignment and reviewed duplicate/merge workflows remain pending.
3. **Recovery preparation implemented and locally tested; activation pending:** dry-run-first offline recovery tool, independent-operator checks, explicit apply gates, atomic audit-failure rollback and a reviewed activation runbook. Assignment-management and application-enforced dual approval remain pending. Least-privilege recommendation: confirmed owner only as Super Admin, separate operational roles and a separate Security Admin recovery operator. No real identity has been confirmed or assigned. Runtime key installation and MFA activation remain gated on identity/recovery/release review.
4. **Pending:** reviewer-owned moderation/privacy cases, consent/retention/legal-hold and governed fulfilment.
5. **Pending:** metadata-only InMail/SES/parser telemetry; no provider change or new SES production-access request.
6. **Pending:** measured local/live operations, alert ownership, release evidence and backup/restore evidence. Unconnected sources stay unavailable, not healthy.
7. **Pending:** read-only actual cost reporting, controlled content publishing/revisions and operational settings. Subscription management deferred.
8. **Pending:** scoped combined diff review, isolated acceptance, reviewed release approval and target-environment acceptance. Production side effects require approval of exact identities/configuration/release.

Each checkpoint needs backend authorization/privacy tests, isolated PostgreSQL where applicable, frontend checks/build and responsive visual review. Tests use separate ports/databases, not the running candidate/recruiter app or real users. No expensive monitoring infrastructure or third-party SaaS is introduced.

Current evidence and scoped file inventory: [Recruitment/account review checkpoint](admin-recruitment-review.md). Identity/role recommendation and recovery procedure: [Security activation runbook](admin-security-activation-runbook.md).
