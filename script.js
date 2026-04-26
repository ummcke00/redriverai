// Visitor Logging — ping n8n on every page load
(function() {
    try {
        fetch('https://automatemybuisness.oph.st/webhook/redriverai-visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                page: window.location.pathname,
                referrer: document.referrer || 'direct',
                userAgent: navigator.userAgent,
                language: navigator.language,
                screenWidth: window.screen.width
            })
        }).catch(() => {}); // silent fail — never interrupts the site
    } catch(e) {}
})();

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

// Form Handling
const auditForm = document.getElementById('auditForm');
const formMessage = document.getElementById('formMessage');

auditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form data
    const formData = new FormData(auditForm);
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        business: formData.get('businessName'),
        timeWaster: formData.get('timeWaster'),
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