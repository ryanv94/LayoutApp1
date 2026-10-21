export interface ToolMeta {
  slug: string;
  frame: string;
  name: string;
  nav: string;
  blurb: string;
}

export const PRIVACY =
  'Your photos are processed entirely on your device and are never uploaded. We use anonymous analytics to improve the site.';

export const TOOL: ToolMeta = {
  slug: 'layout',
  frame: '01',
  name: 'Layout',
  nav: 'Layout',
  blurb: 'Arrange 6–10 photos into a balanced, print-ready composition.',
};
