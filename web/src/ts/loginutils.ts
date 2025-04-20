import { getId } from "./utils";

//loginutils.js
let currentLanguage = "en";

const loginTranslations = {
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
} as any;
function updateDOM() {
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((element) => {
    const key = element.getAttribute("data-i18n") as string;
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
function setLanguage(language:string) {
  currentLanguage = language;
  const languageChangeEvent = new CustomEvent("languageChanged");
  window.dispatchEvent(languageChangeEvent);
}
export function initialiseLoginPage(isRegister:boolean) {
  const browserLanguage = navigator.language || navigator.language;
  const languageToSet = browserLanguage.startsWith("tr") ? "tr" : "en";

  setLanguage(languageToSet);
  updateDOM();
  const loginForm = getId("login-form");
  if(!loginForm) return;
  loginForm .addEventListener("submit", (event:SubmitEvent) => submitForm(event, isRegister));

  window.addEventListener("languageChanged", updateDOM);

  const wallpaper = document.getElementById("video-background") as HTMLImageElement
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

function getTranslation(key:string) {
  return loginTranslations[currentLanguage][key] || key;
}

function alertUser(text:string, isSuccess = false) {
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
function submitForm(event:SubmitEvent, isRegister:boolean) {
  event.preventDefault();

  const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement
  const passwordInput = document.querySelector('input[name="pass"]') as HTMLInputElement
  const nickInput = document.querySelector('input[name="nick"]') as HTMLInputElement
  const emailValue = emailInput.value;
  const passwordValue = passwordInput.value;
  let nickValue
  if (isRegister) {
    nickValue = nickInput.value;
  }

  const setInputValidity = (input:HTMLInputElement, message:string) => {
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
    setInputValidity(nickInput, getTranslation("nickInvalid"));
    return;
  }

  let data = {
    email: emailValue,
    password: passwordValue
  } as any;

  if (isRegister) {
    data.nickname = nickValue;
  }

  const base = import.meta.env.VITE_BACKEND_URL

  fetch(isRegister ? base + "/auth/register" : base + "/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", 
      "Accept": "application/json"
    },
    body: JSON.stringify(data),
    credentials: "include" 
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


function validateEmail(email:string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password:string) {
  return password && password.length >= 5;
}

function validateNick(value?:string) {
  if(!value) return false;
  const nick = value.trim();
  return nick.length >= 1 && nick.length <= 32;
}

