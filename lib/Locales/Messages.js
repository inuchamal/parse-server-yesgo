const conf = require('config');

function Messages(language) {

    //verificando se o app e multilingue
    if (conf.appIsMultilingual || (conf.appName.toLowerCase() === "flipmob")) {
        language = language || "pt_br";
    } else if (conf.appName.toLowerCase() === "diuka") {
        if (language === "pt") language = "pt_ao";
        else language = language || "pt_ao";
    } else {
        language = "pt_br";
    }

    switch (language) {
        case "br":
        case "pt_br":
        case "pt":
            return require('./pt_br.js');
        case "pt_ao":
            return require('./pt_ao.js');
        case "us":
        case "en":
        case "en_en":
            return require('./en_en.js');
        case "es_es":
        case "es":
            return require('./es_es.js');
        default:
            return require('./pt_br.js');
    }
}

module.exports = Messages;