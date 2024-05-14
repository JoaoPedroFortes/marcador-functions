/* eslint-disable */
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { formatISO } = require("date-fns");

admin.initializeApp();

const authMiddleware = require('./authMiddleware');
const app = require('express')();
app.use(authMiddleware);

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true })

// SERVICOS
app.get("/servico", function (request, response) {
    const usuario =request?.user.user_id;
    const key = request.query.key;
    if (!key) response.status(400).json({ error: "Chave de acesso não informada" });
    db.collection("servico").get()
        .then(function (docs) {
            const servicos = [];
            docs.forEach(function (doc) {
                if (usuario === key) {
                    servicos.push({
                        id: doc.id,
                        descricao: doc.data().descricao,
                        nome: doc.data().nome,
                        usuario: usuario,
                        valor: doc.data().valor,
                    })
                }
            })
            response.json(servicos);
        });
})

const getDataFimByDataInicio = (datainicio) => {
    if(!datainicio) return undefined;
    const dataFim = new Date(JSON.parse(JSON.stringify(datainicio))) || new Date(); 
    dataFim.setMinutes(dataFim.getMinutes() + 40)
    const end = formatISO(dataFim);
    return end.slice(0,16);
}


async function criarEvento(evento) {
    try {
        await db.collection("evento").add(evento);
        return true;
    } catch (error) {
        return false;
    }
}

//AGENDAMENTOS
app.post("/agendamento", async function (request, response) {
    const body = request.body;
    const usuario =request?.user.user_id;
    if (!body) {
        response.status(500).json({ error: "Objeto não pode ser vazio" });
    }

    const { celular, dataInicioRecorrencia, diaAgendado, diaSemanaRecorrente, email, horaRecorrente, nome, servico, tipoAgendamento, tipoFrequencia } = body;
    const descricao = { celular, dataInicioRecorrencia, diaAgendado, diaSemanaRecorrente, email, horaRecorrente, nome, servico, tipoAgendamento, tipoFrequencia, usuario };
    try {
        const docRef = await db.collection("agendamento").add(descricao);
        const idAgendamento = docRef.id;
        const evento = {
            agendamento: idAgendamento,
            title: nome,
            usuario: usuario,
            start: diaAgendado,
            end: getDataFimByDataInicio(diaAgendado)
        };

        console.log(evento);
        const eventoCriado = await criarEvento(evento);
        if (eventoCriado) {
            response.json({ message: "Agendamento cadastrado e evento criado" });
        } else {
            response.status(500).json({ error: "Ocorreu um erro ao cadastrar o evento" });
        }
    } catch (error) {
        response.status(500).json({ error: "Ocorreu um erro ao cadastrar o agendamento" });
    }
})


exports.app = onRequest(app);
