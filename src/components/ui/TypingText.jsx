import { useEffect, useState } from "react";

export default function TypingText({ text, className = "", speed = 80, delay = 300 }) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    if (!text) {
      setDisplayedText("");
      return;
    }

    setDisplayedText("");
    setIsTyping(true);
    setShowCursor(true);

    const startTimeout = setTimeout(() => {
      let currentIndex = 0;

      const typingInterval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(typingInterval);
          setIsTyping(false);
          setTimeout(() => setShowCursor(false), 2000);
        }
      }, speed);

      return () => clearInterval(typingInterval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, delay]);

  if (!text) return null;

  return (
    <span className={`font-cursive ${className}`}>
      {displayedText}
      <span
        className={`inline-block w-[2px] h-[0.9em] ml-1 align-middle transition-opacity duration-300 ${
          showCursor ? "bg-violet-400/80 animate-pulse" : "opacity-0"
        }`}
        style={{ animation: showCursor ? "blink-caret 0.75s step-end infinite" : "none" }}
      />
    </span>
  );
}
