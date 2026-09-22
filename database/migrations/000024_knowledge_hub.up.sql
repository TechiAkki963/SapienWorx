BEGIN;

CREATE TABLE knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL UNIQUE,
  title varchar(180) NOT NULL,
  category varchar(60) NOT NULL,
  excerpt varchar(350) NOT NULL,
  body text NOT NULL,
  image_path varchar(220) NOT NULL,
  image_alt varchar(220) NOT NULL,
  author_name varchar(120) NOT NULL DEFAULT 'SapienWorx Editorial',
  status varchar(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  featured_order integer NOT NULL DEFAULT 0 CHECK (featured_order >= 0),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  published_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_slug_valid CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT knowledge_article_not_blank CHECK (btrim(title) <> '' AND btrim(category) <> '' AND btrim(excerpt) <> '' AND btrim(body) <> '' AND btrim(image_alt) <> ''),
  CONSTRAINT knowledge_published_at_required CHECK (status = 'draft' OR published_at IS NOT NULL),
  CONSTRAINT knowledge_local_image CHECK (image_path LIKE '/images/people/%.webp')
);

CREATE INDEX ix_knowledge_articles_public ON knowledge_articles (featured_order, published_at DESC) WHERE status = 'published';
CREATE INDEX ix_knowledge_articles_admin ON knowledge_articles (updated_at DESC);
CREATE TRIGGER trg_knowledge_articles_updated_at BEFORE UPDATE ON knowledge_articles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO knowledge_articles(slug,title,category,excerpt,body,image_path,image_alt,featured_order,status,published_at)
VALUES
('build-a-resume-that-tells-your-story',
 'Build a résumé that tells your story',
 'Resume & Profile',
 'A clear, specific résumé helps a recruiter understand the work you have actually done.',
 'Start with the role you want. Read several job descriptions and notice which skills and responsibilities recur. Give those relevant experiences room in your résumé rather than trying to describe every task you have ever completed.

For each role, explain the problem, your contribution and the result. A sentence such as “Automated a weekly report and reduced preparation time from four hours to one” tells a clearer story than “Responsible for reporting.” Only use numbers you can support.

Keep headings consistent and your contact details easy to find. Use readable text, a straightforward layout and ordinary section names so people and parsing tools can locate experience, education and skills. Before sending, check dates, links and the file name.

Your SapienWorx profile can complement your résumé with context: preferred roles, availability, projects and the skills you want to keep building.',
 '/images/people/candidate-signup.webp',
 'Professional preparing a career profile at a bright desk',1,'published',now()),
('prepare-for-an-interview-with-confidence',
 'Prepare for an interview with confidence',
 'Interview Preparation',
 'Prepare real examples, useful questions and a calm plan for the interview day.',
 'Start by understanding the role: what problems will this person solve, who will they work with and which skills matter most? Match your preparation to the actual description, not a generic list of questions.

Choose three or four examples from your work, studies or projects. For each, remember the situation, what you personally did and what happened. Be ready to explain decisions and trade-offs, including what you would change next time.

Prepare questions about how success is measured, what the team is building and the steps in the hiring process. For a virtual interview, check your connection, microphone and meeting link in advance. For an in-person meeting, confirm the location and travel time.

Afterward, write down what you learned. If the process is still open, follow up respectfully through the agreed channel rather than guessing what silence means.',
 '/images/people/recruiter-review.webp',
 'Professional reviewing notes before a job interview',2,'published',now()),
('make-a-practical-skill-growth-plan',
 'Make a practical skill-growth plan',
 'Skills & Career Growth',
 'Turn an ambitious career goal into small, verifiable learning milestones.',
 'Pick one target role and compare its common requirements with your current experience. Separate skills you already use, skills you know in theory and skills you have yet to practice. That gap list is more useful than collecting random courses.

Choose one important skill to work on first. Set a manageable weekly practice block and a concrete output: a small project, a written case study or a demonstration you can explain to another person. Revisit what you built and ask for constructive feedback.

Keep a short record of the decisions you made and the problems you solved. Employers can discuss a real example more meaningfully than a long list of untested claims.

You do not have to master everything at once. Reassess your plan as the role, technology and your interests evolve.',
 '/images/people/candidate-dashboard.webp',
 'Professional planning skills and career growth at a computer',3,'published',now()),
('humans-and-ai-working-better-together',
 'Humans and AI working better together',
 'Humans & AI at Work',
 'A practical way to use AI tools while keeping human judgment and accountability central.',
 'AI tools can help draft an outline, explore approaches or summarize information, but their output still needs human review. Start with a well-defined task and decide what a useful result would look like before opening a tool.

Check important claims against primary information, especially when a recommendation affects a customer, a candidate or a colleague. Be careful with confidential résumés, employer information and personal data: follow the rules of the organization and use approved tools.

Build skills that complement automation: clear communication, domain understanding, problem framing and the ability to notice when an answer is incomplete. Practise explaining not just what a tool produced, but why you accepted or rejected it.

The goal is not to predict which jobs will disappear. It is to understand how your own work changes and make deliberate choices about where to build expertise.',
 '/images/people/recruiter-team.webp',
 'Professional team discussing work and technology together',4,'published',now())
ON CONFLICT (slug) DO NOTHING;

COMMIT;
