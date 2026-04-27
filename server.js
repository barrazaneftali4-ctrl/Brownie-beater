require('dotenv').config(); 

const express = require('express'); 
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const nodemailer = require('nodemailer'); 
const cors = require('cors'); 
const { createClient } = require('@supabase/supabase-js');



const app = express();
const PORT = process.env.PORT || 3000; 
const SECRET_KEY = process.env.JWT_SECRET || "for_local_testing"; 


const supabaseURL = process.env.SUPABASE_URL; 
const supabaseKey = process.env.SUPABASE_KEY; 

const supabase = createClient(supabaseURL, supabaseKey);

app.use(cors()); 
app.use(express.json()); 

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, 
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS 
    },
    tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
    }
});

// 1. REGISTER
app.post('/api/register', async function(req, res) {
	var username = req.body.username; 
	var password = req.body.password; 
	var email = req.body.email.toLowerCase().trim();

	console.log("Attempting to register user: " + username); 

	try {
		const {data: existingUser } = await supabase 
		.from('users')
		.select('id')
		.or(`email.eq.${email},username.eq.${username}`)
		.maybeSingle(); 

		if(existingUser) {
			return res.status(400).send("Username or Email already is use."); 
		}

		var saltRounds = 10; 
		var hashedPassword = await bcrypt.hash(password, saltRounds); 

		var response = await supabase 
			.from('users')
			.insert([
				{
					username: username, 
					password: hashedPassword, 
					email: email
				}
			]); 

		if(response.error) {
			console.log("Supabase  error:", response.error.message); 
			return res.status(400).send("Registration failed: " + response.error.message); 
		}

		console.log("User" + username  + " is now in the database !"); 
		res.status(201).send("Success"); 
	}
	catch (err) {
		console.log("Everything broke:"); 
		console.log(err); 
		res.status(500).send("Server crashed"); 
	}
}); 


// 2. LOGIN
app.post('/api/login', async function(req, res) {
	var userAttempt = req.body.username.trim(); 
	var passAttempt = req.body.password; 

	console.log("Login attempt from: " +  userAttempt); 

	var result = await supabase 
		.from('users')
		.select('*')
		.ilike('username', userAttempt)
		.maybeSingle(); 

	var user = result.data; 

	if(!user) {
		console.log("User not found in the database"); 
		return res.status(401).json({ message: "Invalid username or password" }); 
	}

	var passwordMatch = await bcrypt.compare(passAttempt, user.password); 

	if (passwordMatch) {

		var token = jwt.sign({ username: userAttempt }, SECRET_KEY); 
		console.log("Login success for " + userAttempt); 
		res.json({ token: token}); 
	}
	else {
		console.log("Password didn't match for " + userAttempt); 
		res.status(401).json({ message: "Invalid username or password " }); 
	} 
}); 

	

// 3. FORGOT PASSWORD (SENDS THE CODE)
app.post('/api/forgot-password', async function(req, res) {
	var userEmail = req.body.email; 
	var randomCode = Math.floor(100000 + Math.random() * 900000); 
	var codeString = randomCode.toString(); 

	console.log(" Reset attempt from: " + userEmail + "---"); 

	var result = await supabase 
	.from('users')
	.update({ reset_code: codeString })
	.eq('email', userEmail) 
	.select(); 

	if (result.error || !result.data || result.data.length === 0) {
		console.log(" Couldn't find the email in the database"); 
		return res.status(400).send("User not found"); 
	} 

	try {
		var mailOptions = {
			from: '"Brownie Beater" <barrazaneftali4@gmail.com>', 
			to: userEmail, 
			subject: 'Your Reset Code', 
			text: 'Your brownie beater reset code is: ' + codeString
		}; 

		await transporter.sendMail(mailOptions); 

		console.log("Code sent to your email!"); 
		res.send("Sent"); 
	} 

	catch (mailError) {
		console.log("Gmail Error: " + mailError.message); 
		res.status(500).send("Mail failed"); 
	}
}); 

// 4. RESET PASSWORD (UPDATES THE DB)
app.post('/api/reset-password', async function(req, res) {
    var email = req.body.email; 
    var userCode = req.body.otp_code; 
    var newPassword = req.body.new_password; 

    console.log("Attempting to change password for: " + email); 

    var result = await supabase 
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('reset_code', userCode)
            .maybeSingle(); 

    var user = result.data; 

    if (!user) {
            console.log("Invalid code or email provided"); 
            return res.status(400).send("Invalid code or email"); 
    } 

    var saltRounds = 10; 
    var hashed = await bcrypt.hash(newPassword, saltRounds); 

   
    var updateResult = await supabase 
            .from('users')
            .update({
                    password: hashed, 
                    reset_code: null 
            })
            .eq('email', email);

    if (updateResult.error) {
            console.log("Update failed in database:", updateResult.error.message); 
            return res.status(500).send("Update failed"); 
    }

    console.log("Password successfully reset for " + email); 
    res.send("Password changed successfully!");
});

app.listen( PORT, function() {
	console.log("-----------------------------"); 
	console.log("Server is running on port: " + PORT); 
	console.log("Brownie Beater Back is Live!");
	console.log("-----------------------------"); 
});

//5. ROOMS 

var gameRooms = {}; 

function makeCode() {
    return Math.floor(1000 + Math.random() * 9000).toString(); 
}

app.post('/createRoom', function(req, res) {
    var newCode = makeCode(); 
    gameRooms[newCode] = {
        hostName: req.body.username, 
        playList: [req.body.username], 
        status: "waiting",
        scores: {} // Initialize scores here to avoid errors later
    };
    res.send({ roomCode: newCode }); 
});

app.post('/joinRoom', function(req,res) {
    var codeFromUser = req.body.roomCode; 
    var nameFromUser = req.body.username; 

    if (gameRooms[codeFromUser]) { 
        gameRooms[codeFromUser].playList.push(nameFromUser); 
        res.send({ success: true, msg: "You're in!" }); 
    } else {
        res.status(404).send({ success: false, msg: "Room not found!" });
    }
});

app.post('/updateClicks', function(req, res) {
    var { roomCode, username, clicks } = req.body;
    if (gameRooms[roomCode]) {
        gameRooms[roomCode].scores[username] = clicks; 
        res.send({ success: true }); 
    } else {
        res.status(404).send("Room not found"); 
    }
}); 

// ONLY USE THIS ONE VERSION OF roomStatus
app.get('/roomStatus/:code', function(req, res) {
    var room = gameRooms[req.params.code]; 
    if (room) {
        res.send({
            playerCount: room.playList.length, 
            players: room.playList, 
            status: room.status, 
            scores: room.scores
        }); 
    } else {
        res.status(404).send("Room not found"); 
    }
});
