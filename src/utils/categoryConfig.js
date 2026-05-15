export const WEBSITE_CATEGORIES = Object.freeze({
  PRODUCTIVE: 'productive',
  UNPRODUCTIVE: 'unproductive',
  NEUTRAL: 'neutral',
});

export const DEFAULT_CATEGORY = WEBSITE_CATEGORIES.NEUTRAL;

export const TRACKABLE_PROTOCOLS = Object.freeze(['http:', 'https:']);

export const NON_TRACKABLE_PROTOCOLS = Object.freeze([
  'about:',
  'chrome:',
  'chrome-extension:',
  'data:',
  'devtools:',
  'edge:',
  'file:',
  'javascript:',
  'mailto:',
  'view-source:',
]);

export const PRODUCTIVE_DOMAINS = new Set([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'stackoverflow.com',
  'stackexchange.com',
  'developer.mozilla.org',
  'docs.github.com',
  'w3schools.com',
  'freecodecamp.org',
  'leetcode.com',
  'geeksforgeeks.org',
  'coursera.org',
  'edx.org',
  'udemy.com',
  'khanacademy.org',
  'notion.so',
  'trello.com',
  'asana.com',
  'slack.com',
  'docs.google.com',
  'sheets.google.com',
  'localhost',
  '127.0.0.1',
]);

export const UNPRODUCTIVE_DOMAINS = new Set([
  'youtube.com',
  'netflix.com',
  'primevideo.com',
  'hotstar.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'reddit.com',
  'pinterest.com',
  'tiktok.com',
  'snapchat.com',
  'twitch.tv',
  'discord.com',
]);

export const NEUTRAL_DOMAINS = new Set([
  'google.com',
  'bing.com',
  'yahoo.com',
  'gmail.com',
  'outlook.com',
  'wikipedia.org',
  'amazon.com',
  'flipkart.com',
]);

export const DOMAIN_CATEGORIES = Object.freeze({
  [WEBSITE_CATEGORIES.PRODUCTIVE]: PRODUCTIVE_DOMAINS,
  [WEBSITE_CATEGORIES.UNPRODUCTIVE]: UNPRODUCTIVE_DOMAINS,
  [WEBSITE_CATEGORIES.NEUTRAL]: NEUTRAL_DOMAINS,
});

export const CATEGORY_DOMAIN_RULES = DOMAIN_CATEGORIES;
