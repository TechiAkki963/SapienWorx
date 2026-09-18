# SapienWorx role photography

Step 3 moves public/auth role photography into the application so rendering
does not depend on third-party image delivery at runtime.

All role files in this directory are local WebP assets with a source width
of 3840 pixels. The page-level filenames remain stable so existing layouts,
responsive crops, alt text and authentication flows do not need rewrites.

Source set used for this integration:

- Candidate: Unsplash photo `1758691737605-69a0e78bd193`
- Recruiter: Unsplash photo `1758518730327-98070967caab`
- Workplace / talent: Unsplash photo `1758518730380-04c8e0d57b68`
- Employer: Unsplash photo `1742119971773-57e0131095b0`

Before replacing these images in a future brand-art pass, preserve the
existing filenames or update every consuming page and the UI regression
tests together.
