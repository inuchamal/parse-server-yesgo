'use strict';
const utils = require("../Utils.js");
const conf = require("config");
const Define = require('../Define.js');
const Messages = require('../Locales/Messages.js');
const API_MATRIZ = conf.IdWall.matriz;
const API_BASE = conf.IdWall.api_base;
const API_TOKEN = conf.IdWall.token;
'use strict';

function IDWall() {
    var _super = {
        _methods: {
            search: "relatorios",
        },
        STATUS: {
            WAITING: "PENDENTE",
            PROCESSING: "EM ANALISE",
            COMPLETED: "CONCLUIDO",
            VALID: "VALID",
            MANUAL_APPROVAL: "MANUAL_APPROVAL",
            INVALID: "INVALID",
        },
        makeRequest: function (method, name, params) {
            let jsonRequest = {
                url: API_BASE + name,
                body: params,
                json: true,
                method: method
            };
            jsonRequest.headers = {Authorization: API_TOKEN};
            jsonRequest.headers["content-type"] = "application/json";
            return Parse.Cloud.httpRequest(jsonRequest).then(function (data) {
                return Promise.resolve(data.data.result)
            }, function (error) {
                return Promise.reject(error.data);
            });
        },
        search: function (cpf) {
            let body = {
                "matriz": API_MATRIZ,
                "parametros": {
                    "cpf_numero": cpf
                }
            }
            return _super.makeRequest(Define.httpMethods.POST, _super._methods.search, body);
        },
        status: function (number) {
            return _super.makeRequest(Define.httpMethods.GET, _super._methods.search + "/" + number);
        },
        retrieveData: function (protocol) {
            return _super.makeRequest(Define.httpMethods.GET, _super._methods.search + "/" + protocol + "/dados");
        },
        approveUser: function (cpf, isValid) {
        },
        processWebhook: function (data) {
            let webhook = new Define.WebhookRecord();
            webhook.set("system", "idwall");
            webhook.set("idPostback", data.id);
            webhook.set("event", data.dados.status);
            webhook.set("body", data.dados);
            return webhook.save().then(function () {
                let status = data.dados.status;
                if (status === _super.STATUS.COMPLETED) {
                    return _super.retrieveData(data.dados.protocolo).then(function (data) {
                        if (!data.cpf) return Promise.resolve();
                        if (data.resultado === _super.STATUS.MANUAL_APPROVAL)
                            data.resultado = _super.STATUS.VALID;
                        return require("../User").instance().approveUserCPF(data.cpf.numero, data.resultado, data.resultado === _super.STATUS.VALID);
                    });
                } else {
                    return Promise.resolve();
                }
            });
        },
        publicMethods: {}
    };
    return _super;
}

exports.instance = IDWall;
