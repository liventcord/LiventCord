
import { initialisePage} from "/login/loginutils.js";

let isFetching = false;
let debounceTimer;
let currentInputValue = '';

initialisePage(true);

function setInputListeners() {
    var emailInput = document.querySelector('input[name="email"]');
    var nickInput = document.querySelector('input[name="nick"]');
    var passInput = document.querySelector('input[name="pass"]');
    emailInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            nickInput.focus();
        }
    });


    nickInput.addEventListener("input", async function (event) {
        const newInputValue = nickInput.value.trim();

        if (newInputValue && newInputValue !== currentInputValue && !isFetching) {
            currentInputValue = newInputValue;

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                try {
                    isFetching = true;
                    const response = await fetch(`/api/discriminators?nick=${encodeURIComponent(currentInputValue)}`, {
                        method: 'GET',
                        credentials: 'same-origin'
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.result && currentInputValue === nickInput.value.trim()) {
                            document.getElementById('discriminatorText').textContent = "#"+ data.result;
                        }
                    } else {
                        throw new Error('Network response was not ok.');
                    }
                } catch (error) {
                    console.error('Fetch Error:', error);
                } finally {
                    isFetching = false;
                }
            }, 500);
        }
    });

    nickInput.addEventListener("keypress", async function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            passInput.focus();
        }
    });

    passInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            submitForm(event);
        }
    });

}
setInputListeners()