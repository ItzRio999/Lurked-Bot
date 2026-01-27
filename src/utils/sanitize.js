import DOMPurify from 'dompurify';

/**
 * Sanitizes user-generated content to prevent XSS attacks
 * @param {string} dirty - The potentially unsafe HTML string
 * @returns {string} - The sanitized HTML string safe for rendering
 */
export const sanitizeHTML = (dirty) => {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  // Configure DOMPurify to be strict
  const config = {
    ALLOWED_TAGS: [], // No HTML tags allowed - plain text only
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // Keep the text content
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  };

  return DOMPurify.sanitize(dirty, config);
};

/**
 * Sanitizes and converts newlines to <br> for display
 * Useful for preserving line breaks in user content
 * @param {string} dirty - The potentially unsafe string
 * @returns {string} - The sanitized string with preserved line breaks
 */
export const sanitizeWithLineBreaks = (dirty) => {
  const clean = sanitizeHTML(dirty);
  return clean.replace(/\n/g, '<br>');
};
