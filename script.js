// Intersection Observer for scroll animations
document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optional: stop observing once it has become visible
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.fade-in-up');
    animatedElements.forEach(el => observer.observe(el));

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) 
        // Custom Chatbot Logic
(function() {
    const chatToggle = document.getElementById("chatToggle");
    const chatWindow = document.getElementById("chatWindow");
    const closeChat  = document.getElementById("closeChat");
    const chatMessages = document.getElementById("chatMessages");

    const faqs = [
        {
            q: "Are you available for freelance work?",
            a: "Yes! I am currently open to new opportunities. Feel free to reach out via the Contact section or WhatsApp me directly! 🚀"
        },
        {
            q: "What technologies do you specialize in?",
            a: "My core stack includes React, Next.js, Node.js, and crafting beautiful UIs with HTML & CSS. 💻"
        },
        {
            q: "Do you design websites as well?",
            a: "Absolutely! I have a strong background in UI/UX design and often use Figma to design before coding. 🎨"
        },
        {
            q: "What is your pricing?",
            a: "Pricing depends on the scope and features of the project. Send me a message and I'll give you a custom quote! 💰"
        },
        {
            q: "How long does a project take?",
            a: "A simple website usually takes 1–2 weeks. Larger, more complex projects can take 4–8 weeks. I'll always give you a clear timeline upfront! ⏱️"
        },
        {
            q: "How do I contact you?",
            a: "You can WhatsApp me, Ask a Question via email, or find me on GitHub — all the links are in the contact section below! 📩"
        }
    ];

    function showOptions() {
        const optionsDiv = document.createElement("div");
        optionsDiv.className = "chat-options";
        faqs.forEach((faq, index) => {
            const btn = document.createElement("button");
            btn.className = "chat-option-btn";
            btn.innerText = faq.q;
            btn.onclick = () => handleQuestionClick(index);
            optionsDiv.appendChild(btn);
        });
        chatMessages.appendChild(optionsDiv);
        scrollToBottom();
    }

    function handleQuestionClick(index) {
        const options = document.querySelector(".chat-options");
        if (options) options.remove();

        addMessage(faqs[index].q, "user-message");

        setTimeout(() => {
            addMessage(faqs[index].a, "bot-message");
            setTimeout(showOptions, 1000);
        }, 600);
    }

    function addMessage(text, className) {
        const msgDiv = document.createElement("div");
        msgDiv.className = "message " + className;
        msgDiv.innerText = text;
        chatMessages.appendChild(msgDiv);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    chatToggle.addEventListener("click", () => {
        chatWindow.classList.toggle("active");
        if (chatWindow.classList.contains("active") && !document.querySelector(".chat-options")) {
            setTimeout(showOptions, 500);
        }
    });

    closeChat.addEventListener("click", () => {
        chatWindow.classList.remove("active");
    });
})();
            navbar.style.background = 'rgba(10, 10, 15, 0.8)';
            navbar.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.03)';
            navbar.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        }
    });
});

// Typing Animation
document.addEventListener("DOMContentLoaded", function() {
    const typedTextSpan = document.querySelector(".typed-text");
    const cursorSpan = document.querySelector(".cursor");
    
    if(!typedTextSpan || !cursorSpan) return;

    const textArray = ["digital experiences", "creative designs", "web applications", "innovative solutions"];
    const typingDelay = 100;
    const erasingDelay = 50;
    const newTextDelay = 2000;
    let textArrayIndex = 0;
    let charIndex = 0;

    function type() {
        if (charIndex < textArray[textArrayIndex].length) {
            if(!cursorSpan.classList.contains("typing")) cursorSpan.classList.add("typing");
            typedTextSpan.textContent += textArray[textArrayIndex].charAt(charIndex);
            charIndex++;
            setTimeout(type, typingDelay);
        } else {
            cursorSpan.classList.remove("typing");
            setTimeout(erase, newTextDelay);
        }
    }

    function erase() {
        if (charIndex > 0) {
            if(!cursorSpan.classList.contains("typing")) cursorSpan.classList.add("typing");
            typedTextSpan.textContent = textArray[textArrayIndex].substring(0, charIndex-1);
            charIndex--;
            setTimeout(erase, erasingDelay);
        } else {
            cursorSpan.classList.remove("typing");
            textArrayIndex++;
            if(textArrayIndex >= textArray.length) textArrayIndex = 0;
            setTimeout(type, typingDelay + 1100);
        }
    }

    if(textArray.length) setTimeout(type, newTextDelay + 250);
});
