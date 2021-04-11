'use strict';
const Parse = require('parse/node');
const base64 = require('file-base64');
const Define = require('../lib/Define');
const {config} = require('./config.js');
const url = config.server;
Parse.initialize(config.appId, null, config.masterKey);
// Parse.serverURL = 'http://api.yesgo.com.br/use';
Parse.serverURL = url;

module.exports = async () => {
    let defaultPlan = new Define.Plan();
    defaultPlan.set({
        default: true,
        period: 'por mês',
        percent: 20,
        active: true,
        name: 'default',
        value: 0,
        duration: 0
    });

    let defaultConfig = new Define.Config();
    defaultConfig.set({
        indicationDiscount : 10,
        shareTextDriver : "Olha esse aplicativo que eu encontrei",
        shareTextPassenger : "Baixe o Cheguei Mobilidade na AppStore ou Google Play. \n\n Simples, fácil, rápido e perto!\n\n Utilize meu código de indicação no momento do cadastro: {{code}}\n\n http://cheguei.net",
        numberOfRecentAddresses : 5,
        cancellationFee : 0,
        splitCall : {type: "auction"},
        rulesToRecalculate: {enabled: false}
    });

    let cat = await defaultPlan.save(null, {useMasterKey: true});
    let confIndication = await defaultConfig.save(null, {useMasterKey: true});

    let admin = new Parse.User();
    await new Promise(async (resolve, reject) => {
        try {
            await admin.signUp({
                username: 'Talita.Moreira51@bol.com.br',
                email: 'Talita.Moreira51@bol.com.br',
                password: '4kBlduiO6V7jddJ',
                isAdmin: true,
                name: 'admin',
                phone: '31993501961',
                cpf: '08643257621',
                userLevel: 'admin',
                fullName: 'admin usemobile'
            })
            console.log('complete')
            resolve()
        } catch (e) {
            reject(e)
        }
    })

};

// base64.encode('C:/Users/usemobile/Downloads/Termo_Motorista_Yesgo_2019.pdf', function (err, base64String) {
//     let parseFile = new Parse.File('term.pdf', {base64: base64String});
//     parseFile.save().then(function (file) {
//         console.log("Termo de uso salvo na seguinte url: " + file._url);
//     })
// });
