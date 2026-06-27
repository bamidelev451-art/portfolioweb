document.addEventListener('DOMContentLoaded', () => {

    // =============================================
    // 1. SCROLL ANIMATIONS (Intersection Observer)
    // =============================================
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.12
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));

    // =============================================
    // 2. NAVBAR SCROLL EFFECT
    // =============================================
    const navbar = document.querySelector('#navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // =============================================
    // 3. TYPED TEXT ANIMATION
    // =============================================
    const typedTarget = document.querySelector('.typed-text');
    const words = ['Experiences', 'Interfaces', 'Solutions', 'Products'];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    const typingSpeed   = 120;
    const deletingSpeed = 70;
    const pauseTime     = 1800;

    function type() {
        const currentWord = words[wordIndex];

        if (isDeleting) {
            typedTarget.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
        } else {
            typedTarget.textContent = currentWord.substring(0, charIndex + 1);
            charIndex++;
        }

        let delay = isDeleting ? deletingSpeed : typingSpeed;

        if (!isDeleting && charIndex === currentWord.length) {
            delay = pauseTime;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            delay = 400;
        }

        setTimeout(type, delay);
    }

    type();

    // =============================================
    // 4. HAMBURGER MENU
    // =============================================
    const hamburger = document.querySelector('#hamburger');
    const navLinks  = document.querySelector('#navLinks');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        navLinks.classList.toggle('open');
    });

    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('open');
            navLinks.classList.remove('open');
        });
    });

    // =============================================
    // 5. FOOTER YEAR
    // =============================================
    const yearEl = document.querySelector('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // =============================================
    // 6. CHATBOT
    // =============================================
    const chatToggle   = document.getElementById('chatToggle');
    const chatWindow   = document.getElementById('chatWindow');
    const closeChat    = document.getElementById('closeChat');
    const chatMessages = document.getElementById('chatMessages');
    const chatOptions  = document.getElementById('chatOptions');

    const faqs = [
        {
            q: 'Are you available for freelance work?',
            a: "Yes! I'm currently open to new opportunities. Feel free to reach out via the Contact section or WhatsApp me directly! 🚀"
        },
        {
            q: 'What technologies do you specialize in?',
            a: 'My core stack includes React, Next.js, Node.js, and crafting beautiful UIs with HTML & CSS. 💻'
        },
        {
            q: 'Do you design websites as well?',
            a: 'Absolutely! I have a strong background in UI/UX design and often use Figma to design before coding. 🎨'
        },
        {
            q: 'What is your pricing?',
            a: "Pricing depends on the scope and features of the project. Send me a message in the Contact section and we'll discuss! 💼"
        },
        {
            q: 'How long does a project take?',
            a: 'It varies by complexity. A landing page might take 3–5 days, while a full web app can take several weeks. 📅'
        }
    ];

    let chatOpen = false;

    function addMessage(text, type) {
        const msg = document.createElement('div');
        msg.classList.add('message', type);
        msg.textContent = text;
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showOptions() {
        chatOptions.innerHTML = '';
        faqs.forEach((faq, i) => {
            const btn = document.createElement('button');
            btn.classList.add('chat-option-btn');
            btn.textContent = faq.q;
            btn.id = `chatOption${i}`;
            btn.addEventListener('click', () => {
                addMessage(faq.q, 'user-message');
                chatOptions.innerHTML = '';
                setTimeout(() => {
                    addMessage(faq.a, 'bot-message');
                    setTimeout(showOptions, 500);
                }, 600);
            });
            chatOptions.appendChild(btn);
        });
    }

    function openChat() {
        chatOpen = true;
        chatWindow.classList.add('active');
        chatToggle.textContent = '✕';
        if (chatMessages.children.length === 0) {
            setTimeout(() => {
                addMessage("👋 Hi! I'm Victor's virtual assistant. What would you like to know?", 'bot-message');
                setTimeout(showOptions, 600);
            }, 300);
        }
    }

    function closeWindow() {
        chatOpen = false;
        chatWindow.classList.remove('active');
        chatToggle.textContent = '💬';
    }

    chatToggle.addEventListener('click', () => {
        if (chatOpen) closeWindow();
        else openChat();
    });

    closeChat.addEventListener('click', closeWindow);

});

// =============================================
// 7. CONTACT FORM HANDLER
// =============================================
function handleFormSubmit(e) {
    e.preventDefault();
    const btn     = document.getElementById('submitBtn');
    const success = document.getElementById('formSuccess');

    btn.textContent = 'Sending...';
    btn.disabled    = true;

    // Simulate a send (replace with your actual email service, e.g. EmailJS or Formspree)
    setTimeout(() => {
        btn.textContent = 'Send Message ✉️';
        btn.disabled    = false;
        success.classList.add('show');
        document.getElementById('contactForm').reset();
        setTimeout(() => success.classList.remove('show'), 5000);
    }, 1500);
}
