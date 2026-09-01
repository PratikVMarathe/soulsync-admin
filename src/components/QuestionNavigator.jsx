import { useEffect, useRef, useState, useCallback } from 'react';
import AdminIcon from './AdminIcon';
import { isQuestionComplete } from '../utils/quizManagement';

function hasQuestionError(fieldErrors = {}, index) {
  return Boolean(
    fieldErrors[`question-${index}-text`]
    || fieldErrors[`question-${index}-options`]
    || fieldErrors[`question-${index}-correctIndex`]
    || fieldErrors[`question-${index}-time`]
  );
}

export default function QuestionNavigator({
  currentIndex = 0,
  fieldErrors = {},
  onSelectQuestion,
  questions = [],
  variant = 'auto', // 'desktop' | 'horizontal' | 'auto'
}) {
  const scrollContainerRef = useRef(null);
  const activeItemRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll boundary state for horizontal navigator
  const updateScrollButtons = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = scrollContainerRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);

    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [questions.length, updateScrollButtons]);

  // Smoothly scroll active item into view whenever currentIndex changes
  useEffect(() => {
    if (typeof activeItemRef.current?.scrollIntoView === 'function') {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
    updateScrollButtons();
  }, [currentIndex, updateScrollButtons]);

  const handleScrollBy = (offset) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    if (typeof el.scrollBy === 'function') {
      el.scrollBy({
        behavior: 'smooth',
        left: offset,
      });
    } else {
      el.scrollLeft += offset;
    }
  };

  const handleKeyDown = (event, index) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (index < questions.length - 1) {
        onSelectQuestion?.(index + 1);
      }
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (index > 0) {
        onSelectQuestion?.(index - 1);
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      onSelectQuestion?.(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      onSelectQuestion?.(questions.length - 1);
    }
  };

  if (!questions.length) {
    return null;
  }

  const isHorizontal = variant === 'horizontal' || variant === 'auto';
  const isDesktop = variant === 'desktop' || variant === 'auto';

  const renderNavItems = (isHorizontalView) => (
    questions.map((question, index) => {
      const isActive = index === currentIndex;
      const hasError = hasQuestionError(fieldErrors, index);
      const isComplete = !hasError && isQuestionComplete(question);

      let statusBadge = null;
      let statusClass = 'is-incomplete';

      if (hasError) {
        statusClass = 'has-error';
        statusBadge = <span className="admin-question-nav-indicator is-error" title="Validation Error">!</span>;
      } else if (isComplete) {
        statusClass = 'is-complete';
        statusBadge = <span className="admin-question-nav-indicator is-complete" title="Completed">✓</span>;
      } else if (isActive) {
        statusClass = 'is-active';
        statusBadge = <span className="admin-question-nav-indicator is-active" title="Editing">●</span>;
      }

      return (
        <button
          aria-current={isActive ? 'true' : undefined}
          aria-label={`Question ${index + 1}${isComplete ? ', complete' : ''}${hasError ? ', has errors' : ''}${isActive ? ', active' : ''}`}
          className={`admin-question-nav-btn ${statusClass} ${isActive ? 'is-selected' : ''}`}
          key={question.id || `q-${index}`}
          onClick={() => onSelectQuestion?.(index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          ref={isActive ? (isHorizontalView ? activeItemRef : null) : null}
          type="button"
        >
          <span className="admin-question-nav-label">Q{index + 1}</span>
          {statusBadge}
        </button>
      );
    })
  );

  return (
    <>
      {/* Desktop Vertical Navigator */}
      {isDesktop ? (
        <aside
          aria-label="Question Navigator"
          className="admin-question-navigator-desktop"
        >
          <div className="admin-question-navigator-desktop-header">
            <span className="admin-question-navigator-desktop-title">Questions</span>
            <span className="admin-badge">{questions.length}</span>
          </div>
          <div className="admin-question-navigator-desktop-list">
            {renderNavItems(false)}
          </div>
        </aside>
      ) : null}

      {/* Tablet / Mobile Horizontal Navigator */}
      {isHorizontal ? (
        <nav
          aria-label="Horizontal Question Navigator"
          className="admin-question-navigator-horizontal"
        >
          <button
            aria-label="Scroll questions left"
            className="admin-question-scroll-btn is-left"
            disabled={!canScrollLeft}
            onClick={() => handleScrollBy(-200)}
            tabIndex={-1}
            type="button"
          >
            <AdminIcon name="arrowLeft" size={16} />
          </button>

          <div
            className="admin-question-horizontal-track"
            ref={scrollContainerRef}
          >
            {renderNavItems(true)}
          </div>

          <button
            aria-label="Scroll questions right"
            className="admin-question-scroll-btn is-right"
            disabled={!canScrollRight}
            onClick={() => handleScrollBy(200)}
            tabIndex={-1}
            type="button"
          >
            <AdminIcon name="chevron" size={16} />
          </button>
        </nav>
      ) : null}
    </>
  );
}
