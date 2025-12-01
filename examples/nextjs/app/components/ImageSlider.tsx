'use client';

import Image from 'next/image';
import React, { useState, useRef } from 'react';

interface ImageSliderProps {
  images: string[];
  alt: string;
}

type SlideMode =
  | 'idle'
  | 'dragging'
  | 'animating-prev'
  | 'animating-next'
  | 'preparing-jump'
  | 'animating-jump';

export function ImageSlider({ images, alt }: ImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<SlideMode>('idle');
  const [jumpTarget, setJumpTarget] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) return null;

  const getContainerWidth = () => containerRef.current?.offsetWidth || 300;

  const prevIndex = (currentIndex - 1 + images.length) % images.length;
  const nextIndex = (currentIndex + 1) % images.length;

  const isAnimating = mode !== 'idle' && mode !== 'dragging';

  // Trigger jump animation after preparing-jump renders at current position
  if (mode === 'preparing-jump') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMode('animating-jump');
      });
    });
  }

  const goToPrevious = () => {
    if (isAnimating) return;
    setMode('animating-prev');
  };

  const goToNext = () => {
    if (isAnimating) return;
    setMode('animating-next');
  };

  const goToSlide = (index: number) => {
    if (index === currentIndex || isAnimating) return;

    // For adjacent slides, use the looping animation
    if (index === nextIndex) {
      goToNext();
      return;
    }
    if (index === prevIndex) {
      goToPrevious();
      return;
    }

    // For non-adjacent, use jump animation
    // First set target, then trigger animation on next frame
    setJumpTarget(index);
    setMode('preparing-jump');
  };

  const handleTransitionEnd = () => {
    if (mode === 'animating-prev') {
      setCurrentIndex(prevIndex);
      setMode('idle');
    } else if (mode === 'animating-next') {
      setCurrentIndex(nextIndex);
      setMode('idle');
    } else if (mode === 'animating-jump' && jumpTarget !== null) {
      setCurrentIndex(jumpTarget);
      setJumpTarget(null);
      setMode('idle');
    }
  };

  const handleDragStart = (clientX: number) => {
    if (isAnimating) return;
    setMode('dragging');
    startX.current = clientX;
  };

  const handleDragMove = (clientX: number) => {
    if (mode !== 'dragging') return;
    const diff = clientX - startX.current;
    setDragOffset(diff);
  };

  const handleDragEnd = () => {
    if (mode !== 'dragging') return;

    const threshold = 50;
    const currentDragOffset = dragOffset;
    setDragOffset(0);

    if (currentDragOffset < -threshold) {
      setMode('animating-next');
    } else if (currentDragOffset > threshold) {
      setMode('animating-prev');
    } else {
      setMode('idle');
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  const handleMouseLeave = () => {
    if (mode === 'dragging') {
      handleDragEnd();
    }
  };

  // For prev/next: use 3-slide window (enables infinite loop)
  // For jump: use all slides
  const useThreeSlideMode =
    mode !== 'animating-jump' && mode !== 'preparing-jump';

  // Calculate transform for 3-slide mode
  const getThreeSlideTransform = () => {
    const containerWidth = getContainerWidth();
    const dragPercent = (dragOffset / containerWidth) * 33.333;

    if (mode === 'animating-prev') return 0;
    if (mode === 'animating-next') return -66.666;
    return -33.333 + dragPercent;
  };

  // Calculate transform for jump mode (all slides)
  const getJumpTransform = () => {
    const slideWidth = 100 / images.length;
    // During preparing-jump, stay at current position
    if (mode === 'preparing-jump') {
      return -(currentIndex * slideWidth);
    }
    // During animating-jump, go to target
    if (jumpTarget !== null) {
      return -(jumpTarget * slideWidth);
    }
    return -(currentIndex * slideWidth);
  };

  // Calculate jump animation duration
  const getJumpDuration = () => {
    if (jumpTarget === null) return 0.3;
    const distance = Math.abs(jumpTarget - currentIndex);
    return Math.min(0.15 + 0.08 * distance, 0.5);
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 cursor-grab active:cursor-grabbing select-none touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {useThreeSlideMode ? (
          // 3-slide mode for prev/next (infinite loop)
          <div
            className="absolute inset-0 flex"
            style={{
              width: '300%',
              transform: `translateX(${getThreeSlideTransform()}%)`,
              transition:
                mode === 'dragging' || mode === 'idle'
                  ? 'none'
                  : 'transform 0.3s ease-out',
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            <div
              className="relative shrink-0"
              style={{ width: '33.333%', height: '100%' }}
            >
              <Image
                src={images[prevIndex]!}
                alt={`${alt} - image ${prevIndex + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover pointer-events-none"
                draggable={false}
              />
            </div>
            <div
              className="relative shrink-0"
              style={{ width: '33.333%', height: '100%' }}
            >
              <Image
                src={images[currentIndex]!}
                alt={`${alt} - image ${currentIndex + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover pointer-events-none"
                draggable={false}
              />
            </div>
            <div
              className="relative shrink-0"
              style={{ width: '33.333%', height: '100%' }}
            >
              <Image
                src={images[nextIndex]!}
                alt={`${alt} - image ${nextIndex + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover pointer-events-none"
                draggable={false}
              />
            </div>
          </div>
        ) : (
          // All-slides mode for jumping to non-adjacent
          <div
            className="absolute inset-0 flex"
            style={{
              width: `${images.length * 100}%`,
              transform: `translateX(${getJumpTransform()}%)`,
              transition:
                mode === 'animating-jump'
                  ? `transform ${getJumpDuration()}s ease-out`
                  : 'none',
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {images.map((img, idx) => (
              <div
                key={idx}
                className="relative shrink-0"
                style={{ width: `${100 / images.length}%`, height: '100%' }}
              >
                <Image
                  src={img}
                  alt={`${alt} - image ${idx + 1}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover pointer-events-none"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        )}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors cursor-pointer"
              aria-label="Previous image"
            >
              <span className="text-xl">&lsaquo;</span>
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors cursor-pointer"
              aria-label="Next image"
            >
              <span className="text-xl">&rsaquo;</span>
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`w-16 h-16 rounded overflow-hidden border-2 transition-colors cursor-pointer ${
                idx === currentIndex
                  ? 'border-blue-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <Image
                src={img}
                alt={`${alt} thumbnail ${idx + 1}`}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
