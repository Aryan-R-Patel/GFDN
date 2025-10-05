import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";

const formatNumber = value => value?.toLocaleString?.() ?? value ?? 0;

const SCROLL_SPEED = 1; // pixels per frame
const IDLE_TIMEOUT = 3000; // 3 seconds before auto-scroll resumes

export default function DashboardMetrics({ metrics }) {
  const containerRef = useRef(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Auto-scroll animation
  const animate = () => {
    const container = containerRef.current;
    if (!container || isUserScrolling) return;

    if (container.scrollLeft >= container.scrollWidth - container.clientWidth) {
      container.scrollLeft = 0;
    } else {
      container.scrollLeft += SCROLL_SPEED;
    }
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Handle user interaction
  const handleInteraction = () => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, IDLE_TIMEOUT);
  };

  // Set up and clean up auto-scroll
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isUserScrolling]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mouseenter", handleInteraction);
    container.addEventListener("mousemove", handleInteraction);
    container.addEventListener("wheel", handleInteraction);
    container.addEventListener("touchstart", handleInteraction);

    return () => {
      container.removeEventListener("mouseenter", handleInteraction);
      container.removeEventListener("mousemove", handleInteraction);
      container.removeEventListener("wheel", handleInteraction);
      container.removeEventListener("touchstart", handleInteraction);
    };
  }, []);
  if (!metrics) {
    return (
      <div className="metrics">
        <div className="metrics__item">
          <small>Total processed</small>
          <strong>—</strong>
        </div>
        <div className="metrics__item">
          <small>Blocked</small>
          <strong>—</strong>
        </div>
        <div className="metrics__item">
          <small>Latency</small>
          <strong>—</strong>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`metrics ${isUserScrolling ? "metrics--user-scrolling" : ""}`}
      style={{
        overflowX: "scroll",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        className="metrics__container"
        style={{ display: "inline-flex", whiteSpace: "nowrap", gap: "8px" }}
      >
        <div className="metrics__item">
          <small>Total processed</small>
          <strong>{formatNumber(metrics.totals.processed)}</strong>
        </div>
        <div className="metrics__item">
          <small>Blocked</small>
          <strong>{formatNumber(metrics.totals.blocked)}</strong>
        </div>
        <div className="metrics__item">
          <small>Flagged</small>
          <strong>{formatNumber(metrics.totals.flagged)}</strong>
        </div>
        <div className="metrics__item">
          <small>Estimated savings</small>
          <strong>${formatNumber(metrics.estimatedSavings)}</strong>
        </div>
        <div className="metrics__item">
          <small>Avg latency</small>
          <strong>{formatNumber(metrics.latency.averageMs)} ms</strong>
        </div>
        <div className="metrics__item">
          <small>Avg risk score</small>
          <strong>{formatNumber(metrics.risk.averageScore)}</strong>
        </div>
        <div className="metrics__item">
          <small>Updated</small>
          <strong>{dayjs().format("HH:mm:ss")}</strong>
        </div>
      </div>
    </div>
  );
}
