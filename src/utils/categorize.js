import {
  CATEGORY_DOMAIN_RULES,
  DEFAULT_CATEGORY,
  NON_TRACKABLE_PROTOCOLS,
  TRACKABLE_PROTOCOLS,
  WEBSITE_CATEGORIES,
} from './categoryConfig.js';

export {
  CATEGORY_DOMAIN_RULES,
  DEFAULT_CATEGORY,
  DOMAIN_CATEGORIES,
  NEUTRAL_DOMAINS,
  NON_TRACKABLE_PROTOCOLS,
  PRODUCTIVE_DOMAINS,
  TRACKABLE_PROTOCOLS,
  UNPRODUCTIVE_DOMAINS,
  WEBSITE_CATEGORIES,
} from './categoryConfig.js';

const CATEGORY_VALUES = Object.freeze(Object.values(WEBSITE_CATEGORIES));

function getRuleDomainList(domains) {
  if (Array.isArray(domains)) {
    return domains;
  }

  if (domains instanceof Set) {
    return Array.from(domains);
  }

  return [];
}

function hasExplicitUrlScheme(value) {
  const normalizedValue = value.toLowerCase();

  return (
    /^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedValue) ||
    NON_TRACKABLE_PROTOCOLS.some((protocol) =>
      normalizedValue.startsWith(protocol),
    )
  );
}

function removePort(hostname) {
  if (hostname.startsWith('[')) {
    return hostname;
  }

  return hostname.replace(/:\d+$/, '');
}

export function removeWwwPrefix(hostname) {
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

export function isValidCategory(category) {
  return CATEGORY_VALUES.includes(category);
}

export function isTrackableProtocol(protocol) {
  return TRACKABLE_PROTOCOLS.includes(protocol);
}

export function normalizeHostname(hostname) {
  if (typeof hostname !== 'string') {
    return null;
  }

  const trimmedHostname = hostname.trim().toLowerCase();

  if (!trimmedHostname || /\s/.test(trimmedHostname)) {
    return null;
  }

  const withoutPort = removePort(trimmedHostname);
  const withoutTrailingDot = withoutPort.endsWith('.')
    ? withoutPort.slice(0, -1)
    : withoutPort;
  const withoutCommonPrefix = removeWwwPrefix(withoutTrailingDot);

  return withoutCommonPrefix || null;
}

export function normalizeDomain(domain) {
  return normalizeHostname(domain);
}

export function extractHostnameFromUrl(urlOrHostname) {
  if (typeof urlOrHostname !== 'string') {
    return null;
  }

  const input = urlOrHostname.trim();

  if (!input) {
    return null;
  }

  try {
    const url = new URL(
      hasExplicitUrlScheme(input) ? input : `https://${input}`,
    );

    if (!isTrackableProtocol(url.protocol)) {
      return null;
    }

    return normalizeHostname(url.hostname);
  } catch {
    return null;
  }
}

export function extractHostname(urlOrHostname) {
  return extractHostnameFromUrl(urlOrHostname);
}

export function isDomainMatch(hostname, ruleDomain) {
  const normalizedHostname = normalizeHostname(hostname);
  const normalizedRuleDomain = normalizeHostname(ruleDomain);

  if (!normalizedHostname || !normalizedRuleDomain) {
    return false;
  }

  return (
    normalizedHostname === normalizedRuleDomain ||
    normalizedHostname.endsWith(`.${normalizedRuleDomain}`)
  );
}

export function normalizeCategoryOverrides(overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return {};
  }

  return Object.entries(overrides).reduce((normalizedOverrides, [domain, category]) => {
    const normalizedDomain = normalizeDomain(domain);

    if (normalizedDomain && isValidCategory(category)) {
      normalizedOverrides[normalizedDomain] = category;
    }

    return normalizedOverrides;
  }, {});
}

function createRuleGroupsFromOverrides(overrides = {}) {
  const normalizedOverrides = normalizeCategoryOverrides(overrides);

  return {
    [WEBSITE_CATEGORIES.PRODUCTIVE]: Object.entries(normalizedOverrides)
      .filter(([, category]) => category === WEBSITE_CATEGORIES.PRODUCTIVE)
      .map(([domain]) => domain),
    [WEBSITE_CATEGORIES.UNPRODUCTIVE]: Object.entries(normalizedOverrides)
      .filter(([, category]) => category === WEBSITE_CATEGORIES.UNPRODUCTIVE)
      .map(([domain]) => domain),
    [WEBSITE_CATEGORIES.NEUTRAL]: Object.entries(normalizedOverrides)
      .filter(([, category]) => category === WEBSITE_CATEGORIES.NEUTRAL)
      .map(([domain]) => domain),
  };
}

export function findMatchingDomainRule(
  hostname,
  rules = CATEGORY_DOMAIN_RULES,
) {
  const normalizedHostname = normalizeDomain(hostname);

  if (!normalizedHostname) {
    return null;
  }

  let bestMatch = null;

  for (const [category, domains] of Object.entries(rules)) {
    const ruleDomains = getRuleDomainList(domains);

    if (!isValidCategory(category) || ruleDomains.length === 0) {
      continue;
    }

    for (const ruleDomain of ruleDomains) {
      const normalizedRuleDomain = normalizeDomain(ruleDomain);

      if (!normalizedRuleDomain) {
        continue;
      }

      if (!isDomainMatch(normalizedHostname, normalizedRuleDomain)) {
        continue;
      }

      if (
        !bestMatch ||
        normalizedRuleDomain.length > bestMatch.domain.length
      ) {
        bestMatch = {
          category,
          domain: normalizedRuleDomain,
        };
      }
    }
  }

  return bestMatch;
}

export function getCategoryDetailsForHostname(hostname, options = {}) {
  const normalizedHostname = normalizeDomain(hostname);

  if (!normalizedHostname) {
    return {
      hostname: null,
      category: DEFAULT_CATEGORY,
      matchedDomain: null,
      source: 'fallback',
      isKnown: false,
    };
  }

  const overrideMatch = findMatchingDomainRule(
    normalizedHostname,
    createRuleGroupsFromOverrides(options.overrides),
  );

  if (overrideMatch) {
    return {
      hostname: normalizedHostname,
      category: overrideMatch.category,
      matchedDomain: overrideMatch.domain,
      source: 'override',
      isKnown: true,
    };
  }

  const ruleMatch = findMatchingDomainRule(
    normalizedHostname,
    options.rules ?? CATEGORY_DOMAIN_RULES,
  );

  if (ruleMatch) {
    return {
      hostname: normalizedHostname,
      category: ruleMatch.category,
      matchedDomain: ruleMatch.domain,
      source: 'default-rule',
      isKnown: true,
    };
  }

  return {
    hostname: normalizedHostname,
    category: DEFAULT_CATEGORY,
    matchedDomain: null,
    source: 'fallback',
    isKnown: false,
  };
}

export function getCategoryForHostname(hostname, options = {}) {
  return getCategoryDetailsForHostname(hostname, options).category;
}

export function getCategoryByHostname(hostname, options = {}) {
  return getCategoryForHostname(hostname, options);
}

export function isProductive(hostname, options = {}) {
  return (
    getCategoryByHostname(hostname, options) ===
    WEBSITE_CATEGORIES.PRODUCTIVE
  );
}

export function isUnproductive(hostname, options = {}) {
  return (
    getCategoryByHostname(hostname, options) ===
    WEBSITE_CATEGORIES.UNPRODUCTIVE
  );
}

export function categorizeWebsite(urlOrHostname, options = {}) {
  const hostname = extractHostname(urlOrHostname);
  const details = getCategoryDetailsForHostname(hostname, options);

  return {
    input: urlOrHostname,
    hostname,
    category: details.category,
    matchedDomain: details.matchedDomain,
    source: details.source,
    isKnown: details.isKnown,
  };
}
