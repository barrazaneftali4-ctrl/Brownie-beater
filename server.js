global.WebSocket = require('ws'); 
require('dotenv').config(); 

const express = require('express'); 
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const nodemailer = require('nodemailer'); 
const cors = require('cors'); 
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const PORT = process.env.PORT || 3000; 
const SECRET_KEY = process.env.JWT_SECRET || "for_local_testing"; 
var gameRooms = {}; 
const supabaseURL = process.env.SUPABASE_URL; 
const supabaseKey = process.env.SUPABASE_KEY; 
const supabase = createClient(supabaseURL, supabaseKey);


app.use(cors({
	origin: "*",
	methods: ["GET", "POST"],
	credentials: true
}));

app.use(express.json());

app.get('/', (req, res) => {
	res.send('Server is up and running!'); 
}); 


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

if (!supabaseURL || !supabaseKey) {
    console.error("CRITICAL: Supabase environment variables are missing!");
} else {
    console.log("Supabase client initialized.");
}

// register
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


// login
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

	

// forgot password
app.post('/api/forgot-password', async function(req, res) {
	var userEmail = req.body.email.toLowerCase().trim(); 
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
			from: '"Brownie Beater" <browniebeaterco@gmail.com>', 
			to: userEmail, 
			subject: 'Your Reset Code', 
			text: 'Your brownie beater reset code is: ' + codeString
		}; 

		await transporter.sendMail(mailOptions);  
		res.send("Sent"); 
	} 

	catch (mailError) {
		console.log("Gmail Error: " + mailError.message); 
		res.status(500).send("Mail failed"); 
	}
});


app.post('/api/verify-otp', async function(req, res) {
    const email = req.body.email.toLowerCase().trim();
    const userCode = req.body.otp_code;

    console.log(`Verifying code ${userCode} for ${email}`);

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('reset_code', userCode)
            .maybeSingle();

        if (user) {
            res.status(200).send("Valid code");
        } else {
            res.status(400).send("Invalid code");
        }
    } catch (err) {
        res.status(500).send("Server error");
    }
});

// reset passowrd 
app.post('/api/reset-password', async function(req, res) {
    var email = req.body.email.toLowerCase().trim(); 
    var userCode = req.body.otp_code; 
    var newPassword = req.body.new_password; 

    var result = await supabase 
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('reset_code', userCode)
            .maybeSingle(); 

    var user = result.data;
    
    if(!result.data) {
	    return res.status(400).send("Invalid code or email"); 
    }

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


const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000 
});


//sockets connection
io.on('connection', (socket) => {
    console.log("Socket connected:", socket.id);

    // join room
    socket.on("joinRoom", ({ roomCode, username }) => {
        if (!gameRooms[roomCode]) return;

        const currentPlayers = gameRooms[roomCode].playList;
    
        if (currentPlayers.length >= 2 && !currentPlayers.includes(username)) {
            socket.emit("error", "Room is full! Max 2 players.");
            return;
        }
        socket.join(roomCode);

        if (!gameRooms[roomCode].playList.includes(username)) {
            gameRooms[roomCode].playList.push(username);
        }

        if (!gameRooms[roomCode].readyPlayers) {
            gameRooms[roomCode].readyPlayers = {};
        }
        // new players not ready
        if (gameRooms[roomCode].readyPlayers[username] === undefined) {
            gameRooms[roomCode].readyPlayers[username] = false;
        }

        if (gameRooms[roomCode].status !== "finished") {
            if (!gameRooms[roomCode].scores[username]) {
                gameRooms[roomCode].scores[username] = { clicks: 0, cps: 0 };
            }
        }

            io.to(roomCode).emit("roomUpdate", {
            players: gameRooms[roomCode].playList,
            readyStatus: gameRooms[roomCode].readyPlayers
        });
    });

    //ready logic so game can start
    socket.on("toggleReady", ({ roomCode, username }) => {
        if (!gameRooms[roomCode]) return;

        gameRooms[roomCode].readyPlayers[username] = !gameRooms[roomCode].readyPlayers[username];

        const players = gameRooms[roomCode].playList;
        const readyObj = gameRooms[roomCode].readyPlayers;

        io.to(roomCode).emit("roomUpdate", {
            players: players,
            readyStatus: readyObj
        });

        const allReady = players.length >= 2 && players.every(p => readyObj[p] === true);

        if (allReady) {
            gameRooms[roomCode].status = "playing";
            io.to(roomCode).emit("gameStarted");
        }

    });

    //force start incase you want to solo play
    socket.on("forceStart", ({ roomCode }) => {
        if (!gameRooms[roomCode]) return;

        console.log(`Solo/Manual start triggered for room: ${roomCode}`);
        
        gameRooms[roomCode].status = "playing";
        
        io.to(roomCode).emit("gameStarted");
    });
    
     //checks if done, saves player stats, sets status to finished
    socket.on("playerReachedGoal", ({ roomCode, username, usedPowerUps, peakCPS, finalClicks }) => {
        if (!gameRooms[roomCode] || gameRooms[roomCode].status !== "playing") return;

            gameRooms[roomCode].scores[username] = {
            clicks: finalClicks,
            cps: peakCPS,
            usedPowerUps: usedPowerUps
        };

        gameRooms[roomCode].status = "finished";
        
        io.to(roomCode).emit("gameOver", {
            winner: username,
            finalScores: gameRooms[roomCode].scores 
        });
    });

    //clicking livestream, checks clicks cps, and usedPoweups
    socket.on("clickUpdate", ({ roomCode, username, clicks, cps, usedPowerUps }) => {
        if (!gameRooms[roomCode] || gameRooms[roomCode].status === "finished") return;

        gameRooms[roomCode].scores[username] = {
            clicks: clicks || 0,
            cps: cps || 0,
            usedPowerUps: usedPowerUps || { multiplier: 0, steal: 0, glitch: 0}
        };

        io.to(roomCode).emit("scoreUpdate", gameRooms[roomCode].scores);
    });

    //steal powerup logic
    socket.on("activateSteal", ({ roomCode, username }) => {
        if (!gameRooms[roomCode] || gameRooms[roomCode].status !== "playing") return;

        let room = gameRooms[roomCode];
        let stolenTotal = 0;

        for (let player in room.scores) {
            if (player !== username) {
                
                let currentOpponentClicks = room.scores[player].clicks || 0;
                let amountToSteal = Math.floor(currentOpponentClicks * 0.15);
                
                room.scores[player].clicks -= amountToSteal;             
                stolenTotal += amountToSteal;

                socket.to(roomCode).emit("pointsLost", { 
                    victim: player, 
                    newTotal: room.scores[player].clicks,
                    thief: username 
                });
            }
        }
      
        if (room.scores[username]) {
            room.scores[username].clicks += stolenTotal;
        }
        
        io.to(roomCode).emit("scoreUpdate", room.scores);
        
            socket.emit("stealConfirmed", { newTotal: room.scores[username].clicks });
    });

    
    socket.on("activateGlitch", ({ roomCode, username }) => {
        // Send a message to everyone EXCEPT the person who used it
        socket.to(roomCode).emit("glitchEffect", { duration: 30000 }); 
    });

    socket.on("getFinalScores", ({ roomCode }) => {
        if (gameRooms[roomCode]) {
            console.log(`Sending final scores for room ${roomCode}`);
            socket.emit("displayFinalScores", gameRooms[roomCode].scores);
        } else {
            console.log(`Room ${roomCode} not found for final scores`);
        }
    });
    socket.on("powerUpUsed", ({ roomCode, username, powerUpName }) => {
        // Send to everyone in the room EXCEPT the sender
        socket.to(roomCode).emit("opponentUsedPowerUp", { 
            user: username, 
            powerUp: powerUpName 
        });
    });
    //resets ev to 0, and sends players to waiting room
    socket.on("requestRematch", ({ roomCode }) => {
        if (!gameRooms[roomCode]) return;

        console.log(`Resetting room ${roomCode} for rematch`);

        gameRooms[roomCode].status = "waiting";
        gameRooms[roomCode].scores = {};
        gameRooms[roomCode].readyPlayers = {}; 

        
        const currentPlayers = gameRooms[roomCode].playList;
        currentPlayers.forEach(player => {
            
            gameRooms[roomCode].readyPlayers[player] = false; 
            
            
            gameRooms[roomCode].scores[player] = { 
                clicks: 0, 
                cps: 0, 
                usedPowerUps: { multiplier: 0, steal: 0 } 
            };
        });

        io.to(roomCode).emit("goToWaitroom");
    });

    socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
}); 

    function makeCode() {
    return Math.floor(1000 + Math.random() * 9000).toString(); 
    }

    // create room
    app.post('/createRoom', function(req, res) {
        var newCode = makeCode(); 
        gameRooms[newCode] = {
            hostName: req.body.username, 
            playList: [], 
            status: "waiting",
            scores: {} 
        };
        console.log("Room Created:", newCode, "by", req.body.username);
        res.send({ roomCode: newCode }); 
    });

    // room status
    app.get('/roomStatus/:code', function(req, res) {
        var room = gameRooms[req.params.code]; 
        if (room) {
            res.send({
                playerCount: room.playList.length, 
                isFull: room.playList.length >= 2, 
                status: room.status
            }); 
        } else {
            res.status(404).send("Room not found"); 
        }
    });
    
    //stats
    app.get('/api/stats', async function(req, res) {
            const username = req.query.username;

            if (!username) {
                return res.status(400).json({ error: "Username required" });
            }

            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('totalBrownies')
                    .eq('username', username)
                    .maybeSingle();

                if (error) throw error;

                const total = data ? (data.totalBrownies || 0) : 0;
                res.json({ totalBrownies: total });

            } catch (err) {
                console.error("Error fetching stats:", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
    });

    server.listen(PORT, function() {
        console.log("Server running on port " + PORT);
    });

    app.post('/api/add-clicks', async function(req, res) {
        const { clicks } = req.body;
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).send("No token");

        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, SECRET_KEY);
            const username = decoded.username;

            
            const { data: user } = await supabase
                .from('users')
                .select('totalBrownies')
                .eq('username', username)
                .single();

            const currentTotal = user ? (user.totalBrownies || 0) : 0;
            const newTotal = currentTotal + clicks;

                const { error } = await supabase
                .from('users')
                .update({ totalBrownies: newTotal })
                .eq('username', username);

            if (error) throw error;
            res.json({ success: true, newTotal });
        } catch (err) {
            console.error(err);
            res.status(500).send("Error saving brownies");
        }
    });

