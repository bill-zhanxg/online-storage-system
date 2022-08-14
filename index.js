const mysql = require('mysql');
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const busboy = require('connect-busboy');
const cheerio = require('cheerio');
const dir = process.cwd();
const app = express();
const config = require('./config.json');
const port = 3001;

process.on('uncaughtException', (err, origin) => {
    console.log(err);
});

app.use(session({
    secret: config.secret,
    resave: false,
    saveUninitialized: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('static'));
app.use(busboy({
    highWaterMark: 2 * 1024 * 1024, // Set 2MiB buffer
}));

const connection = mysql.createPool({
    // connectionLimit: 10,
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
});

app.get('/signup', (req, res) => {
    if (req.session.loggedin) {
        res.redirect('/');
    }
    else {
        res.sendFile(path.join(__dirname + '/views/sign-up.html'));
    }
})

app.use('/auth', (err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        res.send('Too many characters!');
        res.end();
    }
    else {
        console.log(err.type);
        next();
    }
});

app.post('/auth', (req, res) => {
    // Capture the input fields
    let username = req.body.username;
    let password = req.body.password;

    // Code for none MySQL server
    req.session.loggedin = true;
    req.session.data = { id: 1, username: 'myUsername', password: 'myPassword', email: 'myEmail@gmail.com' };
    req.session.save();
    res.end();
    return;

    // Ensure the input fields exists and are not empty
    if (username && password) {
        // Execute SQL query that'll select the account from the database based on the specified username and password
        let sql = connection.query(`SELECT * FROM accounts WHERE (username = ? OR email = ?) AND password = ?`, [username, username, password], function (error, results, fields) {
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

app.post('/auth/logout', (req, res) => {
    req.session.destroy();
    res.end();
})

app.post('/account/create', (req, res) => {

});

// File API
function checkPath(id, dir, extra = []) {
    if (!fs.existsSync('storedFiles')) fs.mkdirSync('storedFiles');
    return path.join(__dirname, 'storedFiles', id, dir, ...extra);
}

app.get('*', async (req, res) => {
    if (req.session.loggedin) {
        let userId = `${req.session.data.id}`;
        let dir = req.params[0];
        
        if (!fs.existsSync(checkPath(userId, dir))) return res.sendFile(path.join(__dirname + '/views/not-found.html'));
        let $ = cheerio.load(await fs.promises.readFile(path.join(__dirname + '/views/user.html')));
        
        let folders = [];
        for (let folder of dir.split('/')) {
            folders.push(folder);
            if (folder.trim()) $('.dir').append(`<li><a href="${folders.join('/')}">${folder}</a></li>`);
        }

        if ((await fs.promises.stat(checkPath(userId, dir))).isDirectory()) {
            fs.readdir(checkPath(userId, dir), async (err, files) => {
                if (err) {
                    // Return error element
                    console.log(err)
                }
                else {
                    function appendElement(filename, size, time, icon) {
                        $('.filePanel').append(`<div class="fileitem cursor-pointer flex justify-between items-center bg-base-200 border-[2px] border-base-300 px-4 py-2 rounded-xl">

                        <div class="flex basis-1/2 justify-start items-center gap-4">
                          <input type="checkbox" class="checkbox checkitem" />
                          <p class="foldername"><i class="fa-solid fa-${icon} pr-2"></i>${filename}</p>
                        </div>
                
                        <div class="flex basis-1/2 justify-between items-center gap-4 lg:gap-8">
                          <p>${size}</p>
                          <p>${time}</p>
                          <div class="dropdown dropdown-end">
                            <label tabindex="0" class="btn btn-info m-1" id="dropdown"><i class="fa-solid fa-ellipsis-vertical"></i></label>
                            <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-300 rounded-box w-52" id="dropdown-menu">
                              <li><a>Do something</a></li>
                              <li><a>Do something too</a></li>
                              <li><a class="bg-red-500 text-base-300">just don't press it.</a></li>
                            </ul>
                          </div>
                        </div>
                
                      </div>`)
                    }
                    for (let file of files) {
                        let stat = await fs.promises.stat(checkPath(userId, dir, [file]));
                        let size = stat.size;
                        if (size < 1000) size = `${size} Byte${size > 1 ? 's' : ''}`;
                        else if (size < 1000000) size = `${Math.round(size / 1000)} KB`;
                        else if (size < 1.0000E+9) size = `${Math.round(size / 1000000)} MB`;
                        else if (size < 1.0000E+12) size = `${Math.round(size / 1.0000E+9)} GB`;
                        else size = `${Math.round(size / 1.0000E+12)} TB`;
                        appendElement(file, size, 'today', stat.isDirectory() ? 'folder': 'file');
                    }
                    return res.send($.html());
                }
            })
        }
        else {

        }
    }
    else {
        res.sendFile(path.join(__dirname + '/views/login.html'));
    }
});

app.post('/files/upload', (req, res) => {
    // If the user is loggedin
    if (req.session.loggedin) {
        if (!req.session.admin) return;

        req.pipe(req.busboy); // Pipe it trough busboy

        req.busboy.on('field', function (key, value) {
            req.body[key] = value;
        });

        let name = tmp.tmpNameSync();
        let stream = fs.createWriteStream(name);
        req.busboy.on('file', (fieldname, file) => {
            // Pipe it trough
            file.pipe(stream);
        });

        req.busboy.on('finish', () => {
            try {
                stream.end();
                let dir = path.join(checkPath(), `${req.body.path}/${req.body.name}`);
                fs.copyFile(name, dir, () => {
                    fs.unlink(name, () => { });
                    res.json({ success: true });
                });
            }
            catch {
                fs.unlink(name, () => { });
                res.json({ success: false });
            }
        });
    } else {
        return res.json({ success: false });
    }
});

app.post('/files/delete', (req, res) => {
    // If the user is loggedin
    if (req.session.loggedin) {
        if (!req.session.admin) return;
        let dir = path.join(checkPath(), req.body.path);
        fs.rm(dir, { recursive: true }, (err) => {
            if (err) return res.json({ success: false });
            return res.json({ success: true });
        });
    } else {
        return res.json({ success: false });
    }
});

app.post('/files/rename', (req, res) => {
    // If the user is loggedin
    if (req.session.loggedin) {
        if (!req.session.admin) return;
        let oldPath = path.join(checkPath(), req.body.oldPath);
        let newPath = path.join(checkPath(), req.body.newPath);

        fs.rename(oldPath, newPath, (err) => {
            if (err) return res.json({ success: false });
            return res.json({ success: true });
        })
    } else {
        return res.json({ success: false });
    }
});

app.listen(port, () => {
    console.log('HTTP Server running on port ' + port);
});

console.log('Server started!');