import type { RemixiconComponentType } from '@remixicon/react';

/**
 * The single entry point for functional icons. Sizes are limited to the three
 * the design system allows, colour is inherited, and every icon is decorative:
 * the accessible name always comes from the control that contains it.
 */
const sizes = { inline: 16, nav: 18, action: 20 } as const;

export function AppIcon({
  icon: Icon,
  size = 'nav',
}: {
  icon: RemixiconComponentType;
  size?: keyof typeof sizes;
}) {
  return <Icon aria-hidden="true" focusable="false" size={sizes[size]} />;
}
