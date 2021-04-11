const conf = require('config');
const mailgun = require('mailgun-js')(conf.mailgun);
const response = require('./response');
var Mail = {
    sendEmail: function (toAddress, subject, body) {
        if (conf.disableSendEmail)
            return Promise.resolve();

        let promise = new Promise((resolve, reject) => {
            body = "<html>" + body + "<br>" +
                "</html>";
            let data = {
                from: (conf.mailgun.senderName || "Contato") + " <" + conf.mailgun.fromAddress.toLowerCase() + ">",
                to: toAddress,
                subject: subject,
                html: body
            };
            mailgun.messages().send(data, function (error, body) {
                if (error) {
                    resolve();
                } else {
                    resolve(true);
                }
            });
        });

        return promise;
    },
    addCustomFields: async function (data) {
        try {
            data = data || {};
            const Define = require('./Define.js');
            let qConfig = new Parse.Query(Define.Config);
            qConfig = await qConfig.first();

            data.appName = conf.appName;
            data.colorBG = qConfig.get("colorBG") || conf.colorBG;
            data.logoImage = qConfig.get("logoImage") || conf.logoImage;
            data.bannerImage = qConfig.bannerImage || conf.bannerImage;
            data.landingPage = qConfig.landingPage || conf.landingPage;
            data.termosDeUso = qConfig.termosDeUso || conf.termosDeUso;
            data.termosDeUsoDriver = qConfig.termosDeUsoDriver || conf.termosDeUsoDriver;
            data.termosDeUsoDriverPassenger = qConfig.termosDeUsoDriverPassenger || conf.termosDeUsoDriverPassenger;

            return await Promise.resolve(data);
        } catch (e) {
            return await Promise.reject(e);
        }
    },
    sendAlertOfPagarme: function (id, travelId) {
        let html = "<b> Falha na captura do pagamento!</b><br><br>";
        const ConfigClass = require('./Config.js').instance();
        html += "Houveram falhas durante a captura do pagamento. A viagem foi concluida, porém é necessario acessar o painel do PagarMe e capturar o valor manualmente!<br><br>"
        html += "<a href='https://dashboard.pagar.me/#/transactions/" + id + "'>Clique aqui para acessar detalhes do pagamento na PagarMe</a><br><br>";
        html += "<a href='" + conf.adminPage + "#/app/trip/" + travelId + "'>Clique aqui para acessar detalhes da viagem no Dashboard</a><br><br>";
        let promises = [];
        promises.push(Mail.sendEmail("patrick@usemobile.com.br", "Falha na captura do Pagamnto", html));
        return ConfigClass.getSupportEmail().then(function (supportEmail) {
            if (supportEmail)
                promises.push(Mail.sendEmail(supportEmail, "Falha na captura do Pagamnto", html));
            return Promise.all(promises)
        }).then(function () {
            return Promise.resolve(true);
        });
    },
    sendTemplateEmail: function (email, htmlFile, data, subject) {
        if (conf.disableSendEmail)
            return Promise.resolve();
        let _base, _data;
        const utils = require("./Utils.js");
        return Mail.addCustomFields(data).then(function (data) {
            _data = data;
            return utils.readHtml("base", _data)
        }).then(function (base) {
            _base = base;
            return utils.readHtml(htmlFile, _data)
        }).then(function (html) {
            _base = _base.replace("{{body}}", html);
            return Mail.sendEmail(email, subject, _base);
        });
    },
    sendTemplateReceiptEmail: function (email, htmlFile, data, subject) {
        return Mail.addCustomFields(data).then(function (data) {
            const utils = require("./Utils.js");
            return utils.readHtml(htmlFile, data)
        }).then(function (html) {
            return Mail.sendEmail(email, subject, html);
        }, function (error) {
            console.log(error);
        });
    }
};

module.exports = Mail;
