const imageStyles = document.createElement('link');
imageStyles.rel = 'stylesheet';
imageStyles.href = 'image-overrides.css';
document.head.appendChild(imageStyles);

const heroEyebrow = document.querySelector('.hero .eyebrow');
const heroSubtitle = document.querySelector('.hero-subtitle');
const heroLead = document.querySelector('.hero-lead');

if (heroEyebrow) heroEyebrow.textContent = 'KI UND MENSCH. ZUSAMMEN. ETHISCH.';
if (heroSubtitle) heroSubtitle.textContent = 'Bessere Entscheidungen entstehen in Zusammenarbeit zwischen KI und Mensch.';
if (heroLead) {
  heroLead.textContent = 'Reason Engine verbindet Klarheit mit Kontext, strukturiert Komplexität und schafft Werkzeuge für verantwortungsvolle Zusammenarbeit.';
}

const header = document.querySelector('[data-header]');
const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');

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
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });

  revealItems.forEach((item) => observer.observe(item));
}
