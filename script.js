const API_URL = "https://brownie-beater.onrender.com"

function toggleLoading(show, message = "Working on it...") {
    const overlay = document.getElementById('loading-overlay'); 
    const text = document.getElementById('loading-text'); 

    if (show) {
        text.textContent = message; 
        overlay.style.display = 'flex'; 
    } else {
        overlay.style.display = 'none'; 
    }
}

function showForm(formId) {
    const forms = document.querySelectorAll(".form-box"); 
    forms.forEach(form => form.classList.remove("active"));

    const targetForm = document.getElementById(formId); 
    if (targetForm) {
        targetForm.classList.add("active"); 
    } else {
        console.warn("Could not find form with ID:", formId); 
    }
}

function togglePassword(inputId, iconElement) {
    const passwordBox = document.getElementById(inputId); 
    if (passwordBox.type === "password") {
        passwordBox.type = "text"; 
        iconElement.classList.replace("fa-eye", "fa-eye-slash"); 
    } else {
        passwordBox.type = 'password'; 
        iconElement.classList.replace("fa-eye-slash", "fa-eye"); 
    }
}

// --- PASSWORD VALIDATION ---
function updateStatus(requirementId, checkPasses) {
    const requirementRow = document.getElementById(requirementId); 
    const theIcon = requirementRow.querySelector('i');
    const currentPassword = document.getElementById('password').value; 

    if (currentPassword.length > 0 && checkPasses) {
        requirementRow.style.color = "#2ecc71"; // Green
        theIcon.className = "fa-solid fa-circle-check"; 
    } else {
        requirementRow.style.color = "#ff6b6b"; // Red
        theIcon.className = "fa-solid fa-circle-xmark"; 
    }
}

document.getElementById('password').addEventListener('input', function() {
    const val = this.value; 
    updateStatus('req-number', /[0-9]/.test(val)); 
    updateStatus('req-upper', /[A-Z]/.test(val)); 
    updateStatus('req-special', /[!@#$%^&*(),.?":{}|<>]/.test(val)); 
}); 

document.getElementById('confirm_password').addEventListener('input', function() {
    const pass1 = document.getElementById('password').value; 
    const errorDisplay = document.getElementById('error-message'); 

    if (this.value !== pass1 && this.value.length > 0) { 
        errorDisplay.textContent = "Passwords do not match!"; 
    } else {
        errorDisplay.textContent = ""; 
    }
}); 

// --- REGISTER ---
document.querySelector('#register-form form').addEventListener('submit', function(event) {
    event.preventDefault(); 

    const email = this.email.value; 
    const password = document.getElementById('password').value; 
    const username = this.name.value; 
    const confirmPass = document.getElementById('confirm_password').value; 
    const errorBox = document.getElementById('error-message'); 

    const isValid = /[0-9]/.test(password) && /[A-Z]/.test(password) && /[!@#$%^&*(),.?{}|<>]/.test(password);

    if (!isValid) {
        errorBox.textContent = "Error: Password is not complicated enough!";
        return; 
    }

    if (password !== confirmPass) {
        errorBox.textContent = "Error: Passwords do not match!"; 
        return; 
    }

    toggleLoading(true, "Baking your account..."); 

    fetch(`${API_URL}/api/register`, {
        method: 'POST', 
        headers: { 'Content-Type' : 'application/json' }, 
        body: JSON.stringify({ username, email, password })
    })
    .then(res => {
        toggleLoading(false); 
        if (res.ok) {
            alert("Registration successful!");
            showForm('login-form'); 
        } else {
            errorBox.textContent = "Registration failed. Try again."; 
        }
    })
    .catch(() => {
        toggleLoading(false); 
        errorBox.textContent = "Cannot connect to server."; 
    }); 
});

// --- LOGIN ---
document.querySelector('#login-form form').addEventListener('submit', function(event) {
    event.preventDefault(); 
    toggleLoading(true, "Verifying credentials..."); 

    const username = this.username.value; 
    const password = document.getElementById('login_password').value; 

    fetch(`${API_URL}/api/login`, {
        method: 'POST', 
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        toggleLoading(false); 
        if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', username); 
            window.location.href = 'lobby.html';
        } else {
            alert("Login failed: " + (data.message || "Invalid credentials")); 
        }
    })
    .catch(() => { 
        toggleLoading(false); 
        alert("Server is currently down."); 
    }); 
}); 

// --- NEW: FORGOT PASSWORD (STEP 1: REQUEST CODE) ---
document.getElementById('request-otp-form').addEventListener('submit', function(event) {
    event.preventDefault();

    const email = this.resetEmail.value;
    toggleLoading(true, "Sending reset code...");

    fetch(`${API_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
    })
    .then(res => {
        toggleLoading(false);
        if (res.ok) {
            alert("Code sent! Please check your inbox.");
            showForm('verify_code-form'); // Move to the OTP entry screen
        } else {
            alert("Email not found or error sending mail.");
        }
    })
    .catch(err => {
        toggleLoading(false);
        alert("Server error. Please try again later.");
    });
});

// --- OTP VERIFICATION (STEP 2: CHECK 6-DIGIT CODE) ---
document.getElementById('otp-code-input').addEventListener('input', function() {
    const codeBox = this;
    const passSection = document.getElementById('new-password-section');
    const userEmail = document.querySelector('#forgot_password-form input[name="resetEmail"]').value;
     
    if (codeBox.value.length === 6) {
        toggleLoading(true, "Checking code..."); 

        fetch(`${API_URL}/api/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, otp_code: codeBox.value })
        })
        .then(res => {
            toggleLoading(false); 
            if (res.ok) {
                passSection.style.display = 'block';
                codeBox.style.borderColor = "green"; 
                codeBox.readOnly = true; 
            } else {
                codeBox.style.borderColor = "red"; 
                codeBox.value = "";
                codeBox.placeholder = "Invalid code";
            }
        })
        .catch(() => {
            toggleLoading(false);
            alert("Connection error during verification.");
        });
    }
});

// --- RESET PASSWORD (STEP 3: UPDATE DB) ---
document.getElementById('reset-final-form').addEventListener('submit', function(event) {
    event.preventDefault(); 

    const theCode = document.getElementById('otp-code-input').value; 
    const firstPass = document.getElementById('new_password').value; 
    const secondPass = document.getElementById('confirm_new_password').value; 
    const userEmail = document.querySelector('#forgot_password-form input[name="resetEmail"]').value; 

    if (firstPass !== secondPass) { 
        document.getElementById('reset-error-message').textContent = "Passwords do not match!"; 
        return; 
    } 

    toggleLoading(true, "Updating password...");  

    fetch(`${API_URL}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, otp_code: theCode, new_password: firstPass })
    })
    .then(res => { 
        toggleLoading(false); 
        if (res.ok) {
            alert("Password updated successfully!");
            showForm('login-form'); 
        } else {
            alert("Session expired or invalid. Please try again."); 
        }
    })
    .catch(() => {
        toggleLoading(false); 
        alert("Server error. Try later.");
    });
});
