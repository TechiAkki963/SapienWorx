"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Guide = {
  slug: string;
  title: string;
  category: string;
  dek: string;
  image: string;
  alt: string;
};

export function KnowledgeCards({ guides }: { guides: readonly Guide[] }) {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const goTo = (index: number) => {
    const node = track.current;
    if (!node) return;
    node.scrollTo({ left: index * node.clientWidth, behavior: "smooth" });
    setActive(index);
  };

  const onScroll = () => {
    const node = track.current;
    if (node && node.clientWidth) {
      setActive(Math.max(0, Math.min(guides.length - 1, Math.round(node.scrollLeft / node.clientWidth))));
    }
  };

  return (
    <div className="swx-knowledge-collection">
      <div className="swx-guides-track" ref={track} onScroll={onScroll} aria-label="Career guides">
        {guides.map((guide, i) => (
          <article className="swx-guide-card" id={`swx-guide-${i}`} key={guide.slug}>
            <Link className="swx-guide-image" href={`/resources/${guide.slug}`} aria-label={`Read ${guide.title}`}>
              <Image src={`/images/people/${encodeURIComponent(guide.image)}`} alt={guide.alt} fill sizes="(max-width: 699px) 90vw, (max-width: 1100px) 44vw, 25vw" />
              {i === 0 && <span className="swx-featured">Featured article</span>}
            </Link>
            <div className="swx-guide-content">
              <span className="swx-guide-category">{guide.category}</span>
              <h3><Link href={`/resources/${guide.slug}`}>{guide.title}</Link></h3>
              <p>{guide.dek}</p>
              <Link className="swx-article-link" href={`/resources/${guide.slug}`}>Read article <span aria-hidden="true">→</span></Link>
            </div>
          </article>
        ))}
      </div>
      <div className="swx-guide-dots" aria-label="Choose a guide">
        {guides.map((guide, i) => (
          <button type="button" key={guide.slug} aria-label={`Show guide ${i + 1}: ${guide.title}`} aria-pressed={active === i} className={active === i ? "swx-dot active" : "swx-dot"} onClick={() => goTo(i)} />
        ))}
      </div>
    </div>
  );
}
