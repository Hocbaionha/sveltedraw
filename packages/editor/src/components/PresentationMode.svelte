<script lang="ts">
  import type { PresentationSlide } from '../presentation/types.js';
  import { getTransitionClass, formatSlideTime, getSlideProgress } from '../presentation/types.js';

  type Props = {
    slides: PresentationSlide[];
    slideSvgs?: string[];
    currentSlideIndex: number;
    isPlaying: boolean;
    showSlideNumbers: boolean;
    showNotes: boolean;
    onNextSlide: () => void;
    onPreviousSlide: () => void;
    onTogglePlayPause: () => void;
    onExit: () => void;
    onSlideJump: (index: number) => void;
  };

  let {
    slides = [],
    slideSvgs = [],
    currentSlideIndex = 0,
    isPlaying = false,
    showSlideNumbers = true,
    showNotes = true,
    onNextSlide,
    onPreviousSlide,
    onTogglePlayPause,
    onExit,
    onSlideJump,
  }: Props = $props();

  let currentSlide = $derived(slides[currentSlideIndex]);
  let currentSlideSvg = $derived(slideSvgs[currentSlideIndex] ?? "");
  let progress = $derived(getSlideProgress(currentSlideIndex, slides.length));

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      onNextSlide();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      onPreviousSlide();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      onExit();
    } else if (e.key === 'p' || e.key === 'P') {
      onTogglePlayPause();
    }
  };
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="presentation-mode">
  <!-- Main slide display -->
  <div class="pm-slide-area">
    {#if currentSlide}
      <div class="pm-slide {getTransitionClass(currentSlide.transition)}">
        <!-- Slide title strip (top) -->
        <div class="pm-slide-header">
          <div class="pm-slide-title">{currentSlide.title}</div>
          {#if showNotes && currentSlide.description}
            <div class="pm-slide-description">{currentSlide.description}</div>
          {/if}
        </div>

        <!-- Actual drawing content: pre-rendered SVG of the slide's elements -->
        <div class="pm-slide-canvas">
          {#if currentSlideSvg}
            {@html currentSlideSvg}
          {:else if currentSlide.thumbnail}
            <img src={currentSlide.thumbnail} alt={currentSlide.title} />
          {:else}
            <div class="pm-slide-empty">Empty slide</div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Navigation bar -->
  <div class="pm-navbar">
    <!-- Left controls -->
    <div class="pm-nav-left">
      <button
        class="pm-nav-btn"
        aria-label="Previous slide"
        title="Previous slide (←)"
        onclick={onPreviousSlide}
        disabled={currentSlideIndex === 0}
      >
        ❮
      </button>
      <span class="pm-slide-counter">
        {#if showSlideNumbers && slides.length > 0}
          {formatSlideTime(currentSlideIndex, slides.length)}
        {/if}
      </span>
      <button
        class="pm-nav-btn"
        aria-label="Next slide"
        title="Next slide (→ or Space)"
        onclick={onNextSlide}
        disabled={currentSlideIndex === slides.length - 1}
      >
        ❯
      </button>
    </div>

    <!-- Progress bar -->
    <div class="pm-progress">
      <div class="pm-progress-bar" style="width: {progress}%"></div>
    </div>

    <!-- Right controls -->
    <div class="pm-nav-right">
      <button
        class="pm-nav-btn pm-play-btn"
        class:playing={isPlaying}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause (P)' : 'Play (P)'}
        onclick={onTogglePlayPause}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button
        class="pm-nav-btn pm-exit-btn"
        aria-label="Exit presentation"
        title="Exit presentation (Esc)"
        onclick={onExit}
      >
        ✕
      </button>
    </div>
  </div>

  <!-- Slide navigator (bottom strip) -->
  {#if slides.length > 1}
    <div class="pm-navigator">
      {#each slides as slide, index (slide.id)}
        <button
          class="pm-nav-thumb"
          class:active={index === currentSlideIndex}
          aria-label={`Go to slide ${index + 1}`}
          onclick={() => onSlideJump(index)}
          title={slide.title}
        >
          <span class="pm-thumb-num">{index + 1}</span>
          {#if slide.thumbnail}
            <img src={slide.thumbnail} alt={slide.title} />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .presentation-mode {
    position: fixed;
    inset: 0;
    background: #000;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    color: white;
  }

  .pm-slide-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    overflow: hidden;
  }

  .pm-slide {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    padding: 24px 32px;
    gap: 16px;
    box-sizing: border-box;
  }

  .pm-slide-header {
    text-align: center;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .pm-slide-title {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    margin: 0;
  }

  .pm-slide-description {
    font-size: 14px;
    color: #ccc;
    line-height: 1.4;
    max-width: 800px;
  }

  .pm-slide-canvas {
    flex: 1;
    min-height: 0;
    background: white;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 16px;
  }

  .pm-slide-canvas :global(svg) {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
  }

  .pm-slide-canvas img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .pm-slide-empty {
    color: #888;
    font-size: 16px;
  }

  /* Transition animations */
  .pm-slide.transition-fade {
    animation: fadeIn 0.5s ease-in-out;
  }

  .pm-slide.transition-slide {
    animation: slideIn 0.5s ease-in-out;
  }

  .pm-slide.transition-zoom {
    animation: zoomIn 0.5s ease-in-out;
  }

  .pm-slide.transition-none {
    animation: none;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideIn {
    from {
      transform: translateX(100px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes zoomIn {
    from {
      transform: scale(0.9);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Navigation bar */
  .pm-navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 16px 24px;
    background: rgba(0, 0, 0, 0.8);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    height: 60px;
  }

  .pm-nav-left,
  .pm-nav-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .pm-nav-btn {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .pm-nav-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    transform: scale(1.05);
  }

  .pm-nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pm-play-btn.playing {
    background: #6965db;
    border-color: #6965db;
  }

  .pm-exit-btn:hover {
    background: #ff6b6b;
    border-color: #ff6b6b;
  }

  .pm-slide-counter {
    font-size: 14px;
    padding: 0 16px;
    color: #aaa;
    min-width: 60px;
    text-align: center;
  }

  .pm-progress {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
    cursor: pointer;
  }

  .pm-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #6965db, #7c7cff);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  /* Slide navigator thumbnails */
  .pm-navigator {
    display: flex;
    gap: 8px;
    padding: 12px 24px;
    background: rgba(0, 0, 0, 0.6);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    overflow-x: auto;
    height: 80px;
  }

  .pm-nav-thumb {
    flex-shrink: 0;
    width: 70px;
    height: 56px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #aaa;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }

  .pm-nav-thumb:hover {
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.15);
  }

  .pm-nav-thumb.active {
    border-color: #6965db;
    background: rgba(105, 101, 219, 0.2);
  }

  .pm-thumb-num {
    font-weight: 600;
    z-index: 1;
  }

  .pm-nav-thumb img {
    position: absolute;
    inset: 4px;
    width: calc(100% - 8px);
    height: calc(100% - 8px);
    object-fit: cover;
    border-radius: 2px;
    opacity: 0.7;
  }

  .pm-nav-thumb:hover img {
    opacity: 1;
  }

  /* Scrollbar styling for navigator */
  .pm-navigator::-webkit-scrollbar {
    height: 6px;
  }

  .pm-navigator::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }

  .pm-navigator::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .pm-navigator::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
</style>
