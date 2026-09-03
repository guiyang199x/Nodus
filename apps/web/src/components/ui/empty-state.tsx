import Image from 'next/image';
import type { ReactNode } from 'react';

/**
 * Empty states pair an approved illustration with a real heading, explanation
 * and action. The illustration is never the only carrier of meaning.
 */
export function EmptyState(props: {
  imageSrc: string;
  imageAlt: string;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <section
      aria-labelledby="empty-title"
      className="mx-auto flex max-w-xl flex-col items-center py-12 text-center"
    >
      <Image src={props.imageSrc} alt={props.imageAlt} width={362} height={272} priority />
      <h1 id="empty-title" className="mt-5 text-2xl font-semibold tracking-[-0.02em]">
        {props.title}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{props.description}</p>
      <div className="mt-5">{props.action}</div>
    </section>
  );
}
