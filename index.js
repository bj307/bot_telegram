require("dotenv").config();
const admin = require("firebase-admin");
const TelegramBot = require("node-telegram-bot-api");
const express = require('express');
const app = express();

const serviceAccount = JSON.parse(process.env.FIREBASE);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.get('/', (req, res) => res.send('Bot online'));

const token = process.env.BOT_TOKEN_BJ;
//const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const ADMINS = [1666486212, 5710729603];

var mensagensPendentes = [];

bot.getMe().then((botInfo) => {
    ADMINS.push(botInfo.id);
    console.log(`👑 Dono do bot:`);
    console.log(botInfo);
});

bot.on("message", async (context) => {
    console.log(context)
    var id = context.from.id;

    if (context.text.startsWith("/")) return;

    bot.sendMessage(id, "❎ Não entendi, escolha uma opção válida.");
})

bot.onText(/\/pendentes/, async (msg) => {
    const id_chat = msg.chat.id;
    const id_from = msg.from.id;
    
    if(!ADMINS.includes(id_from)){
        bot.sendMessage(id_chat, "❎ Não entendi, escolha uma opção válida.");
        return;
    }

    try {
        const snapshot = await db.collection('Pendentes').orderBy('timestamp', 'desc').get();

        if(snapshot.empty){
            bot.sendMessage(id_chat, "❎ Não há mensagens pendentes.");
            return;
        } else {

            let perguntas = '📜 Perguntas Pendentes:\n\n';

            MontarPerguntasPendentes(snapshot);

            mensagensPendentes.forEach(doc => {
                perguntas += `ID: ${doc.id} - Pergunta: ${doc.data.message} \n\n`;
            })
            
            bot.sendMessage(id_chat, perguntas, { parse_mode: "Markdown" });
        }
    } catch (error) {
        console.error('Erro ao recuperar perguntas:', error);
        bot.sendMessage(id_chat, "Houve um erro ao tentar recuperar as perguntas.");
    }
})

bot.onText(/\/pergunta (.+)/, async (msg, match) => {
    console.log(msg)
    const id_chat = msg.chat.id;
    const id_from = msg.from.id;
    const message = match[1];
    const timestamp = new Date();

    const pergunta = {
        id_chat,
        id_from,
        message,
        timestamp
    };

    try{

        await db.collection("Pendentes").add(pergunta);

        const snapshot = await db.collection("Pendentes").get();
        const countMsg = snapshot.size;

        var msgToAdmin = `📩 Nova pergunta recebida! Total: [${countMsg}]`;
        ADMINS.forEach(admin => {
            setTimeout(() => {
                bot.sendMessage(admin, msgToAdmin, { parse_mode: "Markdown" });
            }, 1000);
        })

        bot.sendMessage(id_chat, "📩 Recebi sua mensagem! Alguém da equipe pode te responder em breve.", { parse_mode: "Markdown" });
    }
    catch (error) {
        console.log(error)
        bot.sendMessage(id_chat, "⚠️ Ocorreu um erro ao registrar sua pergunta. Tente novamente mais tarde.");
    }  
})

bot.onText(/\/responder \[(\d+)\] (.+)/, async (msg, match) => {
    console.log(msg)
    const id_chat = msg.chat.id;
    const id_from = msg.from.id;
    const id = parseInt(match[1]);
    const resposta = match[2];

    const pergunta = mensagensPendentes.find(p => p.id == id);

    if(pergunta){
        try{

            bot.sendMessage(pergunta.data.id_chat, `Pergunta: ${pergunta.data.message} \n\n Resposta: ${resposta}`, { parse_mode: "Markdown" });
            mensagensPendentes = mensagensPendentes.filter(p => p.id != id);
            await db.collection('Pendentes').doc(pergunta.doc).delete();
            bot.sendMessage(id_chat, `✅ Sua resposta foi enviada para o usuário!`, { parse_mode: "Markdown" });
        }
        catch (error) {
            console.error('Erro ao responder e excluir a pergunta:', error);
            bot.sendMessage(id_chat, "❌ Ocorreu um erro ao tentar responder à pergunta. Tente novamente.", { parse_mode: "Markdown" });
        }
    }
    else {
        bot.sendMessage(id_chat, "❌ Não encontrei essa pergunta pendente. Verifique o ID e tente novamente.", { parse_mode: "Markdown" });
    } 
})

//#region metodos privados
function MontarPerguntasPendentes(snapshot){
    mensagensPendentes = [];
    var count = 1;
    snapshot.forEach(doc => {
        mensagensPendentes.push({
            id: count,
            doc: doc.id,
            data: doc.data()
        });
        count++;
    })   

    console.log(mensagensPendentes)
}
//#endregion

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

module.exports = app;