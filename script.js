// Visitor Logging — ping n8n on every page load (with consent)
// This sends visitor data after user gives consent to our Privacy Policy in compliance with PIPEDA.
function initializeVisitorLogging() {
    (function() {
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
        } catch(e) {}
    })();
};

// Initialize tracking based on consent status after everything is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        const consentGiven = localStorage.getItem('cookieConsent') === 'true';
        if (consentGiven) {
            initializeVisitorLogging();
        }
    });
} else {
    const consentGiven = localStorage.getItem('cookieConsent') === 'true';
    if (consentGiven) {
        initializeVisitorLogging();
    }
}

// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking a link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Smooth Scroll Navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Show/hide "Other" text input
const timeWasterRadios = document.querySelectorAll('input[name="timeWaster"]');
const otherInput = document.getElementById('otherTimeWaster');

timeWasterRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        otherInput.style.display = radio.value === 'Other' ? 'block' : 'none';
        if (radio.value !== 'Other') otherInput.value = '';
    });
});

// Form Handling
const auditForm = document.getElementById('auditForm');
const formMessage = document.getElementById('formMessage');

auditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form data
    const formData = new FormData(auditForm);
    let timeWaster = formData.get('timeWaster');
    if (timeWaster === 'Other' && formData.get('otherTimeWaster').trim()) {
        timeWaster = formData.get('otherTimeWaster').trim();
    }
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        business: formData.get('businessName'),
        timeWaster: timeWaster,
        timestamp: new Date().toISOString()
    };
    
    // Disable submit button and show loading state
    const submitButton = auditForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
    
    try {
        // Send to webhook
        const response = await fetch('https://automatemybuisness.oph.st/webhook/ai-audit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer d869f45e4a6c6399b0a033f013d67d17aeee91cc95308c2143f3955c7e605511'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            // Show success message
            formMessage.className = 'form-message success';
            formMessage.textContent = 'Thank you! Your AI audit will be sent to your email within 24 hours.';
            
            // Reset form
            auditForm.reset();
            
            // Scroll to message
            formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            throw new Error('Failed to submit form');
        }
    } catch (error) {
        // Show error message
        formMessage.className = 'form-message error';
        formMessage.textContent = 'Something went wrong. Please try again or email us directly at hello@redriverai.ca';
        console.error('Form submission error:', error);
    } finally {
        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
});

// Add scroll effect to navbar
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.05)';
    }
    
    lastScroll = currentScroll;
});

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all service cards and pricing cards
document.querySelectorAll('.service-card, .pricing-card, .testimonial-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});