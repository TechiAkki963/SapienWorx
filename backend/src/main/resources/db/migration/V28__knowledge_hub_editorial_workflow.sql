create table if not exists knowledge_posts (
    id uuid primary key,
    slug varchar(180) not null unique,
    title varchar(180) not null,
    category varchar(80) not null,
    excerpt varchar(420) not null,
    body text not null,
    hero_tone varchar(24) not null default 'navy',
    featured boolean not null default false,
    status varchar(20) not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    author_admin_id uuid,
    author_name varchar(160) not null,
    last_editorial_note varchar(500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    published_at timestamptz
);

create index if not exists idx_knowledge_posts_publication on knowledge_posts(status, published_at desc);
create index if not exists idx_knowledge_posts_featured on knowledge_posts(featured, published_at desc) where status = 'PUBLISHED';

insert into knowledge_posts (id, slug, title, category, excerpt, body, hero_tone, featured, status, author_name, published_at)
values
('11111111-1111-4111-8111-111111111101', 'make-your-portfolio-tell-a-stronger-product-story',
 'How to make your portfolio tell a stronger product story', 'Career growth',
 'A practical structure for showing the decisions, trade-offs and measurable outcomes behind your strongest work.',
 E'A strong portfolio does more than display polished screens. It helps a hiring team understand how you think.\n\nStart each case study with the problem, the people affected and the constraint that made the work difficult. Then explain the options you considered, the evidence that changed your direction and the part you personally owned.\n\nFinish with outcomes and reflection. Numbers are useful, but a thoughtful explanation of what you would improve next can be just as persuasive. Keep the language direct and make every image earn its place.',
 'blue', true, 'PUBLISHED', 'Sapienworx Editorial', now() - interval '3 days'),
('11111111-1111-4111-8111-111111111102', 'practical-guide-to-finding-the-right-hybrid-role',
 'A practical guide to finding the right hybrid role', 'Job search',
 'Questions that reveal whether a company’s hybrid policy will genuinely support the way you do your best work.',
 E'Hybrid can mean anything from occasional office visits to a tightly scheduled working week. Ask for the actual team rhythm before deciding whether a role fits.\n\nExplore how meetings are run, how decisions are documented and whether remote colleagues have equal access to leaders and projects. A good policy should describe how the team works, not merely how many days appear in an office calendar.\n\nConsider the practical cost as well: travel time, equipment, quiet working space and the flexibility you need outside work. The right role should remain sustainable after the excitement of joining has settled.',
 'purple', true, 'PUBLISHED', 'Sapienworx Editorial', now() - interval '2 days'),
('11111111-1111-4111-8111-111111111103', 'questions-worth-asking-before-you-accept-an-offer',
 'Questions worth asking before you accept an offer', 'Work life',
 'A concise conversation guide for understanding expectations, growth, management and the realities behind an offer.',
 E'An offer answers the salary question, but it does not automatically answer whether the role will help you thrive. Use the final conversation to understand what success looks like after three, six and twelve months.\n\nAsk how priorities are set, how feedback is shared and what happened to the last person in the role. Explore the manager’s working style and the decisions you will be trusted to make independently.\n\nYou are not trying to catch the company out. You are testing whether both sides have the same picture of the work. Clear expectations before joining prevent avoidable disappointment later.',
 'sage', true, 'PUBLISHED', 'Sapienworx Editorial', now() - interval '1 day')
on conflict (slug) do nothing;
