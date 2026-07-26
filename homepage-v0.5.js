const header = document.querySelector('[data-header]');
const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');

// The HTML points directly to the verified repository assets.
// Only fall back when the intended image genuinely fails to load.
const imageFallbacks = [
  {
    selector: '.hero-image',
    fallback: 'assets/workshop-people.webp',
  },
  {
    selector: '.manifest-image img',
    fallback: 'assets/city-map.svg',
  },
];

imageFallbacks.forEach(({ selector, fallback }) => {
  const image = document.querySelector(selector);
  if (!image) return;

  image.addEventListener('error', () => {
    if (!image.src.endsWith(fallback)) image.src = fallback;
  }, { once: true });
});

const updateHeader = () => {
  if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);
};

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = document.querySelectorAll('.reveal');

if (reduceMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -38px' });

  revealItems.forEach((item) => observer.observe(item));
}
