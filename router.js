/**
 * Job Notification Tracker
 * Hash-based router — works everywhere (file://, any server)
 */

const ROUTES = ['home', 'dashboard', 'saved', 'digest', 'settings', 'proof', 'jt-07-test', 'jt-08-ship', 'jt-proof'];

function getRoute() {
  const hash = window.location.hash.slice(1).replace(/^\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  if (parts[0] === 'jt' && parts[1]) {
    const sub = parts[1];
    if (sub === '07-test') return 'jt-07-test';
    if (sub === '08-ship') return 'jt-08-ship';
    if (sub === 'proof') return 'jt-proof';
  }
  const path = parts[0] || 'home';
  return ROUTES.includes(path) ? path : 'home';
}

function navigate(route) {
  const hash = route === 'home' ? '#' : `#/${route}`;
  window.location.hash = hash;
  render(getRoute());
}

function render(route) {
  const pageId = route === 'jt-proof' ? 'page-proof' : `page-${route}`;
  document.querySelectorAll('.jnt-page').forEach((el) => {
    el.classList.toggle('active', el.id === pageId);
  });
  document.querySelectorAll('.jnt-nav-link').forEach((link) => {
    const linkRoute = link.dataset.route;
    link.classList.toggle('active', linkRoute === route || (route === 'jt-proof' && linkRoute === 'proof'));
  });
}

function init() {
  render(getRoute());

  window.addEventListener('hashchange', () => {
    render(getRoute());
  });

  document.querySelectorAll('.jnt-nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      const route = link.dataset.route;
      if (route) {
        e.preventDefault();
        navigate(route);
      }
    });
  });

  document.querySelector('.jnt-logo')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('home');
  });

  const hamburger = document.getElementById('hamburger');
  const nav = document.querySelector('.jnt-nav');

  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      const expanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', !expanded);
      nav.classList.toggle('jnt-mobile-menu-open', !expanded);
    });

    nav.querySelectorAll('.jnt-nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        hamburger.setAttribute('aria-expanded', 'false');
        nav.classList.remove('jnt-mobile-menu-open');
      });
    });
  }
}

init();
