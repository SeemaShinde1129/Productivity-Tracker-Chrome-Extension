const SVG_ATTRIBUTES = Object.freeze({
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

function renderIconNode(iconNode) {
  return iconNode.map(([tagName, attrs, children], index) => {
    const TagName = tagName;

    return (
      <TagName key={`${tagName}-${index}`} {...attrs}>
        {children ? renderIconNode(children) : null}
      </TagName>
    );
  });
}

function LucideIcon({
  className = '',
  icon,
  label,
  size = 16,
  strokeWidth = 2,
}) {
  return (
    <svg
      {...SVG_ATTRIBUTES}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className}
      height={size}
      role={label ? 'img' : undefined}
      strokeWidth={strokeWidth}
      width={size}
    >
      {renderIconNode(icon)}
    </svg>
  );
}

export default LucideIcon;
