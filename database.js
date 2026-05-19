require("dotenv").config()

const { createClient } = require("@supabase/supabase-js")
const crypto = require("crypto")

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

console.log("SUPABASE_URL:", process.env.SUPABASE_URL)
console.log("SUPABASE_KEY:", process.env.SUPABASE_KEY ? "OK" : "MISSING")

module.exports = {
    getMessages: async () => {
        const { data, error } = await supabase
            .from("messages")
            .select("msg_id, content, author, users(login)")
            .order("msg_id", { ascending: true })

        if (error) {
            console.error("getMessages error:", error)
            return []
        }

        return data.map(m => ({
            msg_id: m.msg_id,
            content: m.content,
            login: m.users?.login || "unknown",
            user_id: m.author
        }))
    },

    addMessage: async (msg, userId) => {
        const { error } = await supabase
            .from("messages")
            .insert({
                content: msg,
                author: userId
            })

        if (error) {
            console.error("addMessage error:", error)
        }
    },
    isUserExist: async (login) => {
        const { data, error } = await supabase
            .from("users")
            .select("user_id")
            .eq("login", login)

        if (error) {
            console.error("isUserExist error:", error)
            return false
        }

        return data.length > 0
    },

    addUser: async (user) => {
        try {
            const salt = crypto.randomBytes(16).toString("hex")

            const password = crypto
                .pbkdf2Sync(user.password, salt, 1000, 64, "sha512")
                .toString("hex")

            const { data, error } = await supabase
                .from("users")
                .insert({
                    login: user.login,
                    password,
                    salt
                })
                .select()

            if (error) {
                console.error("addUser error:", error)
                throw error
            }

            console.log("USER CREATED:", data)
            return data

        } catch (err) {
            console.error("addUser exception:", err)
            throw err
        }
    },
    getAuthToken: async (user) => {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("login", user.login)

        if (error) {
            console.error("login query error:", error)
            throw "DB error"
        }

        if (!data.length) {
            throw "Wrong login"
        }

        const u = data[0]

        const hash = crypto
            .pbkdf2Sync(user.password, u.salt, 1000, 64, "sha512")
            .toString("hex")

        if (hash !== u.password) {
            throw "Wrong password"
        }

        return u.user_id + "." + u.login + "." + crypto.randomBytes(20).toString("hex")
    }
}