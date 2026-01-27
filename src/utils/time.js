const formatRelativeTime = (value) => {
  if (!value) {
    return "Just now";
  }
  const diffMs = Date.now() - value.getTime();
  if (diffMs < 0) {
    return "Just now";
  }
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) {
    return "Just now";
  }
  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute);
    return `${minutes}m ago`;
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffMs / day);
  if (days < 7) {
    return `${days}d ago`;
  }
  return value.toLocaleDateString();
};

export { formatRelativeTime };
