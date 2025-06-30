import { apiClient } from "./api";
import { initialiseApp } from "./app";
import { router } from "./router";
import { translations } from "./translations";
import { alertUser } from "./ui";
import { createEl, getId } from "./utils";

let currentLanguage = "en";
const loginTranslations = {
  en: {
    emailInvalid: "Please enter a valid email address.",
    passwordInvalid: "Password must be at least 5 characters long.",
    nickInvalid: "Nickname must be between 1 and 32 characters.",
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
    nickInvalid: "Kullanıcı adı 1 ile 32 karakter arasında olmalıdır.",
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

interface LoginResponse {
  token: string;
}
let areListenersAdded = false;

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

function setLanguage(language: string) {
  currentLanguage = language;
  const languageChangeEvent = new CustomEvent("languageChanged");
  window.dispatchEvent(languageChangeEvent);
}

export function initialiseLoginPage() {
  const languageToSet = navigator.language.startsWith("tr") ? "tr" : "en";
  setLanguage(languageToSet);
  updateDOM();

  if (areListenersAdded) {
    return;
  }
  areListenersAdded = true;

  initializeGoogleOauth();

  const addInputValidationListeners = (
    emailInput: HTMLInputElement,
    passInput: HTMLInputElement
  ) => {
    emailInput.addEventListener("input", () =>
      emailInput.setCustomValidity("")
    );
    passInput.addEventListener("input", () => passInput.setCustomValidity(""));

    emailInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        passInput.focus();
      }
    });

    passInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitForm(emailInput.closest("form")!, false);
      }
    });
  };

  const setupForm = (form: HTMLFormElement, isRegister: boolean) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(form, isRegister);
    });
  };

  const loginForm = getId("login-form") as HTMLFormElement | null;
  if (loginForm) {
    setupForm(loginForm, false);

    const loginEmailInput = loginForm.querySelector('input[name="email"]');
    const loginPassInput = loginForm.querySelector('input[name="pass"]');

    if (loginEmailInput && loginPassInput) {
      addInputValidationListeners(loginEmailInput, loginPassInput);
    }
  }

  const registerForm = getId("register-form") as HTMLFormElement | null;
  if (registerForm) {
    setupForm(registerForm, true);
    setRegisterInputListeners(registerForm);
  }

  window.addEventListener("languageChanged", updateDOM);

  const wallpaper = document.getElementById(
    "video-background"
  ) as HTMLVideoElement | null;
  if (wallpaper) {
    wallpaper.src =
      window.innerWidth > 1280
        ? "https://motionbgs.com/media/492/nier-automata.3840x2160.mp4"
        : "https://motionbgs.com/media/492/nier-automata.1920x1080.mp4";
  }

  const addClickListener = (id: string, handler: (e: Event) => void) => {
    const element = getId(id);
    if (element) {
      element.addEventListener("click", handler);
    }
  };

  addClickListener("register-link", (e) => {
    e.preventDefault();
    router.switchToRegister();
  });

  addClickListener("login-link", (e) => {
    e.preventDefault();
    router.switchToLogin();
  });

  addClickListener("en-button", () => setLanguage("en"));
  addClickListener("tr-button", () => setLanguage("tr"));
}

function getTranslation(key: string) {
  return loginTranslations[currentLanguage][key] || key;
}

function alertUserLogin(text: string, isSuccess = false) {
  const container = createEl("div", {
    className: isSuccess ? "info-container" : "error-container"
  });

  const messageDiv = createEl("div", { id: "info-message", textContent: text });

  container.appendChild(messageDiv);
  document.body.appendChild(container);

  setTimeout(() => {
    container.remove();
  }, 4500);
}

function isLoginResponse(data: any): data is LoginResponse {
  return data && typeof data.token === "string";
}

function setAuthToken(token: string) {
  apiClient.setAuthToken(token);
  router.closeLogin();
  initialiseApp();
}

function handleCredentialResponse(response: any) {
  const idToken = response.credential;

  apiClient
    .fetchRelative(
      "/auth/google-login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ idToken })
      },
      true
    )
    .then(async (res) => {
      const data = await res.json();
      if (res.ok && data.token) {
        setAuthToken(data.token);
      } else if (data.errorCode) {
        switch (data.errorCode) {
          case "EMAIL_EXISTS_WITH_PASSWORD":
            alertUser(
              translations.getErrorMessage("LOGIN_ERROR_TITLE"),
              translations.getErrorMessage("EMAIL_EXISTS_WITH_PASSWORD")
            );
            break;
          case "GOOGLE_AUTH_FAILED":
            alertUser(
              translations.getErrorMessage("LOGIN_ERROR_TITLE"),
              translations.getErrorMessage("GOOGLE_AUTH_FAILED")
            );
            break;
          default:
            alertUser(
              translations.getErrorMessage("LOGIN_ERROR_TITLE"),
              translations.getErrorMessage("UNKNOWN_LOGIN_ERROR")
            );
        }
      } else {
        alertUser(
          translations.getErrorMessage("LOGIN_ERROR_TITLE"),
          translations.getErrorMessage("LOGIN_FAILED")
        );
      }
    })
    .catch((error) => {
      console.error(error);
      alertUser(
        translations.getErrorMessage("LOGIN_ERROR_TITLE"),
        translations.getErrorMessage("UNKNOWN_LINK_ERROR")
      );
    });
}
function handleGoogleLinkResponse(response: any) {
  const idToken = response.credential;
  const password = prompt(
    "Enter your current password to link your Google account:"
  );
  if (!password) {
    alert("Password is required to link your Google account.");
    return;
  }
  apiClient
    .fetchRelative(
      "/auth/google-link",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, password })
      },
      true
    )
    .then(async (res) => {
      if (res.ok) {
        alert("Google account linked successfully!");
        return;
      }

      let data = {} as any;
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (data.errorCode) {
        switch (data.errorCode) {
          case "INVALID_PASSWORD":
            alert("Incorrect password. Google account not linked.");
            break;
          case "EMAIL_MISMATCH":
            alert(
              "The Google account email does not match your registered email."
            );
            break;
          case "INVALID_GOOGLE_TOKEN":
            alert("Google authentication failed. Please try again.");
            break;
          case "GOOGLE_LINK_FAILED":
            alert("Failed to link Google account due to server error.");
            break;
          default:
            alert("Failed to link Google account due to an unknown error.");
        }
      } else {
        alert("Failed to link Google account. No error details received.");
      }
    })

    .catch((e) => {
      alert(e);
    });
}

const windowAny = window as any;
windowAny.handleCredentialResponse = handleCredentialResponse;
windowAny.handleGoogleLinkResponse = handleGoogleLinkResponse;
export function initializeGoogleOauth(isLink: boolean = false) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (clientId) {
    const script = createEl("script", {
      src: "https://accounts.google.com/gsi/client",
      async: true,
      defer: true
    });
    document.head.appendChild(script);
    const wrapper = getId(
      isLink ? "google-link-wrapper" : "google-signin-wrapper"
    );
    if (!wrapper) {
      return;
    }

    wrapper.innerHTML = `
      <div id="g_id_onload"
          data-client_id="${clientId}"
          data-context="signin"
          data-ux_mode="popup"
          data-callback="handleCredentialResponse">
      </div>

      <div class="g_id_signin"
          data-type="standard"
          data-shape="rectangular"
          data-theme="outline"
          data-text="sign_in_with"
          data-size="large"
          data-logo_alignment="left">
      </div>
    `;
  }
}

function submitForm(form: HTMLElement, isRegister: boolean) {
  const emailInput = form.querySelector(
    'input[name="email"]'
  ) as HTMLInputElement;
  const passwordInput = form.querySelector(
    'input[name="pass"]'
  ) as HTMLInputElement;
  let nickInput: HTMLInputElement | null = null;

  if (!emailInput || !passwordInput) {
    console.error("Required form inputs not found");
    return;
  }

  const emailValue = emailInput.value;
  const passwordValue = passwordInput.value;
  let nickValue = "";

  if (isRegister) {
    nickInput = form.querySelector('input[name="nick"]') as HTMLInputElement;
    if (nickInput) {
      nickValue = nickInput.value;
    }
  }

  const setInputValidity = (input: HTMLInputElement, message: string) => {
    input.setCustomValidity(message);
    input.reportValidity();
  };

  emailInput.setCustomValidity("");
  passwordInput.setCustomValidity("");
  if (nickInput) {
    nickInput.setCustomValidity("");
  }

  if (!validateEmail(emailValue)) {
    setInputValidity(emailInput, getTranslation("emailInvalid"));
    return;
  }

  if (!validatePassword(passwordValue)) {
    setInputValidity(passwordInput, getTranslation("passwordInvalid"));
    return;
  }

  if (isRegister && nickInput && !validateNick(nickValue)) {
    setInputValidity(nickInput, getTranslation("nickInvalid"));
    return;
  }

  const data = { email: emailValue, password: passwordValue } as any;

  if (isRegister && nickValue) {
    data.nickname = nickValue;
  }

  apiClient
    .fetchRelative(
      isRegister ? "/auth/register" : "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      },
      true
    )
    .then(async (response) => {
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
        alertUserLogin(errorMsg);
        throw new Error(
          response.status === 401 ? "Unauthorized" : "Error occurred"
        );
      }

      let responseData: LoginResponse | {} = {};
      if (!isRegister) {
        responseData = await response.json();

        if (isLoginResponse(responseData)) {
          apiClient.setAuthToken(responseData.token);
        } else {
          throw new Error("Invalid response data");
        }
      }

      if (isRegister) {
        alertUserLogin(getTranslation("successRegister"), true);
        setTimeout(() => {
          router.openLogin();
        }, 5000);
      } else {
        router.closeLogin();
        initialiseApp();
      }

      return responseData;
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

let isFetching = false;
let debounceTimer = 0;
let currentInputValue = "";

function setRegisterInputListeners(registerForm: HTMLElement) {
  if (!registerForm) {
    return;
  }

  const emailInput = registerForm.querySelector(
    'input[name="email"]'
  ) as HTMLInputElement;
  const nickInput = registerForm.querySelector(
    'input[name="nick"]'
  ) as HTMLInputElement;
  const passInput = registerForm.querySelector(
    'input[name="pass"]'
  ) as HTMLInputElement;

  if (!emailInput || !nickInput || !passInput) {
    return;
  }

  emailInput.addEventListener("input", () => {
    emailInput.setCustomValidity("");
  });

  nickInput.addEventListener("input", () => {
    nickInput.setCustomValidity("");

    const newInputValue = nickInput.value.trim();

    if (newInputValue && newInputValue !== currentInputValue && !isFetching) {
      currentInputValue = newInputValue;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          isFetching = true;
          const response = await apiClient.fetchRelative(
            "/api/discriminators?nick=" + encodeURIComponent(newInputValue),
            undefined,
            true
          );

          if (response.ok) {
            const data = await response.json();
            if (
              data.discriminator &&
              newInputValue === nickInput.value.trim()
            ) {
              const discriminatorText = getId(
                "discriminatorText"
              ) as HTMLElement;
              if (discriminatorText) {
                discriminatorText.textContent = "#" + data.discriminator;
              }
            }
          } else {
            throw new Error("Network response was not ok.");
          }
        } catch (error) {
          console.error("Fetch Error:", error);
        } finally {
          isFetching = false;
        }
      }, 500);
    }
  });

  passInput.addEventListener("input", () => {
    passInput.setCustomValidity("");
  });

  emailInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      nickInput.focus();
    }
  });

  nickInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      passInput.focus();
    }
  });

  passInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitForm(registerForm, true);
    }
  });
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string) {
  return password && password.length >= 5;
}

function validateNick(value?: string) {
  if (!value) {
    return false;
  }
  const nick = value.trim();
  return nick.length >= 1 && nick.length <= 32;
}
