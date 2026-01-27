import { forumCategories, forumToneStyles } from "../data/appData";

const getForumCategory = (value) => {
  if (!value) {
    return forumCategories[0];
  }
  const match = forumCategories.find(
    (category) => category.label.toLowerCase() === value.toLowerCase()
  );
  return match || { label: value, tone: "slate", icon: "solar:tag-linear" };
};

const getForumToneStyles = (tone) =>
  forumToneStyles[tone] || forumToneStyles.slate;

export { getForumCategory, getForumToneStyles };
