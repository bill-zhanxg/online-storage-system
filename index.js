2// importing stuff
const config = require('./config.json');
const privConf = require('./private.json');
const mysql = require('mysql');
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const _ = require('underscore');
const busboy = require('connect-busboy');
const process = require('process');
const dir = process.cwd();
const app = express();
const port = 3002;

process.on('uncaughtException', (err, origin) => {
    console.log(err);
});

app.use(session({
    secret: privConf.secret,
    resave: true,
    saveUninitialized: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('static'));
app.use(busboy({
    highWaterMark: 2 * 1024 * 1024, // Set 2MiB buffer
}));

const connection = mysql.createConnection({
    host: privConf.host,
    user: privConf.user,
    password: privConf.password,
    database: privConf.database
});

app.get('/', (req, res) => {
    if (req.session.loggedin) {
        // Output username
        if (req.session.data.contoller) {
            res.sendFile(path.join(__dirname + '/views/login.html'));
        }
        else {
            res.sendFile(path.join(__dirname + '/views/login.html'));
        }
    }
    else {
        res.sendFile(path.join(__dirname + '/views/login.html'));
    }
})

app.get('/sign-up', function (req, res) {
    res.send('Unfinished!');
});

app.post('/auth', function (req, res) {
    // Capture the input fields
    let username = req.body.username;
    let password = req.body.password;

    // Code for none MySQL server
    req.session.loggedin = true;
    req.session.data = { id: 1, username: 'myUsername', password: 'myPassword', email: 'myEmail@gmail.com', chatAccess: 1, controller: 1 };
    res.end();
    return;

    // Ensure the input fields exists and are not empty
    if (username && password) {
        // Execute SQL query that'll select the account from the database based on the specified username and password
        connection.query('SELECT * FROM accounts WHERE (username = ? OR email = ?) AND password = ?', [username, username, password], function (error, results, fields) {
            // If there is an issue with the query, output the error
            if (error) {
                send('There is an error with MySQL database, please let Bill.IHCha knows!');
                throw error;
            }
            // If the account exists
            if (results.length > 0) {
                // Authenticate the user
                req.session.loggedin = true;
                req.session.data = results[0];
                res.end();
            }
            else {
                send('Invalid Username or Password!');
            }
        });
    } else {
        send('Please enter Username and Password!');
    }

    function send(text) {
        res.send(text);
        res.end();
    }
});

app.listen(port, () => {
    console.log('HTTP Server running on port ' + port);
});