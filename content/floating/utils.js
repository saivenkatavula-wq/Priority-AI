export const truncateText = (value, maxLength = 280) => {
  if (!value) {
    return '';
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
};

export const rectanglesIntersect = (rectA, rectB) => {
  if (!rectA || !rectB) {
    return false;
  }
  return !(
    rectA.right <= rectB.left ||
    rectA.left >= rectB.right ||
    rectA.bottom <= rectB.top ||
    rectA.top >= rectB.bottom
  );
};
