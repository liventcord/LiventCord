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

    // Listen for the language change event and update the DOM
    window.addEventListener("languageChanged", updateDOM);
});

function updateDOM() {
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((element) => {
        const key = element.getAttribute("data-i18n");
        element.textContent = getTranslation(key);
        if (element.tagName === "A") {
            element.innerHTML = getTranslation(key);
        }
    });
}

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
        input.setCustomValidity(''); // Clear custom validity messages on input
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
