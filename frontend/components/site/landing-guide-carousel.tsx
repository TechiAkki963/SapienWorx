"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";

type Guide = {
  slug: string;
  image: string;
  alt: string;
  category: string;
  title: string;
  dek: string;
};

export function LandingGuideCarousel({ guides }: { guides: readonly Guide[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function goTo(index: number) {
    const element = rail.current?.children[index] as HTMLElement | undefined;
    element?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setActive(index);
  }

  function updateActive() {
    const parent = rail.current;
    if (!parent || parent.children.length === 0) return;
    const left = parent.getBoundingClientRect().left;
    const closest = [...parent.children].reduce((best, item, index) => {
      const distance = Math.abs(item.getBoundingClientRect().left - left);
      return distance < best.distance ? { index, distance } : best;
    }, { index: 0, distance: Infinity });
    setActive(closest.index);
  }

  return (
    <>
      <div className="swx-guide-grid" ref={rail} onScroll={updateActive} aria-label="Career resource guides">
        {guides.map((guide, index) => (
          <Reveal key={guide.slug} className="h-full" delay={index * 0.05}>
            <article className="swx-guide-card">
              <Link href={`/resources/${guide.slug}`} className="swx-guide-image" aria-label={`Read ${guide.title}`}>
                <Image src={`/images/people/${encodeURIComponent(guide.image)}`} alt={guide.alt} fill sizes="(max-width: 640px) 88vw, (max-width: 900px) 46vw, 280px" className="object-cover object-center" />
                {index === 0 && <span className="swx-featured">Career essentials</span>}
              </Link>
              <div className="swx-guide-body">
                <p className="swx-guide-category">{guide.category}</p>
                <h3 className="swx-display"><Link href={`/resources/${guide.slug}`}>{guide.title}</Link></h3>
                <p>{index === 0 ? "Showcase your unique value and stand out to employers." : guide.dek}</p>
                <Link href={`/resources/${guide.slug}`}>Read article <span aria-hidden="true">→</span></Link>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
      <div className="swx-guide-dots" role="group" aria-label="Choose a career guide">
        {guides.map((guide,index) => <button key={guide.slug} type="button" aria-label={`Show guide ${index+1}: ${guide.title}`} aria-pressed={active === index} onClick={() => goTo(index)} />)}
      </div>
    </>
  );
}
