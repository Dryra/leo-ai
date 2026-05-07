import { useEffect, useState } from "react";
import { useHintStore } from "../../stores/hintStore";
import "./hint-section.scss";

export function HintSection() {
  const hint = useHintStore((state) => state.hint);
  const showNextHint = useHintStore((state) => state.showNextHint);
  const [displayedHint, setDisplayedHint] = useState(hint);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = window.setInterval(showNextHint, 10000);

    return () => window.clearInterval(interval);
  }, [showNextHint]);

  useEffect(() => {
    if (hint === displayedHint) return;

    setIsVisible(false);

    const timeout = window.setTimeout(() => {
      setDisplayedHint(hint);
      setIsVisible(true);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [hint, displayedHint]);

  if (!displayedHint) return null;

  return (
    <section className="hintSection" aria-live="polite">
      <span className="hintSectionIcon" aria-hidden="true" />
      <span
        className={
          isVisible ? "hintSectionText isVisible" : "hintSectionText isHidden"
        }
      >
        {displayedHint}
      </span>
    </section>
  );
}
