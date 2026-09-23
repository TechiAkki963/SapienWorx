# Landing-page image library — Workstream 2, Step 2

These copies intentionally isolate the landing-page imagery from authentication and role-specific artwork. Do not change the matching `public/images/people` assets just to update the homepage.

| Landing asset | Bundled source | Role |
| --- | --- | --- |
| `hero-candidate.webp` | `sapien-hero-candidate.webp` | Hero photograph |
| `discover.webp` | `candidate-signup.webp` | Candidate with laptop |
| `grow.webp` | `candidate-dashboard.webp` | Professional growth portrait |
| `belong.webp` | `candidate-login.webp` | Professional with glasses/laptop |
| `final-cta.webp` | `sapien-hero-candidate.webp` | Deliberate repeat for brand continuity |

**Status: curated temporary assets, NOT exact reproductions of the approved Image 2.** Discover and Belong no longer show generic corporate interview scenes. Image 2's headset photograph and some article art are not available as standalone source originals; supply/generate those separately before claiming pixel-level fidelity.

Article images are owned by the Knowledge Hub publishing database; update their approved cover options and the related editorial records through a separately reviewed migration/editor action, not by adding a hard-coded source in `app/page.tsx`.

Image QA: check decoded width, content-specific alt text, subject crop at 320/390/768/1024/1440/1920, no horizontal overflow, no text over faces, reduced-motion, and legibility of all linked card actions.
