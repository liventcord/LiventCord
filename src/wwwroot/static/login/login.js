import { initialisePage} from "/static/login/loginutils.js";



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

initialisePage(false);






document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
        input.setCustomValidity(''); 
    });
});

