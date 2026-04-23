// Presentation Mode System for Phase 16 Feature 3

export type TransitionEffect = 'fade' | 'slide' | 'zoom' | 'none';

export interface PresentationSlide {
  id: string;
  index: number;
  title: string;
  description?: string;
  elements: any[]; // Serialized Excalidraw elements
  thumbnail?: string;
  duration: number; // ms, 0 = manual advance
  transition: TransitionEffect;
}

export interface PresentationConfig {
  autoPlay: boolean;
  autoAdvanceDuration: number; // ms between slides
  loopOnEnd: boolean;
  showNotes: boolean;
  showSlideNumbers: boolean;
  transition: TransitionEffect;
  fullscreenOnStart: boolean;
}

export interface PresentationState {
  isActive: boolean;
  currentSlideIndex: number;
  isPlaying: boolean;
  totalSlides: number;
}

export const getDefaultPresentationConfig = (): PresentationConfig => ({
  autoPlay: false,
  autoAdvanceDuration: 5000,
  loopOnEnd: false,
  showNotes: true,
  showSlideNumbers: true,
  transition: 'fade',
  fullscreenOnStart: true,
});

export const createPresentationSlide = (
  title: string,
  elements: any[],
  index: number,
  description?: string,
  thumbnail?: string,
): PresentationSlide => ({
  id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  index,
  title: title.trim() || `Slide ${index + 1}`,
  description,
  elements,
  thumbnail,
  duration: 0,
  transition: 'fade',
});

export const getTransitionClass = (effect: TransitionEffect): string => {
  const classes: Record<TransitionEffect, string> = {
    fade: 'transition-fade',
    slide: 'transition-slide',
    zoom: 'transition-zoom',
    none: 'transition-none',
  };
  return classes[effect] || 'transition-fade';
};

export const formatSlideTime = (index: number, total: number): string => {
  return `${index + 1} / ${total}`;
};

export const estimatePresentationDuration = (slides: PresentationSlide[]): number => {
  return slides.reduce((sum, slide) => sum + (slide.duration || 0), 0);
};

export const getSlideProgress = (current: number, total: number): number => {
  return total === 0 ? 0 : (current / total) * 100;
};
