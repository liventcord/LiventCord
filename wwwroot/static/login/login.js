import { setLanguage, getTranslation, validateEmail, validatePassword, alertUser } from "/static/login/loginutils.js";

document.addEventListener("DOMContentLoaded", () => {
    const browserLanguage = navigator.language || navigator.userLanguage;
    const languageToSet = browserLanguage.startsWith("tr") ? "tr" : "en";

    setLanguage(languageToSet);
    updateDOM();

    const emailInput = document.querySelector('input[name="email"]');
    const passwordInput = document.querySelector('input[name="pass"]');

    emailInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            passwordInput.focus();
        }
    });

    passwordInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            submitForm(event);
        }
    });

    document.querySelector("form").addEventListener("submit", submitForm);

    window.addEventListener("languageChanged", updateDOM);

    const wallpaper = document.getElementById('video-background');
    if (wallpaper) {
      const width = window.innerWidth;

      console.log("Window Width: " + width);  

      if (width > 1280) {
        wallpaper.src = "https://motionbgs.com/media/492/nier-automata.3840x2160.mp4";
        console.log("4K video loaded");
      } else {
        wallpaper.src = "https://motionbgs.com/media/492/nier-automata.1920x1080.mp4"; 
        console.log("Full HD video loaded");
      }
    }
});

function updateDOM() {
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((element) => {
        const key = element.getAttribute("data-i18n");
        const translation = getTranslation(key);

        if (element.tagName === "A") {
            element.textContent = translation;
        } else if (element.tagName === "P") {

            const textNode = element.childNodes[0];
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                textNode.textContent = translation;
            }
        } else {
            element.textContent = translation;
        }
    });
}

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
        input.setCustomValidity(''); 
    });
});

function submitForm(event) {
    event.preventDefault();

    const emailInput = document.querySelector('input[name="email"]');
    const passwordInput = document.querySelector('input[name="pass"]');
    const emailValue = emailInput.value;
    const passwordValue = passwordInput.value;

    emailInput.setCustomValidity('');
    passwordInput.setCustomValidity('');

    if (!validateEmail(emailValue)) {
        emailInput.setCustomValidity(getTranslation("emailInvalid"));
        emailInput.reportValidity();
        return;
    }

    if (!validatePassword(passwordValue)) {
        passwordInput.setCustomValidity(getTranslation("passwordInvalid"));
        passwordInput.reportValidity();
        return;
    }

    const formData = new FormData();
    formData.append("email", emailValue);
    formData.append("password", passwordValue);

    fetch("/auth/login", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
    })
        .then((response) => {
            if (response.ok) {
                return response.json();
            } else if (response.status === 401) {
                alertUser(getTranslation("unauthorized"));
                throw new Error("Unauthorized");
            } else {
                alertUser(`${getTranslation("errorOccurred")}${response.status}`);
                throw new Error("Error occurred");
            }
        })
        .then(() => {
            window.location.href = "/app";
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}
