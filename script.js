function showForm(formId) {
    const forms = document.querySelectorAll(".form-box"); // Looks at html and calls up for fb 
    for(var i = 0; i < forms.length; i++) {
        forms[i].classList.remove("active"); // hides them so screen is empty 
    }

    const targetForm = document.getElementById(formId); // find specific form 
    if (targetForm) {
        targetForm.classList.add("active"); // if can find
    } else {
        console.warn("Could not find form with ID:", formId); //if can't find 
    }
}

function togglePassword(inputId, iconElement) {
    var passwordBox = document.getElementById(inputId); 
    if (passwordBox.type == "password") {
        console.log("showing password now..."); 
        passwordBox.type = "text"; 
        iconElement.classList.remove("fa-eye"); 
        iconElement.classList.add("fa-eye-slash"); 
    } else {
        passwordBox.type = 'password'; 
        iconElement.classList.remove("fa-eye-slash"); 
        iconElement.classList.add("fa-eye"); 
    }
}

document.getElementById('password').addEventListener('input', function() {
    var passwordValue = this.value; 

    var hasNumber = /[0-9]/.test(passwordValue); 
    updateStatus('req-number', hasNumber); 

    var hasUpper = /[A-Z]/.test(passwordValue); 
    updateStatus('req-upper', hasUpper); // Fixed: was double-checking number before

    var hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(passwordValue); 
    updateStatus('req-special', hasSpecial); 

    console.log("Check password: " + passwordValue); 
}); 

function updateStatus(requirementId, checkPasses) {
    var requirementRow = document.getElementById(requirementId); 
    var theIcon = requirementRow.querySelector('i');
    var currentPassword = document.getElementById('password').value; 

    if (currentPassword.length > 0 && checkPasses == true) {
        requirementRow.style.color = "green"; 
        theIcon.className = "fa-solid fa-circle-check"; 
    } else {
        requirementRow.style.color = "red"; 
        theIcon.className = "fa-solid fa-circle-xmark"; 
    }
}

document.getElementById('confirm_password').addEventListener('input', function() {
    var pass1 = document.getElementById('password').value; 
    var pass2 = this.value; 
    var errorDisplay = document.getElementById('error-message'); 

    if (pass1 != pass2) { 
        if (pass2.length > 0) {
            errorDisplay.textContent = "Passwords do not match !"; 
        }
    } else {
        errorDisplay.textContent = ""; 
    }
}); 

// --- REGISTER ---
document.querySelector('#register-form form').addEventListener('submit', function(event) {
    event.preventDefault(); 

    var email = this.email.value; 
    var password = document.getElementById('password').value; 
    var username = this.name.value; 
    var confirmPass = document.getElementById('confirm_password').value; 
    var errorBox = document.getElementById('error-message'); 

    var hasNum = /[0-9]/.test(password); 
    var hasUpper = /[A-Z]/.test(password); 
    var hasSpecial = /[!@#$%^&*(),.?{}|<>]/.test(password); 

    if (hasNum == false || hasUpper == false || hasSpecial == false) {
        errorBox.textContent = "Error: Password is not complecated enought !";
        return; 
    }

    if (password != confirmPass) {
        errorBox.textContent = "Error: Passwords do not match!"; 
        return; 
    }

    console.log("Everything is good, Registering..."); 

    fetch('http://localhost:3000/api/register',{
        method: 'POST', 
        headers: { 'Content-Type' : 'application/json' }, 
        body: JSON.stringify({ 
		username: username, 
		email: email,
		password: password
            
        })
    })
    .then(function(response) {
        if(response.ok == true) {
            alert("Registration successful!");
	    localStorage.setItem('username', username); 
            showForm('login-form'); 
        } 
	else {
            errorBox.textContent = "Registration failed. Try again."; 
        }
    })
    .catch(function(error) {
        console.log("Error logic hit"); 
        errorBox.textContent = "Cannot connect to server."; 
    }); 
});

// --- LOGIN ---
document.querySelector('#login-form form').addEventListener('submit', function(event) {
    event.preventDefault(); 
    var userName = this.username.value; 
    var userPass = document.getElementById('login_password').value; 

    console.log("Attempting to login for user: " + userName); 

    fetch('http://localhost:3000/api/login', {
        method: 'POST', 
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
            username: userName, 
            password: userPass
        })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if(data.token) {
            localStorage.setItem('token', data.token);
	    localStorage.setItem('username', userName); 
            alert("Welcome back to Brownie Beater!"); 
            window.location.href = 'lobby.html';
        } else {
            var messag = data.message || "Invalid"; 
            alert("Login failed: " + messag); 
        }
    })
    .catch(function(err) {
        console.log("Error: " + err); 
        alert("Cannot connect to the server."); 
    }); 
}); 

// --- FORGOT PASSWORD ---
document.querySelector('#forgot_password-form form').addEventListener('submit', function(event) {
    event.preventDefault(); 
    var myEmail = this.resetEmail.value; 

    fetch('http://localhost:3000/api/forgot-password', {
        method: 'POST', 
        headers: { 'Content-Type' : 'application/json' }, 
        body: JSON.stringify ({ email: myEmail })
    })
    .then(function(response) {
        if(response.ok == true) {
            alert("Code sent! CHeck your email."); 
            showForm('verify_code-form'); 
        } else {
            alert("Error: It didn't work. Try again!"); 
        }
    })
    .catch(function(err) {
        alert("Server error... try again later."); 
    });
}); 

// --- OTP AUTO-TAB ---
var otpBoxes = document.querySelectorAll('#otp-inputs input'); 
for (var i = 0; i < otpBoxes.length; i++){
    otpBoxes[i].addEventListener('input', function() {
        if (this.value.length == 1) {
            var next = this.nextElementSibling;
            if(next) { next.focus(); }
        }
    }); 
    otpBoxes[i].addEventListener('keydown', function(event) {
        if (event.key == 'Backspace' && this.value == "") {
            var prev = this.previousElementSibling; 
            if(prev) { prev.focus(); }
        }
    }); 
}

// --- VERIFY & RESET ---
document.querySelector('#verify_code-form form').addEventListener('submit', function(event) {
    event.preventDefault();
    var finalCode = ""; 
    var otpBoxes = document.querySelectorAll('#otp-inputs input'); 
    for (var i = 0; i < otpBoxes.length; i++) {
        finalCode = finalCode + otpBoxes[i].value; 
    }

    if (finalCode.length < 6) {
        alert("Please enter the full 6-digit code.");
        return; 
    }

    var newPass = document.getElementById('new_password').value; 
    var userEmail = document.querySelector('#forgot_password-form input[name="resetEmail"]').value;

    if (!userEmail) {
        alert("Error: Email is missing. Go back to forgot password screen.");
        return; 
    }

    fetch('http://localhost:3000/api/reset-password', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
            email: userEmail, 
            otp_code: finalCode, 
            new_password: newPass
        })
    })
    .then(function(response) {
        if (response.ok == true) {
            alert("Password updated successfully!"); 
            showForm('login-form'); 
        } else {
            alert("Error: This code is wrong or expired.");
        }
    })
    .catch(function(err) {
        alert("Cannot connect to the server."); 
    });
});
