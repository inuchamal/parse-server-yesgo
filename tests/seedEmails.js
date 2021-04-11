'use strict';
const Parse = require('parse/node');
const fs = require('fs');

Parse.initialize('FNIDBEI5GWNIDNIDA63OP5WNIDIDIWHNID');
//Parse.serverURL = 'http://api-dev-fedmilson.usemobile.com.br/use';
Parse.serverURL = 'http://localhost:1989/use';

let types = [
    "answerContact", "category", "client_buy_plan", "docsApproved", "docsIncomplete", "docsReject", "docsSent", "legalConsent", "password",
    "personalData", "phone", "plan", "pre_signup", "receipt", "registrationFee", "review", "userBlocked", "userUnblocked",
    "vehicle", "welcome", "welcome_female", "withdraw"
];

let promises = [];

let emails = [
    {
        "html": "phone",
        "subject_pt": "Concluir cadastro – Confirmar celular",
        "subject_en": "Complete Registration - Verify Mobile",
        "keys": ["{{phone}}", "{{landingPage}}"]
    },
    {
        "html": "docsSent",
        "subject_pt": "Cadastro concluído – Documentos cadastrados",
        "subject_en": "Registration completed - Registered Documents",
        "keys": ["{{name}}", "{{appName}}"]
    },
    {
        "html": "docsApproved",
        "subject_pt": "Cadastro concluído – Documentos aprovados",
        "subject_en": "Registration completed - Approved Documents",
        "keys": ["{{name}}", "{{appName}}", "{{landingPage}}"]
    },
    {
        "html": "docsRejected",
        "subject_pt": "Cadastro incompleto – Documentos reprovados",
        "subject_en": "Incomplete Signup - Disapproved Documents",
        "keys": ["{{name}}", "{{appName}}", "{{landingPage}}"]
    },
    {
        "html": "userBlocked",
        "subject_pt": "Usuário Bloqueado",
        "subject_en": "Blocked user",
        "keys": ["{{name}}", "{{landingPage}}"]
    },
    {
        "html": "userUnblocked",
        "subject_pt": "Usuário Desbloqueado",
        "subject_en": "Unlocked User",
        "keys": ["{{name}}", "{{landingPage}}"]
    },
    {
        "html": "withdraw",
        "subject_pt": "Confirmação de Saque",
        "subject_en": "Withdrawal Confirmation",
        "keys": ["{{name}}", "{{value}}", "{{date}}", "{{owner}}", "{{bank}}", "{{ag}}", "{{acc}}", "{{landingPage}}"]
    },
    {
        "html": "plan",
        "subject_pt": "Plano adquirido",
        "subject_en": "Plan acquired",
        "keys": ["{{name}}", "{{plan}}", "{{value}}", "{{date}}", "{{landingPage}}"]
    },
    {
        "html": "registrationFee",
        "subject_pt": "Taxa de inscrição adquirida",
        "subject_en": "Purchase Application Fee",
        "keys": ["{{name}}", "{{plan}}", "{{value}}", "{{landingPage}}"]
    },
    {
        "html": "client_buy_plan",
        "subject_pt": "Plano adquirido por usuário",
        "subject_en": "User Acquired Plan",
        "keys": ["{{link}}", "{{name}}", "{{plan}}", "{{value}}", "{{landingPage}}"]
    },
    {
        "html": "review",
        "subject_pt": "Atenção: você recebeu uma avaliação",
        "subject_en": "Please note: you have received a review",
        "keys": ["{{name}}", "{{landingPage}}"]
    },
    {
        "html": "password",
        "subject_pt": "Recuperação de senha",
        "subject_en": "Recover password",
        "keys": ["{{email}}", "{{url}}", "{{appName}}", "{{landingPage}}"]
    },
    {
        "html": "welcome",
        "subject_pt": "Seja bem vindo!",
        "subject_en": "Welcome!",
        "keys": ["{{appName}}", "{{landingPage}}"]
    },
    {
        "html": "welcome_female",
        "subject_pt": "Seja bem vinda!",
        "subject_en": "Welcome!",
        "keys": ["{{appName}}", "{{landingPage}}"]
    },
    {
        "html": "answerContact",
        "subject_pt": "Você tem uma mensagem do suporte!",
        "subject_en": "You have a support message!",
        "keys": ["{{name}}", "{{message}}"]
    },
    {
        "html": "pre_signup",
        "subject_pt": "Seja bem vindo!",
        "subject_en": "Welcome!",
        "keys": ["{{appName}}", "{{name}}", "{{email}}", "{{password}}", "{{landingPage}}"]
    },
    {
        "html": "vehicle",
        "subject_pt": "Cadastro de veículo",
        "subject_en": "Vehicle Registration",
        "keys": ["{{appName}}", "{{landingPage}}"]
    },
    {
        "html": "personalData",
        "subject_pt": "Concluir cadastro",
        "subject_en": "Complete registration",
        "keys": ["{{appName}}", "{{landingPage}}"]
    },
    {
        "html": "docsIncomplete",
        "subject_pt": "Documentação incompleta",
        "subject_en": "Incomplete Documentation",
        "keys": ["{{name}}", "{{appName}}", "{{landingPage}}"]
    },
    {
        "html": "legalConsent",
        "subject_pt": "Consetimento legal",
        "subject_en": "Legal consent",
        "keys": ["{{appName}}", "{{landingPage}}"]
    },
    {
        "html": "receipt",
        "subject_pt": "Recibo",
        "subject_en": "Receipt",
        "keys": [
            "{{colorBG}}", "{{date}}", "{{time}}", "{{payment}}", "{{streetOrigin}}", "{{numberOrigin}}",
            "{{neighborhoodOrigin}}", "{{cityOrigin}}", "{{streetDestination}}", "{{numberDestination}}",
            "{{neighborhoodDestination}}", "{{cityDestination}}", "{{valueWithoutFee}}", "{{values}}",
            "{{paymentData}}", "{{valueWithFee}}",
        ]
    },
    {
        "html": "category",
        "subject_pt": "Escolha sua categoria",
        "subject_en": "Choose your category",
        "keys": ["{{appName}}", "{{landingPage}}"]
    },

];

console.log("Número de emails: ", emails.length);
console.log("Número de types: ", types.length);

function readdirAsync(path) {
    return new Promise(function (resolve, reject) {
        fs.readFile(path, "utf8", function (error, result) {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}

const saveEmails = (object) => {
    let body_pt, body_en;
    return readdirAsync("../mails/" + object.html + ".html").then(function (body) {
        body_pt = body;
        return readdirAsync("../mails/" + object.html+"_en.html");
    }).then(function (body){
        body_en = body;

        let email = new Parse.Object("Email");
        email.set("subject_pt", object.subject_pt);
        email.set("body_pt", body_pt);
        email.set("subject_en", object.subject_en);
        email.set("body_en", body_en);
        email.set("subject_default_pt", object.subject_pt);
        email.set("body_default_pt", body_pt);
        email.set("subject_default_en", object.subject_en);
        email.set("body_default_en", body_en);
        email.set("type", object.html);
        email.set("keys", object.keys);

        return Promise.resolve(email);
    }, function (error) {
        console.log(error);
    });

};

for (let i = 0; i < emails.length; i++) {
    promises.push(saveEmails(emails[i]));
}

Promise.all(promises).then(function (objects) {
    return Parse.Object.saveAll(objects);
}).then(function () {
    console.log("Sucesso");
}, function (error) {
    console.log(error);
});