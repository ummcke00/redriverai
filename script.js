/* =========================================================
   Red River AI — Prairie Cyber Noir
   Terminal animation · visitor logging · form handling ·
   mobile nav · smooth scroll · reveal-on-scroll · progress bars
   ========================================================= */

/* ---------------------------------------------------------
   Visitor Logging — ping n8n on every page load (with consent).
   Sends visitor data after user gives consent to our Privacy
   Policy, in compliance with PIPEDA.
   --------------------------------------------------------- */
function initializeVisitorLogging() {
    (function () {
        try {
            fetch('https://automatemybuisness.oph.st/webhook/redriverai-visit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer d869f45e4a6c6399b0a033f013d67d17aeee91cc95308c2143f3955c7e605511'
                },
                body: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    page: window.location.pathname,
                    referrer: document.referrer || 'direct',
                    language: navigator.language,
                    screenWidth: window.screen.width
                    // userAgent removed — strong fingerprinting vector, GA already captures this
                })
            }).catch(() => {}); // silent fail — never interrupts the site
        } catch (e) {}
    })();
}

// Initialize tracking based on consent status after everything is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        if (localStorage.getItem('cookieConsent') === 'true') initializeVisitorLogging();
    });
} else {
    if (localStorage.getItem('cookieConsent') === 'true') initializeVisitorLogging();
}

/* ---------------------------------------------------------
   Terminal typing animation
   --------------------------------------------------------- */
(function terminalAnimation() {
    const body = document.getElementById('terminal-body');
    if (!body) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Each step: a command (prompt + cmd + flag) and its output line.
    const steps = [
        { cmd: 'identify', flag: '--bottleneck', out: '✓ Bottleneck found: manual invoicing (12h/week)' },
        { cmd: 'deploy',   flag: '--automation', out: '✓ Workflow deployed · n8n + Stripe + email' },
        { cmd: 'monitor',  flag: '--uptime',     out: '✓ System running · 99.9% uptime · 0 errors' }
    ];

    const SPEED = 30; // ms per character

    // If user prefers reduced motion, render the final state immediately.
    if (reduceMotion) {
        body.innerHTML = steps.map(s =>
            `<div class="term-line"><span class="term-prompt">~$</span> <span class="term-cmd">${s.cmd}</span> <span class="term-flag">${s.flag}</span></div>` +
            `<div class="term-line term-out">${s.out}</div>`
        ).join('') + '<span class="term-cursor"></span>';
        return;
    }

    let stepIndex = 0;

    function typeText(el, text, cb) {
        let i = 0;
        const timer = setInterval(() => {
            el.textContent += text.charAt(i);
            i++;
            if (i >= text.length) {
                clearInterval(timer);
                cb && cb();
            }
        }, SPEED);
    }

    function runStep() {
        if (stepIndex >= steps.length) {
            const cursor = document.createElement('span');
            cursor.className = 'term-cursor';
            body.appendChild(cursor);
            return;
        }
        const step = steps[stepIndex];

        // Command line: prompt + typed command + typed flag
        const cmdLine = document.createElement('div');
        cmdLine.className = 'term-line';
        const promptSpan = document.createElement('span');
        promptSpan.className = 'term-prompt';
        promptSpan.textContent = '~$ ';
        const cmdSpan = document.createElement('span');
        cmdSpan.className = 'term-cmd';
        const flagSpan = document.createElement('span');
        flagSpan.className = 'term-flag';
        cmdLine.appendChild(promptSpan);
        cmdLine.appendChild(cmdSpan);
        cmdLine.appendChild(document.createTextNode(' '));
        cmdLine.appendChild(flagSpan);
        body.appendChild(cmdLine);

        typeText(cmdSpan, step.cmd, () => {
            typeText(flagSpan, step.flag, () => {
                // Output line types out after a short beat
                const outLine = document.createElement('div');
                outLine.className = 'term-line term-out';
                body.appendChild(outLine);
                setTimeout(() => {
                    typeText(outLine, step.out, () => {
                        stepIndex++;
                        setTimeout(runStep, 450);
                    });
                }, 220);
            });
        });
    }

    // Start typing after a short delay on page load
    setTimeout(runStep, 700);
})();

/* ---------------------------------------------------------
   Mobile Navigation Toggle (slide-in drawer)
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
   Audit form: show/hide "Other" input
   --------------------------------------------------------- */
const timeWasterRadios = document.querySelectorAll('input[name="timeWaster"]');
const otherInput = document.getElementById('otherTimeWaster');

if (otherInput) {
    timeWasterRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            otherInput.style.display = radio.value === 'Other' ? 'block' : 'none';
            if (radio.value !== 'Other') otherInput.value = '';
        });
    });
}

/* ---------------------------------------------------------
   Audit form submit → webhook
   --------------------------------------------------------- */
const auditForm = document.getElementById('auditForm');
const formMessage = document.getElementById('formMessage');

if (auditForm) {
    auditForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(auditForm);
        let timeWaster = formData.get('timeWaster');
        if (timeWaster === 'Other' && formData.get('otherTimeWaster') && formData.get('otherTimeWaster').trim()) {
            timeWaster = formData.get('otherTimeWaster').trim();
        }
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            business: formData.get('businessName'),
            timeWaster: timeWaster,
            timestamp: new Date().toISOString()
        };

        const submitButton = auditForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';

        try {
            const response = await fetch('https://automatemybuisness.oph.st/webhook/ai-audit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer d869f45e4a6c6399b0a033f013d67d17aeee91cc95308c2143f3955c7e605511'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                formMessage.className = 'form-message success';
                formMessage.textContent = 'Thank you! Your AI audit will be sent to your email within 24 hours.';
                auditForm.reset();
                if (otherInput) otherInput.style.display = 'none';
                formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                throw new Error('Failed to submit form');
            }
        } catch (error) {
            formMessage.className = 'form-message error';
            formMessage.textContent = 'Something went wrong. Please try again or email us directly at hello@redriverai.ca';
            console.error('Form submission error:', error);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
}

/* ---------------------------------------------------------
   Navbar shadow on scroll
   --------------------------------------------------------- */
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    if (!navbar) return;
    if (window.pageYOffset > 60) {
        navbar.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.5)';
    } else {
        navbar.style.boxShadow = 'none';
    }
});

/* ---------------------------------------------------------
   Reveal-on-scroll + animated progress bars
   (IntersectionObserver)
   --------------------------------------------------------- */
const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Fire any progress bars inside this element
            entry.target.querySelectorAll('.progress-bar').forEach(bar => bar.classList.add('fill'));
            obs.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// Standalone progress bars (in case any aren't wrapped in a .reveal)
const barObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fill');
            obs.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

document.querySelectorAll('.progress-bar').forEach(bar => barObserver.observe(bar));
