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


const getDataFimByDataInicio = (datainicio) => {
    if (!datainicio) return undefined;
    const dataFim = new Date(JSON.parse(JSON.stringify(datainicio))) || new Date();
    dataFim.setMinutes(dataFim.getMinutes() + 40)
    const end = formatISO(dataFim);
    return end.slice(0, 16);
}

//EVENTOS
async function criarEvento(evento) {
    try {
        await db.collection("evento").add(evento);
        return true;
    } catch (error) {
        return false;
    }
}

//agendamento by id
async function getAgendamentoById(idAgendamento) {
    try {
        return await db.collection("agendamento").doc(idAgendamento).get().then((doc) => {
            if (doc.exists) {
                return doc.data();
            } else {
                return undefined
            }
        }).catch((error) => {
            console.log("Erro:", error);
        })
    } catch (error) {
        return undefined;
    }
}

app.get("/evento", async function (request, response) {
    try {
        const usuario = request?.user?.user_id;
        const snapshot = await db.collection("evento").where("usuario", "==", usuario).get();

        const eventosPromises = snapshot.docs.map(async doc => {
            const data = doc.data();

            const evento = data;
            evento.usuario = undefined;
            if (evento.agendamento) {
                evento.agendamento = await getAgendamentoById(evento.agendamento);
            }
            console.log('evento: ', evento);
            return evento;

        });

        const eventos = (await Promise.all(eventosPromises)).filter(evento => evento !== undefined);

        response.json(eventos);
    } catch (error) {
        console.error('Error fetching events:', error);
        response.status(500).send('Internal Server Error');
    }
});

// SERVICOS
app.get("/servico", function (request, response) {
    const usuario = request?.user.user_id;
    db.collection("servico").where("usuario", "==", usuario).get()
        .then(function (docs) {
            const servicos = [];
            docs.forEach(function (doc) {
                servicos.push({
                    id: doc.id,
                    descricao: doc.data().descricao,
                    nome: doc.data().nome,
                    usuario: usuario,
                    valor: doc.data().valor,
                })

            })
            response.json(servicos);
        });
})

app.post("/servico", async function (request, response) {
    if(!request.body) response.status(500).json({ error: "Objeto não pode ser vazio" });
    
    const usuario = request?.user.user_id;
    const { descricao, nome, valor } = request.body;
    const servico = { descricao, nome, valor, usuario };

    try {
        const servicoAdicionado = await db.collection("servico").add(servico);
        if (servicoAdicionado) {
            response.json("Serviço adicionado com sucesso;")
        } else {
            response.status(500).json({ error: "Ocorreu um erro ao cadastrar o serviço" });
        }
    } catch (error) {
        response.status(500).json({ error: "Ocorreu um erro ao cadastrar o serviço" });
    }

})



//AGENDAMENTOS
app.get("/agendamento", function (request, response) {
    const usuario = request?.user.user_id;

    try {
        db.collection("agendamento").where("usuario", "==", usuario).get().then((docs) => {
            const agendamentos = [];
            docs.forEach(function (doc) {

                const agendamento = doc.data();
                agendamento.usuario = undefined;
                agendamento.id = doc.id;
                agendamentos.push(agendamento);

            })
            response.json(agendamentos);
        });;

    } catch (error) {
        response.status(500).json({ error: "Ocorreu um erro ao recuperar os agendamentos" });
    }
});


app.post("/agendamento", async function (request, response) {
    const body = request.body;
    const usuario = request?.user.user_id;
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
});


exports.app = onRequest(app);
