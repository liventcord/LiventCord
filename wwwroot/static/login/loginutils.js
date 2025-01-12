//loginutils.js
let currentLanguage = "en";

const translations = {
    en: {
        emailInvalid: "Please enter a valid email address.",
        passwordInvalid: "Password must be at least 5 characters long.",
        unauthorized: "Invalid email or password!",
        errorOccurred: "An error occurred! ",
        loginTitle: "Login",
        emailLabel: "Enter your email",
        passwordLabel: "Enter your password",
        forgotPassword: "Forgot password?",
        registerPrompt: "Don't have an account?",
        registerLink: "Register",
        loginButton: "Log In",
    },
    tr: {
        emailInvalid: "Geçerli bir e-posta adresi girin.",
        passwordInvalid: "Şifre en az 5 karakter uzunluğunda olmalıdır.",
        unauthorized: "E-posta veya şifre geçersiz!",
        errorOccurred: "Bir hata oluştu! ",
        loginTitle: "Giriş Yap",
        emailLabel: "E-posta adresinizi girin",
        passwordLabel: "Şifrenizi girin",
        forgotPassword: "Şifrenizi mi unuttunuz?",
        registerPrompt: "Hesabınız yok mu?",
        registerLink: "Kayıt ol",
        loginButton: "Giriş Yap",
    },
};

export function setLanguage(language) {
    currentLanguage = language;

    const languageChangeEvent = new CustomEvent("languageChanged");
    window.dispatchEvent(languageChangeEvent);
}

export function getTranslation(key) {
    return translations[currentLanguage][key] || key;
}


export function alertUser(text, isSuccess = false) {
    const container = document.createElement("div");
    container.classList.add(isSuccess ? "info-container" : "error-container", "swipe-in");

    setTimeout(() => {
        container.classList.remove("swipe-in");
    }, 3000);

    const messageDiv = document.createElement("div");
    messageDiv.id = "info-message";
    messageDiv.textContent = text;

    container.appendChild(messageDiv);
    document.body.prepend(container);

    setTimeout(() => {
        container.remove();
    }, 5000);
}

export function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
    console.log(password,password.length ,password.length >= 5);
    return password && password.length >= 5;
}

window.setLanguage = setLanguage;
