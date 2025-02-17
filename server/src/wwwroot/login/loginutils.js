//loginutils.js
let currentLanguage = "en";

const translations = {
  en: {
    emailInvalid: "Please enter a valid email address.",
    passwordInvalid: "Password must be at least 5 characters long.",
    unauthorized: "Invalid email or password!",
    errorOccurred: "An error occurred! ",
    login: "Login",
    register: "Register",
    emailLabel: "Enter your email",
    passwordLabel: "Enter your password",
    nickLabel: "Enter your nickname",
    forgotPassword: "Forgot password?",
    registerPrompt: "Need an account?",
    loginPrompt: "Already have an account?",
    emailExists: "Email is already registered",
    maxNickReached:
      "This nickname has exceeded the maximum number of available discriminators.",
    successRegister: "Succesfully registered!"
  },
  tr: {
    emailInvalid: "Geçerli bir e-posta adresi girin.",
    passwordInvalid: "Şifre en az 5 karakter uzunluğunda olmalıdır.",
    unauthorized: "E-posta veya şifre geçersiz!",
    errorOccurred: "Bir hata oluştu! ",
    login: "Giriş Yap",
    register: "Kayıt ol",
    emailLabel: "E-posta adresinizi girin",
    passwordLabel: "Şifrenizi girin",
    nickLabel: "Kullanıcı adınızı girin",
    forgotPassword: "Şifrenizi mi unuttunuz?",
    registerPrompt: "Hesabınız yok mu?",
    loginPrompt: "Zaten hesabın var mı?",
    maxNickReached:
      "Bu takma ad, mevcut tanımlayıcı sayısının maksimum sınırını aşmış durumda",
    emailExists: "Bu e posta adresi zaten kayıtlı",
    successRegister: "Başarıyla kayıt olundu!"
  }
};
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
function setLanguage(language) {
  currentLanguage = language;
  const languageChangeEvent = new CustomEvent("languageChanged");
  window.dispatchEvent(languageChangeEvent);
}
export function initialisePage(isRegister) {
  const browserLanguage = navigator.language || navigator.userLanguage;
  const languageToSet = browserLanguage.startsWith("tr") ? "tr" : "en";

  setLanguage(languageToSet);
  updateDOM();

  document
    .querySelector("form")
    .addEventListener("submit", (event) => submitForm(event, isRegister));

  window.addEventListener("languageChanged", updateDOM);

  const wallpaper = document.getElementById("video-background");
  if (wallpaper) {
    const width = window.innerWidth;

    console.log("Window Width: " + width);

    if (width > 1280) {
      wallpaper.src =
        "https://motionbgs.com/media/492/nier-automata.3840x2160.mp4";
      console.log("4K video loaded");
    } else {
      wallpaper.src =
        "https://motionbgs.com/media/492/nier-automata.1920x1080.mp4";
      console.log("Full HD video loaded");
    }
  }
}

function getTranslation(key) {
  return translations[currentLanguage][key] || key;
}

function alertUser(text, isSuccess = false) {
  const container = document.createElement("div");
  container.classList.add(
    isSuccess ? "info-container" : "error-container",
    "swipe-in"
  );

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

function submitForm(event, isRegister) {
  event.preventDefault();

  const emailInput = document.querySelector('input[name="email"]');
  const passwordInput = document.querySelector('input[name="pass"]');
  const nickInput = document.querySelector('input[name="nick"]');
  const emailValue = emailInput.value;
  const passwordValue = passwordInput.value;
  let nickValue;
  if (isRegister) {
    nickValue = nickInput.value;
  }

  const setInputValidity = (input, message) => {
    input.setCustomValidity(message);
    input.reportValidity();
  };

  emailInput.setCustomValidity("");
  passwordInput.setCustomValidity("");
  if (isRegister) nickInput.setCustomValidity("");

  if (!validateEmail(emailValue)) {
    setInputValidity(emailInput, getTranslation("emailInvalid"));
    return;
  }

  if (!validatePassword(passwordValue)) {
    setInputValidity(passwordInput, getTranslation("passwordInvalid"));
    return;
  }

  if (isRegister && !validateNick(nickValue)) {
    setInputValidity(nickValue, getTranslation("nickInvalid"));
    return;
  }

  const formData = new FormData();
  formData.append("email", emailValue);
  formData.append("password", passwordValue);
  if (isRegister) formData.append("nickname", nickValue);

  fetch(isRegister ? "/auth/register" : "/auth/login", {
    method: "POST",
    body: formData
  })
    .then((response) => {
      if (!response.ok) {
        let errorMsg = "";
        if (response.status === 401) {
          errorMsg = getTranslation("unauthorized");
        } else if (isRegister && response.status === 409) {
          errorMsg = getTranslation("emailExists");
        } else if (isRegister && response.status === 400) {
          errorMsg = getTranslation("maxNickReached");
        } else {
          errorMsg = `${getTranslation("errorOccurred")} ${response.status}`;
        }
        alertUser(errorMsg);
        throw new Error(
          response.status === 401 ? "Unauthorized" : "Error occurred"
        );
      }
    })
    .then(() => {
      if (isRegister) {
        alertUser(getTranslation("successRegister"), true);
        setTimeout(() => {
          window.location.href = "/app";
        }, 5000);
      } else {
        window.location.href = "/app";
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
window.submitForm = submitForm;

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return password && password.length >= 5;
}

function validateNick(value) {
  const nick = value.trim();
  return nick.length >= 1 && nick.length <= 32;
}

window.setLanguage = setLanguage;
