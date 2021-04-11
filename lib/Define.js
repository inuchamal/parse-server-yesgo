/**
 * Created by Marina on 27/09/2017.
 */

const response = require('./response');
const conf = require('config');
const Messages = require('./Locales/Messages.js');
// Parse.Object.prototype.version = "0.0.1";
const define = {
    User: Parse.User,
    PendingRegister: Parse.Object.extend("PendingRegister"),
    ErrorWebSocket: Parse.Object.extend("ErrorWebSocket"),
    Bonus: Parse.Object.extend("Bonus"),
    InDebtLog: Parse.Object.extend("inDebtLog"),
    BilletLog: Parse.Object.extend("BilletLog"),
    BonusDriver: Parse.Object.extend("BonusDriver"),
    BonusTravelHistory: Parse.Object.extend("BonusTravelHistory"),
    BonusLog: Parse.Object.extend("BonusLog"),
    Category: Parse.Object.extend("Category"),
    Vehicle: Parse.Object.extend("Vehicle"),
    Email: Parse.Object.extend("Email"),
    Document: Parse.Object.extend("Document"),
    UserDocument: Parse.Object.extend("UserDocument"),
    UserDiscount: Parse.Object.extend("UserDiscount"),
    Address: Parse.Object.extend("Address"),
    Travel: Parse.Object.extend("Travel"),
    Card: Parse.Object.extend("Card"),
    Fare: Parse.Object.extend("Fare"),
    Coupon: Parse.Object.extend("Coupon"),
    BankAccount: Parse.Object.extend("BankAccount"),
    Config: Parse.Object.extend("Config"),
    Payment: Parse.Object.extend("Payment"),
    Activity: Parse.Object.extend("Activity"),
    ContactUs: Parse.Object.extend("ContactUs"),
    Help: Parse.Object.extend("Help"),
    HelpFeedback: Parse.Object.extend("HelpFeedback"),
    Plan: Parse.Object.extend("Plan"),
    Message: Parse.Object.extend("Message"),
    City: Parse.Object.extend("City"),
    State: Parse.Object.extend("State"),
    Radius: Parse.Object.extend("Radius"),
    WebhookRecord: Parse.Object.extend("WebhookRecord"),
    PaymentModule: Parse.Object.extend("PaymentModule"),
    DeviceInfo: Parse.Object.extend("DeviceInfo"),
    PlanPurchased: Parse.Object.extend("PlanPurchased"),
    RegistrationFee: Parse.Object.extend("RegistrationFee"),
    HourCycle: Parse.Object.extend("HourCycle"),
    TransferLog: Parse.Object.extend("TransferLog"),
    MonthlyGain: Parse.Object.extend("MonthlyGain"),
    Logger: Parse.Object.extend("Logger"),
    WithdrawLog: Parse.Object.extend("WithdrawLog"),
    Graduation: Parse.Object.extend("Graduation"),
    Cancellation: Parse.Object.extend("Cancellation"),
    DismissTravel: Parse.Object.extend("DismissTravel"),
    PlaceCache: Parse.Object.extend("PlaceCache"),
    PredictionsCache: Parse.Object.extend("PredictionsCache"),
    GeocodingCache: Parse.Object.extend("GeocodingCache"),
    UserCode: Parse.Object.extend("UserCode"),
    Country: Parse.Object.extend("Country"),
    MaritalStatus: Parse.Object.extend("MaritalStatus"),
    userType: ["passenger", "driver", "admin"],
    userDocumentStatus: ["required", "sent", "approved", "rejected"],
    driverStatus: ["approved", "pending", "reject"],
    MAXDISTANCE: conf.MaxDistance,
    typeOfValue: {
        coupon: "percent",
        indicationCode: "money",
    },
    activities: {
        "newPassenger": "newPassenger",
        "newDriver": "newDriver",
        "travelRequest": "newRequest",
        "travelAccept": "acceptedTravel",
        "driverWaitingPassenger": "driverWaitingPassenger",
        "travelInit": "initTravel",
        "travelCancelByDriver": "cancelledByDriver",
        "travelCancelByPassenger": "cancelledByPassenger",
        "travelComplete": "completedTravel"
    },
    realTimeEvents: {
        travelStatusChange: "travelStatusChange",
        travelStopChange: "travelStopChange",
        userChanged: "userChanged",
        receivedTravel: "receivedTravel"
    },
    BONUSTYPE: {
        bigu: "bigu",
        uaimove: "uaimove",
        letsgo: "letsgo",
        yesgo: "yesgo",
        cheguei: "cheguei",
        upmobilidade: "upmobilidade",
        escapp: "escapp"
    },
    activityMessage: {
        newUser: "Acabou de se cadastrar",
        travelRequest: "Pediu táxi",
        travelAccept: "Aceitou a corrida",
        driverWaitingPassenger: "Informou chegada ao local de origem",
        travelInit: "Iniciou a corrida",
        travelCancel: "Cancelou a corrida",
        travelComplete: "Finalizou a corrida",
    },
    httpMethods: {
        POST: "POST",
        GET: "GET",
    },
    statusTopBank: {
        available: "available",
        sent: "sent",
        success: "success",
        fail: "fail"
    },
    getfakeCard: function (language) {
        return {
            card: (conf.bonusLevel && conf.bonusLevel.verifyValueOfBonusToUseInTravel) ? Messages(language).payment.BONUS : Messages(language).payment.MONEY,
            name: (conf.bonusLevel && conf.bonusLevel.verifyValueOfBonusToUseInTravel) ? Messages(language).payment.BONUS : Messages(language).payment.MONEY,
            brand: "",
            objectId: (conf.bonusLevel && conf.bonusLevel.verifyValueOfBonusToUseInTravel) ? "bonus" : "money",
            ids: ["bonus", "money"]
        }
    },
    fakeCard: {
        card: (conf.bonusLevel && conf.bonusLevel.verifyValueOfBonusToUseInTravel) ? "Bônus" : "Dinheiro",
        name: (conf.bonusLevel && conf.bonusLevel.verifyValueOfBonusToUseInTravel) ? "Bônus" : "Dinheiro",
        brand: "",
        objectId: (conf.bonusLevel && conf.bonusLevel.verifyValueOfBonusToUseInTravel) ? "bonus" : "money",
        ids: ["bonus", "money"]
    },
    getYesFakeCard: function(language){
        return [{
            card: Messages(language).payment.MONEY,
            name: Messages(language).payment.MONEY,
            brand: "",
            objectId: "money"
        }, {
            card: Messages(language).payment.BONUS,
            name: Messages(language).payment.BONUS,
            brand: "",
            objectId: "bonus"
        }]
    },
    yesFakeCard: [{
        card: "Dinheiro",
        name: "Dinheiro",
        brand: "",
        objectId: "money"
    }, {
        card: "Bônus",
        name: "Bônus",
        brand: "",
        objectId: "bonus"
    }],
    profileStage: {
        "1": "phoneValidation",
        "2": "legalConsent",
        "3": "personalData",
        "4": "category",
        "5": "vehicleData",
        "6": "incompleteDocs",
        "7": "completeDocs",
        "8": "approvedDocs",
        "9": ""
    },
    pushTypes: {
        "travelRequest": "newRequest",
        "travelAccept": "acceptedTravel",
        "driverWaitingPassenger": "driverWaitingPassenger",
        "travelInit": "initTravel",
        "scheduledTravelInit": "initScheduledTravel",
        "travelCancel": "cancelledTravel",
        "travelComplete": "completedTravel",
        "travelRate": "rate",
        "travelDismiss": "dismiss",
        "userCode": "indicationCode",
        "userBlocked": "blockedUser",
        "userUnblocked": "unblockedUser",
        "userDocsApproved": "approvedUserDocs",
        "userDocsRejected": "rejectedUserDocs",
        "userVehicleApproved": "approvedUserVehicle",
        "userVehicleRejected": "rejectedUserVehicle",
        "planEnding": "planEnding",
        "planFinished": "planFinished",
        "cpfValid": "cpfValid",
        "cpfInvalid": "cpfInvalid",
        "admin": "adminMessage",
        "cantReceiveTravel": "message",
        "oldLocation": "oldLocation",
        "sendAlertCNH": "sendAlertCNH",
        "offlineBySystem": "offlineBySystem",
        "willBeOffline": "willBeOffline"
    },
    emailByStage: {
        "alertBug": {
            "html": "alertBug",
            "subject": "Alerta de Bug na API - {{name}}"
        },
        "phoneValidation": {
            "html": "phone",
            "subject": "Concluir cadastro – Confirmar celular"
        },
        "legalConsent": {
            "html": "legalConsent",
            "subject": "Concluir cadastro – Consentimento Legal"
        },
        "personalData": {
            "html": "personalData",
            "subject": "Concluir cadastro – Dados pessoais"
        },
        "category": {
            "html": "category",
            "subject": "Concluir cadastro – Categoria"
        },
        "vehicleData": {
            "html": "vehicle",
            "subject": "Concluir cadastro – Cadastro de Veículo"
        },
        "incompleteDocs": {
            "html": "docsIncomplete",
            "subject": "Concluir cadastro – Cadastro de Documentos"
        }
    },
    emailHtmls: {
        "phoneValidation": {
            "html": "phone",
            "subject": "Concluir cadastro – Confirmar celular"
        },
        "completeDocs": {
            "html": "docsSent",
            "subject": "Cadastro concluído – Documentos cadastrados"
        },
        "docsApproved": {
            "html": "docsApproved",
            "subject": "Cadastro concluído – Documentos aprovados"
        },
        "docsApprovedMova": {
            "html": "docsApprovedMova",
            "subject": "Cadastro concluído – Documentos aprovados"
        },
        "docsApprovedUpMobilidade": {
            "html": "docsApprovedUpMobilidade",
            "subject": "Cadastro concluído – Documentos aprovados"
        },
        "docsRejected": {
            "html": "docsRejected",
            "subject": "Cadastro incompleto – Documentos reprovados"
        },
        "userBlocked": {
            "html": "userBlocked",
            "subject": "Usuário Bloqueado"
        },
        "userUnblocked": {
            "html": "userUnblocked",
            "subject": "Usuário Desbloqueado"
        },
        "withdraw": {
            "html": "withdraw",
            "subject": "Confirmação de Saque"
        },
        "withdrawError": {
            "html": "withdrawError",
            "subject": "Falha no Saque"
        },
        "plan": {
            "html": "plan",
            "subject": "Plano adquirido"
        },
        "fee": {
            "html": "registrationFee",
            "subject": "Taxa de inscrição adquirida"
        },
        "client_buy_plan": {
            "html": "client_buy_plan",
            "subject": "Plano adquirido por usuário"
        },
        "review": {
            "html": "review",
            "subject": "Atenção: você recebeu uma avaliação"
        },
        "password": {
            "html": "password",
            "subject": "Recuperação de senha"
        },
        "welcome": {
            "html": "welcome",
            "subject": "Seja bem vindo!"
        },
        "welcomeDriverMova": {
            "html": "welcome_driver_mova",
            "subject": "Seja bem vindo!"
        },
        "welcomeFemale": {
            "html": "welcome-female",
            "subject": "Seja bem vinda!"
        },
        "welcomeFemaleDriverMova": {
            "html": "welcome_female_driver_mova",
            "subject": "Seja bem vinda!"
        },
        "answerContact": {
            "html": "answerContact",
            "subject": "Você tem uma mensagem do suporte!"
        },
        "commentContact": {
            "html": "commentContact",
            "subject": "Fale conosco - {{name}} - {{id}}",
            "subject_en": "Contact us - {{name}} - {{id}}",
        },
        "presignup": {
            "html": "pre_signup",
            "subject": "Seja bem vindo!"
        },
        "receipt": {
            "html": "receipt",
            "subject": "Recibo de viagem",
            "subject_en": "Travel receipt"
        }
    },
    emailTypes: [
        "answerContact", "category", "client_buy_plan", "docsApproved", "docsIncomplete", "docsReject", "docsSent", "legalConsent", "password",
        "personalData", "phone", "plan", "pre_signup", "receipt", "registrationFee", "review", "userBlocked", "userUnblocked",
        "vehicle", "welcome", "welcome_female", "withdraw"
    ],
    MapsKey: conf.mapsKey,
    banks: {
        "001": "Banco do Brasil",
        "002": "Banco Central do Brasil",
        "003": "Banco da Amazônia",
        "004": "Banco do Nordeste do Brasil",
        "007": "Banco Nacional de Desenvolvimento Econômico e Social",
        "104": "Caixa Econômica Federal",
        "046": "Banco Regional de Desenvolvimento do Extremo Sul",
        "023": "Banco de Desenvolvimento de Minas Gerais",
        "070": "Banco de Brasília",
        "047": "Banco do Estado de Sergipe",
        "021": "Banco do Estado do Espírito Santo",
        "037": "Banco do Estado do Pará",
        "041": "Banco do Estado do Rio Grande do Sul",
        "075": "Banco ABN Amro S.A.",
        "025": "Banco Alfa",
        "719": "Banco Banif",
        "107": "Banco BBM",
        "318": "Banco BMG",
        "218": "Banco Bonsucesso",
        "208": "Banco BTG Pactual",
        "263": "Banco Cacique",
        "745": "Banco Citibank",
        "721": "Banco Credibel",
        "229": "Banco Cruzeiro do Sul",
        "707": "Banco Daycoval",
        "265": "Banco Fator",
        "224": "Banco Fibra",
        "121": "Banco Gerador",
        "612": "Banco Guanabara",
        "604": "Banco Industrial do Brasil",
        "320": "Banco Industrial e Comercial",
        "630": "Banco Intercap",
        "077": "Banco Intermedium",
        "M09": "Banco Itaucred Financiamentos",
        "389": "Banco Mercantil do Brasil",
        "746": "Banco Modal",
        "738": "Banco Morada",
        "623": "Banco Panamericano",
        "611": "Banco Paulista",
        "643": "Banco Pine",
        "638": "Banco Prosper",
        "654": "Banco Renner",
        "453": "Banco Rural",
        "422": "Banco Safra",
        "033": "Banco Santander",
        "637": "Banco Sofisa",
        "655": "Banco Votorantim",
        "237": "Bradesco",
        "399": "HSBC Bank Brasil",
        "505": "Banco Credit Suisse",
        "184": "Banco Itaú BBA",
        "479": "Banco ItaúBank",
        "741": "Banco Ribeirão Preto",
        "082": "Banco Topázio",
        "341": "Itaú Unibanco",
    }
};

module.exports = define;
