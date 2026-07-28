import { useEffect, useRef } from 'react';
import type { WeatherSceneId } from '../types/weather';

type AtmosphereCanvasProps = {
  scene: WeatherSceneId;
  isNight?: boolean;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  /** Per-particle phase so twinkle/drift cycles do not move in lockstep. */
  phase: number;
  /** Secondary size used by cloud and fog blobs. */
  spread: number;
};

type SceneConfig = {
  kind: 'rain' | 'snow' | 'stars' | 'clouds' | 'fog' | 'motes' | 'none';
  count: number;
  lightning: boolean;
  colour: string;
};

/**
 * Particle budget per scene. Counts are deliberately modest - this layer
 * sits behind readable text, so it should read as atmosphere rather than
 * weather simulation, and it should not cost a phone its battery.
 */
const sceneConfig = (scene: WeatherSceneId): SceneConfig => {
  switch (scene) {
    case 'rain':
      return { kind: 'rain', count: 110, lightning: false, colour: 'rgba(226, 244, 255, 0.42)' };
    case 'showers':
      return { kind: 'rain', count: 150, lightning: false, colour: 'rgba(226, 244, 255, 0.5)' };
    case 'storm':
      return { kind: 'rain', count: 170, lightning: true, colour: 'rgba(226, 240, 255, 0.5)' };
    case 'snow':
      return { kind: 'snow', count: 90, lightning: false, colour: 'rgba(255, 255, 255, 0.85)' };
    case 'clear-night':
      return { kind: 'stars', count: 130, lightning: false, colour: 'rgba(255, 255, 255, 0.95)' };
    case 'partly-cloudy-night':
      return { kind: 'stars', count: 70, lightning: false, colour: 'rgba(255, 255, 255, 0.7)' };
    case 'cloudy':
    case 'overcast':
    case 'partly-cloudy-day':
      return { kind: 'clouds', count: 7, lightning: false, colour: 'rgba(255, 255, 255, 0.2)' };
    case 'fog':
      return { kind: 'fog', count: 6, lightning: false, colour: 'rgba(233, 240, 244, 0.22)' };
    case 'clear-day':
      return { kind: 'motes', count: 40, lightning: false, colour: 'rgba(255, 246, 205, 0.55)' };
    case 'heat':
      return { kind: 'motes', count: 60, lightning: false, colour: 'rgba(255, 224, 160, 0.6)' };
    default:
      return { kind: 'none', count: 0, lightning: false, colour: 'transparent' };
  }
};

const random = (min: number, max: number) => min + Math.random() * (max - min);

const seedParticle = (config: SceneConfig, width: number, height: number): Particle => {
  switch (config.kind) {
    case 'rain':
      return {
        x: random(-0.15 * width, width * 1.05),
        y: random(-height, height),
        vx: random(28, 46),
        vy: random(620, 980),
        size: random(9, 22),
        alpha: random(0.25, 0.75),
        phase: 0,
        spread: 0,
      };
    case 'snow':
      return {
        x: random(0, width),
        y: random(-height, height),
        vx: random(-14, 14),
        vy: random(26, 62),
        size: random(1.2, 3.4),
        alpha: random(0.35, 0.9),
        phase: random(0, Math.PI * 2),
        spread: random(12, 34),
      };
    case 'stars':
      return {
        x: random(0, width),
        y: random(0, height * 0.82),
        vx: 0,
        vy: 0,
        size: random(0.6, 1.8),
        alpha: random(0.25, 0.95),
        phase: random(0, Math.PI * 2),
        spread: random(0.4, 1.6),
      };
    case 'clouds':
      return {
        x: random(-0.2 * width, width * 1.1),
        y: random(height * 0.02, height * 0.5),
        vx: random(4, 13),
        vy: 0,
        size: random(width * 0.16, width * 0.34),
        alpha: random(0.05, 0.16),
        phase: random(0, Math.PI * 2),
        spread: random(0.34, 0.6),
      };
    case 'fog':
      return {
        x: random(-0.3 * width, width),
        y: random(height * 0.12, height * 0.85),
        vx: random(6, 18),
        vy: 0,
        size: random(width * 0.4, width * 0.85),
        alpha: random(0.05, 0.13),
        phase: random(0, Math.PI * 2),
        spread: random(0.08, 0.16),
      };
    case 'motes':
      return {
        x: random(0, width),
        y: random(0, height),
        vx: random(-9, 9),
        vy: random(-22, -6),
        size: random(0.8, 2.6),
        alpha: random(0.12, 0.5),
        phase: random(0, Math.PI * 2),
        spread: random(10, 30),
      };
    default:
      return { x: 0, y: 0, vx: 0, vy: 0, size: 0, alpha: 0, phase: 0, spread: 0 };
  }
};

/**
 * Weather-aware particle layer behind the app chrome.
 *
 * Design constraints this respects:
 * - honours `prefers-reduced-motion`, rendering nothing so the CSS gradient
 *   stands alone;
 * - stops the animation loop entirely when the tab is hidden, so a
 *   backgrounded tab costs nothing;
 * - scales particle counts down on small viewports and caps device pixel
 *   ratio at 2, which is where the cost of a full-screen canvas actually
 *   lives on phones;
 * - draws with flat fills only - no shadows or filters, which are the
 *   expensive canvas operations.
 */
export function AtmosphereCanvas({ scene, isNight = false }: AtmosphereCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let nightStars: Particle[] = [];
    let frame = 0;
    let lastTime = performance.now();
    let lightningUntil = 0;
    let nextLightning = performance.now() + random(2600, 7200);
    let running = false;

    const config = sceneConfig(scene);

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      // Fewer particles on narrow screens; the effect still reads, and
      // phones are exactly where the cost matters.
      const density = width < 640 ? 0.3 : width < 1100 ? 0.5 : 0.7;
      const target = Math.round(config.count * density);
      particles = Array.from({ length: target }, () => seedParticle(config, width, height));
      const starCount = scene === 'clear-night' || scene === 'partly-cloudy-night' ? 0 : Math.round(85 * density);
      const starConfig: SceneConfig = { kind: 'stars', count: starCount, lightning: false, colour: 'rgba(225, 239, 255, 0.72)' };
      nightStars = isNight ? Array.from({ length: starCount }, () => seedParticle(starConfig, width, height)) : [];
    };

    const drawRain = (delta: number, now: number) => {
      context.strokeStyle = config.colour;
      context.lineWidth = 1.1;
      context.lineCap = 'round';
      context.beginPath();

      for (const particle of particles) {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;

        if (particle.y > height + 40) {
          particle.y = random(-120, -10);
          particle.x = random(-0.15 * width, width * 1.05);
        }
        if (particle.x > width + 40) particle.x = -20;

        const length = particle.size;
        context.globalAlpha = particle.alpha;
        context.moveTo(particle.x, particle.y);
        context.lineTo(particle.x - particle.vx * 0.028, particle.y - length);
      }
      context.stroke();
      context.globalAlpha = 1;

      if (!config.lightning) return;

      if (now > nextLightning) {
        lightningUntil = now + random(90, 190);
        nextLightning = now + random(3200, 9000);
      }
      if (now < lightningUntil) {
        // Two quick pulses read as a strike rather than a flat white frame.
        const intensity = now < lightningUntil - 60 ? 0.16 : 0.07;
        context.fillStyle = `rgba(255, 253, 235, ${intensity})`;
        context.fillRect(0, 0, width, height);
      }
    };

    const drawSnow = (delta: number, now: number) => {
      context.fillStyle = config.colour;
      for (const particle of particles) {
        particle.y += particle.vy * delta;
        particle.x += particle.vx * delta + Math.sin(now / 1400 + particle.phase) * particle.spread * delta;

        if (particle.y > height + 12) {
          particle.y = -12;
          particle.x = random(0, width);
        }
        if (particle.x > width + 12) particle.x = -12;
        if (particle.x < -12) particle.x = width + 12;

        context.globalAlpha = particle.alpha;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const drawStars = (_delta: number, now: number) => {
      context.fillStyle = config.colour;
      for (const particle of particles) {
        // Twinkle is a slow sine on alpha; positions stay fixed so the sky
        // does not appear to crawl.
        const twinkle = 0.55 + 0.45 * Math.sin(now / 1100 + particle.phase);
        context.globalAlpha = particle.alpha * twinkle;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * particle.spread, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const drawNightStars = (now: number) => {
      if (!nightStars.length) return;
      context.fillStyle = 'rgba(225, 239, 255, 0.72)';
      for (const star of nightStars) {
        const twinkle = 0.5 + 0.5 * Math.sin(now / 1300 + star.phase);
        context.globalAlpha = star.alpha * twinkle * (scene === 'storm' ? 0.18 : scene === 'rain' || scene === 'overcast' ? 0.35 : 0.7);
        context.beginPath();
        context.arc(star.x, star.y, star.size * star.spread, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const drawBlobs = (delta: number, now: number) => {
      for (const particle of particles) {
        particle.x += particle.vx * delta;
        if (particle.x - particle.size > width) particle.x = -particle.size;

        const drift = Math.sin(now / 5200 + particle.phase) * 10;
        const radius = particle.size;
        const gradient = context.createRadialGradient(
          particle.x,
          particle.y + drift,
          radius * 0.05,
          particle.x,
          particle.y + drift,
          radius,
        );
        gradient.addColorStop(0, config.colour);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.globalAlpha = particle.alpha;
        context.fillStyle = gradient;
        context.beginPath();
        context.ellipse(particle.x, particle.y + drift, radius, radius * particle.spread, 0, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const drawMotes = (delta: number, now: number) => {
      context.fillStyle = config.colour;
      for (const particle of particles) {
        particle.y += particle.vy * delta;
        particle.x += particle.vx * delta + Math.sin(now / 2600 + particle.phase) * particle.spread * delta;

        if (particle.y < -12) {
          particle.y = height + 12;
          particle.x = random(0, width);
        }
        if (particle.x > width + 12) particle.x = -12;
        if (particle.x < -12) particle.x = width + 12;

        context.globalAlpha = particle.alpha * (0.6 + 0.4 * Math.sin(now / 1800 + particle.phase));
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    // Frame budget. Atmospheric drift is indistinguishable at 36fps from 60,
    // and skipping ~40% of frames leaves that much more of each frame for the
    // UI animations running on top of this layer.
    const FRAME_MS = 1000 / 36;

    const render = (now: number) => {
      if (now - lastTime < FRAME_MS) {
        frame = requestAnimationFrame(render);
        return;
      }

      // Clamp delta so a backgrounded-then-restored tab does not teleport
      // every particle across the screen in one frame.
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      context.clearRect(0, 0, width, height);
      drawNightStars(now);

      switch (config.kind) {
        case 'rain':
          drawRain(delta, now);
          break;
        case 'snow':
          drawSnow(delta, now);
          break;
        case 'stars':
          drawStars(delta, now);
          break;
        case 'clouds':
        case 'fog':
          drawBlobs(delta, now);
          break;
        case 'motes':
          drawMotes(delta, now);
          break;
        default:
          break;
      }

      frame = requestAnimationFrame(render);
    };

    const start = () => {
      if (running || reduceMotion.matches || (config.kind === 'none' && !isNight)) return;
      running = true;
      lastTime = performance.now();
      frame = requestAnimationFrame(render);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const handleMotionChange = () => {
      stop();
      context.clearRect(0, 0, width, height);
      start();
    };

    resize();
    start();

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibility);
    reduceMotion.addEventListener('change', handleMotionChange);

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
      reduceMotion.removeEventListener('change', handleMotionChange);
    };
  }, [isNight, scene]);

  return <canvas ref={canvasRef} className="atmosphere-canvas" aria-hidden="true" />;
}
