/* =========================================================
   Red River AI — minimal JS
   Tab switching · mobile nav · smooth scroll
   ========================================================= */

/* ---------------------------------------------------------
   Services tab switching
   --------------------------------------------------------- */
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById('tab-' + tab.dataset.tab);
        if (panel) panel.classList.add('active');
    });
});

/* ---------------------------------------------------------
   Mobile Navigation Toggle
   --------------------------------------------------------- */
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
        const open = hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
        });
    });
}

/* ---------------------------------------------------------
   Smooth Scroll Navigation
   --------------------------------------------------------- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || href.length < 2) return;
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
    });
});

/* ---------------------------------------------------------
   Conversion tracking
   One place for every "money" action, so GA4 can answer
   "did the site produce a lead?" instead of guessing.
   --------------------------------------------------------- */
function track(name, params) {
    if (typeof gtag === 'function') {
        gtag('event', name, Object.assign({ transport_type: 'beacon' }, params || {}));
    }
}
window.rrTrack = track;

/* Bookings: every Calendly link, anywhere */
document.querySelectorAll('a[href*="calendly.com"]').forEach(link => {
    link.addEventListener('click', () => track('book_call_click', { link_url: link.href }));
});

/* Email clicks */
document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
    link.addEventListener('click', () => track('email_click', { link_url: link.getAttribute('href') }));
});

/* Pricing in view = buying signal */
const pricingEl = document.getElementById('pricing');
if (pricingEl && 'IntersectionObserver' in window) {
    let seen = false;
    new IntersectionObserver((entries) => {
        entries.forEach(en => {
            if (en.isIntersecting && !seen) { seen = true; track('view_pricing'); }
        });
    }, { threshold: 0.4 }).observe(pricingEl);
}

/* ---------------------------------------------------------
   Newsletter signup
   Was action="mailto:" — silently dead in every modern
   browser. Now posts to n8n, origin-gated.
   --------------------------------------------------------- */
const nlForm = document.getElementById('newsletter-form');
if (nlForm) {
    nlForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('newsletter-email');
        const msg = document.getElementById('newsletter-msg');
        const btn = nlForm.querySelector('button[type="submit"]');
        if (!email || !email.value) return;

        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Signing up...';

        try {
            const res = await fetch('https://automatemybuisness.oph.st/webhook/newsletter-signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.value, source: 'footer' })
            });
            if (!res.ok) throw new Error('bad status ' + res.status);

            nlForm.style.display = 'none';
            if (msg) {
                msg.textContent = 'Thanks - you are on the list.';
                msg.style.display = 'block';
                msg.style.color = '#7dd3a0';
            }
            track('newsletter_signup');
        } catch (err) {
            btn.disabled = false;
            btn.textContent = original;
            if (msg) {
                msg.textContent = 'That did not go through. Try again in a moment.';
                msg.style.display = 'block';
                msg.style.color = '#ff9a9a';
            }
        }
    });
}
