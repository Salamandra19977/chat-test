const http = require("http")
const path = require("path")
const fs = require("fs")
const db = require("./database")
const cookie = require("cookie")
require("dotenv").config()

const validAuthTokens = []

const indexHtmlFile = fs.readFileSync(path.join(__dirname, "static", "index.html"))
const registerHtmlFile = fs.readFileSync(path.join(__dirname, "static", "register.html"))
const authScript = fs.readFileSync(path.join(__dirname, "static", "auth.js"))
const scriptFile = fs.readFileSync(path.join(__dirname, "static", "script.js"))
const styleFile = fs.readFileSync(path.join(__dirname, "static", "style.css"))
const loginFile = fs.readFileSync(path.join(__dirname, "static", "login.html"))

const server = http.createServer((req, res) => {
    if (req.method === "GET") {
        switch(req.url) {
            case "/style.css":
                res.writeHead(200, { "Content-Type": "text/css" })
                return res.end(styleFile)
            case "/register": return res.end(registerHtmlFile)
            case "/auth.js": return res.end(authScript)
            case "/login": return res.end(loginFile)
            default: return guarded(req, res)
        }
    }

    if (req.method === "POST") {
        switch(req.url) {
            case "/api/register": return registerUser(req, res)
            case "/api/login": return loginUser(req, res)
            default: return guarded(req, res)
        }
    }
})

require("dotenv").config()

const PORT = process.env.PORT || 3000

server.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on port:", PORT)
})

const { Server } = require("socket.io")
const io = new Server(server)

io.on("connection", async (socket) => {
    console.log("user connected. id - " + socket.id)
    let userNickName = "user"

    let messages = await db.getMessages()
    socket.emit("all_messages", messages)

    socket.on("set_nickname", (nickname) => {
        userNickName = nickname
    })

    socket.on("new_message", (message) => {
        console.log(`${socket.id} - ${message}`)
        db.addMessage(message, 6)
        io.emit("message", userNickName + ":" + message)
    })
})

function guarded(req, res) {
    const credentionals = getCredentionals(req.headers?.cookie)
    if (!credentionals) {
        res.writeHead(302, {"Location": "/register"})
        return res.end()
    }

    if (req.method === "GET") {
        switch(req.url) {
            case "/": return res.end(indexHtmlFile)
            case "/script.js": return res.end(scriptFile)
        }
    }

    res.statusCode = 404
    return res.end("Error 404")
}

function getCredentionals(c = "") {
    const cookies = cookie.parse(c)
    const token = cookies?.token

    if (!token || !validAuthTokens.includes(token)) return null
    const [user_id, login] = token.split(".")
    if (!user_id || !login) return null
    return {user_id, login}
}

function registerUser(req, res) {
    let data = ""
    req.on("data", function(chunk) {
        data += chunk
    })

    req.on("end", async function(chunk) {
        console.log(db)
        try {
            const user = JSON.parse(data)
            console.log(data)
            if (!user.login || !user.password) {
                return res.end("Empty login or password")
            }

            if (await db.isUserExist(user.login)) {
                return res.end("User already exist")
            }

            await db.addUser(user)
            return res.end("Registration is successfull!")

        } catch (error) {
            return res.end(error)
        }
    })

}

function loginUser(req, res) {
    let data = ""
    req.on("data", function(chunk) {
        data += chunk
    })

    req.on("end", async function(chunk) {
        try {
            console.log(data)
            const user = JSON.parse(data)
            const token = await db.getAuthToken(user)
            validAuthTokens.push(token)
            res.writeHead(200)
            res.end(token)
        } catch (error) {
            res.writeHead(500)
            return res.end(error)
        }
    })
}