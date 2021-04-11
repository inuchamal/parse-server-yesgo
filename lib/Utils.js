const Define = require('./Define.js');
const Messages = require('./Locales/Messages.js');
const Mail = require('./mailTemplate.js');
const fs = require('fs');
const conf = require('config');
const pdf2png = require('pdf2png');
const html2pdf = require('html-pdf');
const os = require("os");
const crypto = require('crypto');
const iv = crypto.randomBytes(16);
const secretKey = "74F9969B759C644EF482829CD5C7EUNR";
const response = require('./response');
let Utils = {
    oldVersion: async (user) => {
        try {
            let appVersion;
            const deviceInfo = await Utils.findObject(Define.DeviceInfo, {user: user}, true, null, null, "updatedAt");
            if (deviceInfo && deviceInfo.get("manufacturer").toLowerCase() === "apple")
                return true;
            else {
                const userVersion = user.get("lastAppVersion");
                if (conf.appName.toLowerCase() === "cheguei") appVersion = 2022;
                else if (conf.appName.toLowerCase() === "flipmob") appVersion = 2024;
                else if (conf.appName.toLowerCase() === "mobdrive") appVersion = 2008;
                else if (conf.appName.toLowerCase() === "mova") appVersion = 4024;
                else if (conf.appName.toLowerCase() === "one") appVersion = 2016;
                else if (conf.appName.toLowerCase() === "022") appVersion = 2002;
                else if (conf.appName.toLowerCase() === "princessdriver") appVersion = 1056;
                else if (conf.appName.toLowerCase() === "upmobilidade") appVersion = 2018;
                else if (conf.appName.toLowerCase() === "yesgo") appVersion = 2030;
                else if (conf.appName.toLowerCase() === "uaimove") appVersion = 1048;
                else if (conf.appName.toLowerCase() === "ubx") appVersion = 1008;
                else if (conf.appName.toLowerCase() === "onecorporativo") appVersion = 2006;
                else if (conf.appName.toLowerCase() === "demodev" ||
                    conf.appName.toLowerCase() === "diuka" ||
                    conf.appName.toLowerCase() === "podd" ||
                    conf.appName.toLowerCase() === "escapp")
                    return false;
                else
                    return true;
                return userVersion < appVersion;
            }
        } catch (error) {
            console.log(error);
            return true;
        }
    },
    getMode: (array) => {
        let frequency = {}; // array of frequency.
        let maxFreq = 0; // holds the max frequency.
        let minFreq = 0; // holds the min frequency.
        let modes = [];

        for (let i in array) {
            frequency[array[i]] = (frequency[array[i]] || 0) + 1; // increment frequency.

            if (frequency[array[i]] > maxFreq) { // is this frequency > max so far ?
                maxFreq = frequency[array[i]]; // update max.
            }
            if (minFreq <= maxFreq - 1) { // is this frequency > max so far ?
                minFreq = maxFreq - 1; // update max.
            }
        }

        for (let k in frequency) {
            if (frequency[k] <= maxFreq && (frequency[k] >= minFreq)) {
                modes.push(k);
            }
        }

        return modes;
    },
    validateLocation: (location) => {
        try {
            if (!location || !location.latitude || !location.longitude)
                return false;
            return Utils.validateLatitude(location.latitude) && Utils.validateLongitude(location.longitude);
        } catch (e) {
            return false;
        }
    },
    validateLatitude: (lat) => {
        const regex = /^-?([1-8]?[1-9]|[1-9]0)\.{1}\d{1,15}/g;
        return regex.test(lat) && typeof lat === "number" && !isNaN(lat);
    },
    validateLongitude: (lng) => {
        const regex = /^-?(([-+]?)([\d]{1,3})((\.)(\d+))?)/g;
        return regex.test(lng) && typeof lng === "number" && !isNaN(lng);
    },
    saveUserLocation: async ({latitude, longitude, appVersion}, user) => {
        try {
            if (user && user.get("isDriver") && user.get("isDriverApp") && Utils.validateLatitude(latitude) && Utils.validateLongitude(longitude)) {
                const location = new Parse.GeoPoint({
                    latitude: latitude,
                    longitude: longitude
                });
                user.set("lastLocationDate", new Date());
                user.set("location", location);
                if (appVersion && typeof appVersion === 'string')
                    user.set("lastAppVersion", parseInt(appVersion.split(".").join("")));
                await user.save(null, {useMasterKey: true});
            }
        } catch (e) {
            console.log("Error in save location on end point.");
        }
    },
    getDuration: (date1, date2) => {
        try {
            const d = date2 - date1;
            const weekdays = Math.floor(d / 1000 / 60 / 60 / 24 / 7);
            const days = Math.floor(d / 1000 / 60 / 60 / 24 - weekdays * 7);
            const hours = Math.floor(d / 1000 / 60 / 60 - weekdays * 7 * 24 - days * 24);
            const minutes = Math.floor(d / 1000 / 60 - weekdays * 7 * 24 * 60 - days * 24 * 60 - hours * 60);
            const seconds = Math.floor(d / 1000 - weekdays * 7 * 24 * 60 * 60 - days * 24 * 60 * 60 - hours * 60 * 60 - minutes * 60);
            const milliseconds = Math.floor(d - weekdays * 7 * 24 * 60 * 60 * 1000 - days * 24 * 60 * 60 * 1000 - hours * 60 * 60 * 1000 - minutes * 60 * 1000 - seconds * 1000);
            let t = {};
            ['weekdays', 'days', 'hours', 'minutes', 'seconds', 'milliseconds'].forEach(q => {
                if (eval(q) > 0) {
                    t[q] = eval(q);
                }
            });
            return t;
        } catch (e) {
            console.log("Error in get duration: ", e);
            return {};
        }
    },
    verifyAppVersion: (curr = null, required = null) => {
        try {
            if (!curr || !required || typeof curr !== "string" || typeof required !== "string") return false;
            let _result;
            const versionNumbers = (str) => {
                return str.split(".")
                    .map((item) => parseInt(item))
            };

            const currValues = versionNumbers(curr);
            const requiredValues = versionNumbers(required);
            if (currValues.length !== requiredValues.length) return false;

            const verifyItem = (item, index) => {
                if (!item && item !== 0) return false;
                if (item === NaN) return false;
                if (!requiredValues[index] && requiredValues[index] !== 0) return false;
                if (requiredValues[index] === NaN) return false;
                return item > requiredValues[index] ? "bigger" : item < requiredValues[index] ? "smaller" : "equal";
            };

            const results = currValues.map((item, index) => {
                return verifyItem(item, index);
            });
            for (let i = 0; i < results.length; i++) {
                if (!results[i]) {
                    _result = false;
                    break;
                } else {
                    if (results[i] === "smaller") {
                        _result = false;
                        break;
                    } else if (results[i] === "bigger") {
                        _result = true;
                        break;
                    } else
                        _result = true;
                }
            }

            return _result;
        } catch (e) {
            return false;
        }
    },
    formatOrder: async (_params) => {
        if (_params.order) {
            if (_params.order[0] === "+") _params.ascendingBy = _params.order.substring(1);
            else if (_params.order[0] === "-") _params.descendingBy = _params.order.substring(1);
        }
    },

    findObjectOrQueries: async (className, conditionObj, firstCommand, ascendingBy, descendingBy, limit, page, queries) => {
        let query = new Parse.Query(className);
        if (conditionObj) {
            for (let key in conditionObj) {
                query.equalTo(key, conditionObj[key]);
            }
        }
        if (ascendingBy) query.ascending(ascendingBy);
        if (descendingBy) query.descending(descendingBy);
        if (queries) {
            query = await Utils.createOrQuery(queries);
        }
        limit = limit || 9999999;
        query.limit(limit); //CAN'T CHANGE THIS BECAUSE OF MANUAL PAGINATION WITH COUNTING
        if (page)
            query.skip(page);
        return firstCommand ? query.first() : query.find({useMasterKey: true});
    },

    formatParamsStateAndCity: async (_params, object, stateInicials) => {
        _params.isPrimary = (!_params.city && !_params.state) && (!_params.stateId);
        if (_params.stateId) {
            const state = await Utils.getObjectById(_params.stateId, Define.State) || undefined;
            _params.state = stateInicials ? state.get("sigla") : (state.get("name")).trim();
            if (_params.cityId) {
                const city = await Utils.getObjectById(_params.cityId, Define.City) || undefined;
                _params.city = (city.get("name")).trim();
            } else object.unset("city");
        } else if (_params.state) {
            _params.state = Utils.removeDiacritics(_params.state).trim();
            if (_params.city) _params.city = (_params.city).trim();
            else object.unset("city");
        } else {
            object.unset("state");
            object.unset("city");
        }
        delete _params.stateId;
        delete _params.cityId;

    },
    getStateAndCity: async (output, object) => {
        let state;
        if (object.get("state") && object.get("state").length < 4) {
            state = object.get("state") ? await Utils.findObject(Define.State, {"sigla": Utils.removeDiacritics(object.get("state").trim())}, true) : undefined;
        } else {
            state = object.get("state") ? await Utils.findObject(Define.State, {"searchName": Utils.removeDiacritics(object.get("state").toLowerCase().trim())}, true) : undefined;
        }
        const city = object.get("state") && object.get("city") ? await Utils.findObject(Define.City, {
            "searchName": Utils.removeDiacritics(object.get("city").toLowerCase().trim()),
            "state": state
        }, true) : undefined;
        output.stateId = state ? state.id : undefined;
        output.cityId = city ? city.id : undefined;

    },
    verifyIsoDate: (str = null) => {
        if (!str) return false;
        return (new Date(str) !== "Invalid Date") && !isNaN(new Date(str));
    },
    getTravelsTolistRecentAddresses: (type, user) => {
        let queryTravel = new Parse.Query(Define.Travel);
        queryTravel.equalTo(type, user);
        queryTravel.descending("createdAt");
        queryTravel.equalTo("status", "completed");
        queryTravel.limit(100);
        queryTravel.include(["destination"]);
        queryTravel.select(["destination", "destinationJson"]);
        return queryTravel.find();
    },
    cleanObject: (obj) => {
        obj = null;
        return obj;
    },
    formatMobileFieldReceipt: (type, language, name, value) => {
        let field = Messages(language).receipt[type][name];
        let output = {
            name: field,
            value
        };
        return output;
    },
    formatWebFieldReceipt: (type, language, name, value, specialField) => {
        let field = Messages(language).receipt[type][name];
        value = value && typeof value === "number" ? value.toFixed(2) : 0.00;
        let currency = Messages(language).receipt.currency;
        let output;
        if (!specialField)
            output = " <div style=\"float: left;\">" + field + "</div>" +
                " <div style=\"float: right; margin-right: 20px;\">" + currency + " " + value + "</div>\n <br>";
        else
            output = " <br><div style=\"float: left; color: #333;\"><b>" + field + "</b></div>\n" +
                " <div style=\"float: right; margin-right: 20px; color: #333;\"><b>" + currency + " " + value + "</b></div>";
        return output;
    },
    formatPaymentData: (travel, date, month, language) => {
        let output, paymentData = Messages(language).receipt.typePayment;
        if (travel.has("card")) {
            output = "                    <td>\n" +
                "                        <span class=\"dark\">" + travel.get("card").get("brand") + " " + travel.get("card").get("numberCrip").slice(15) + "</span><br>\n" +
                date.getDate() + "/" + month + "/" + date.getFullYear() + " " + date.getHours() + ":" + (date.getMinutes() < 10 ? '0' + date.getMinutes().toString() : date.getMinutes()) + "</td>\n";
        } else {
            output = "                    <td>\n" +
                "                        <span class=\"dark\"> " + paymentData + "</span><br>\n" +
                travel.get("endDate").getDate() + "/" + month + "/" + date.getFullYear() + " " + date.getHours() + ":" + (date.getMinutes() < 10 ? '0' + date.getMinutes().toString() : date.getMinutes()) + "</td>\n";
        }
        return output;
    },
    encrypt: (text) => {
        let cipher = crypto.createCipheriv('aes-256-cbc',
            new Buffer(secretKey), iv);
        let crypted = cipher.update(text, 'utf8', 'hex');
        crypted += cipher.final('hex');
        return crypted;
    },
    decrypt: (text) => {
        let decipher = crypto.createDecipheriv('aes-256-cbc',
            new Buffer(secretKey), iv);
        let decrypted = decipher.update(text, 'hex', 'utf8');
        return (decrypted + decipher.final('utf8'));

    },
    setTimezone: function (date, offset) {
        return new Date(date.getTime() + (offset * 60000));
    },
    printLogAPI: function (request) {

        console.log("\n-->> METHOD: ", request.functionName);
        console.log("-->> JSON: ", request.params);
        console.log("-->> USER: ", request.user ? request.user.id : "Not logged")
    },
    sendEmailByStage: function (user) {
        let data = {
            phone: user.get("phone"),
            name: user.get("name") || Utils.capitalizeFirstLetter(user.get("email").replace(/[\W_]+/, " ").split(" ")[0])
        };

        return Mail.sendTemplateEmail(user.get("email"), Define.emailByStage[user.get("profileStage")].html, data, Define.emailByStage[user.get("profileStage")].subject);
        // return Utils.readHtml(Define.emailByStage[user.get("profileStage")].html, data).then(function (htmlBody) {
        //     return Mail.sendEmail(user.get("email"), Define.emailByStage[user.get("profileStage")].subject, htmlBody);
        // });
    },
    sendEmailAlertBug: async (msg) => {
        let emails = "axel.andrade@usemobile.xyz,ana.moraes@usemobile.xyz,mateus.freire@usemobile.xyz,patrick+xyz@usemobile.com.br";
        await Mail.sendTemplateEmail(emails, Define.emailByStage.alertBug.html, {msg}, Define.emailByStage.alertBug.subject.replace("{{name}}", conf.appName));
    },
    getMonth: function (date, language) {
        date = date || new Date();
        let months;
        switch (language) {
            case "us":
            case "en":
            case "en_en":
                months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                break;
            case "es_es":
            case "es":
                months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                break;
            default:
                months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        }
        return months[date.getMonth()];
    },
    addOffsetToDate: function (date, offset) {
        let newDate = new Date(date); //just in case it is a string
        return new Date(newDate.setMinutes(newDate.getMinutes() + offset));
    },
    getObjectById: function (id, className, includes, equals, contains, select) {
        let query = new Parse.Query(className);
        if (select) {
            query.select(select);
        }
        if (includes) {
            query.include(includes);
        }
        if (equals) {
            for (let key in equals) {
                query.equalTo(key, equals[key]);
            }
        }
        if (contains) {
            for (let key in contains) {
                query.containedIn(key, contains[key]);
            }
        }
        return query.get(id, {useMasterKey: true});
    },
    findObjects: function ({className, conditionObj, firstCommand, include, ascendingBy, descendingBy, contained, notEq, limit, exists, contains, page, select}) {
        return Utils.findObject(className, conditionObj, firstCommand, include, ascendingBy, descendingBy, contained, notEq, limit, exists, contains, page, select);
    },
    findObject: function (className, conditionObj, firstCommand, include, ascendingBy, descendingBy, contained, notEq, limit, exists, contains, page, select, matches) {
        let query = new Parse.Query(className);
        if (conditionObj) {
            for (let key in conditionObj) {
                query.equalTo(key, conditionObj[key]);
            }
        }
        if (include) {
            query.include(include);
        }
        if (select) query.select(select);
        if (ascendingBy) query.ascending(ascendingBy);
        if (descendingBy) query.descending(descendingBy);
        if (contained) {
            for (let key in contained) {
                query.containedIn(key, contained[key]);
            }
        }
        if (contains) {
            for (let key in contains) {
                query.contains(key, contains[key]);
            }
        }
        if (matches) {
            for (let match in matches) {
                query.matches(match, matches[match], "i");
            }
        }
        if (exists) {
            (!Array.isArray(exists)) && (exists = [exists]);
            for (let i = 0; i < exists.length; i++) {
                query.exists(exists[i]);
            }
        }
        if (notEq) {
            for (let key in notEq) {
                query.notEqualTo(key, notEq[key]);
            }
        }
        limit = limit || 9999999;
        query.limit(limit); //CAN'T CHANGE THIS BECAUSE OF MANUAL PAGINATION WITH COUNTING
        if (page)
            query.skip(page);
        return firstCommand ? query.first() : query.find({useMasterKey: true});
    },
    convertDateToPsql: function (date) {
        let d = new Date(date),
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();

        if (month.length < 2)
            month = '0' + month;
        if (day.length < 2)
            day = '0' + day;

        return [year, month, day].join('-') + ((d.toLocaleString().split(',')[1] != undefined) ? d.toLocaleString().split(',')[1] : '');
    },
    countObject: function (className, conditionObj, contained, exists, greaterThanOrEqualTo, matches) {
        let query = new Parse.Query(className);
        if (conditionObj) {
            for (let key in conditionObj) {
                query.equalTo(key, conditionObj[key]);
            }
        }
        if (contained) {
            for (let key in contained) {
                query.containedIn(key, contained[key]);
            }
        }
        if (greaterThanOrEqualTo) {
            for (let key in greaterThanOrEqualTo) {
                query.greaterThanOrEqualTo(key, greaterThanOrEqualTo[key]);
            }
        }
        if (exists) {
            (!Array.isArray(exists)) && (exists = [exists]);
            for (let i = 0; i < exists.length; i++) {
                query.exists(exists[i]);
            }
        }
        if (matches) {
            for (let match in matches) {
                query.matches(match, matches[match], "i");
            }
        }

        return query.count({useMasterKey: true});
    },
    verifyRequiredFields: function (arrayFields, requiredFields, response) {
        let missingFields = [];
        for (let i = 0; i < requiredFields.length; i++) {
            if (arrayFields[requiredFields[i]] == null) {
                missingFields.push(requiredFields[i]);
            }
        }
        if (missingFields.length > 0) {
            return response.error(600, "Field(s) '" + missingFields + "' are required.");
            return false;
        }
        return true;
    },
    verifyStringNull: function (text) {
        return text == undefined ? "" : text;
    },
    verifyCNPJ: function (c) {
        let b = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

        if ((c = c.replace(/[^\d]/g, "")).length != 14)
            return false;

        if (/0{14}/.test(c))
            return false;
        let n = 0;
        for (let i = 0; i < 12; n += c[i] * b[++i]) ;
        if (c[12] != (((n %= 11) < 2) ? 0 : 11 - n))
            return false;
        n = 0;
        for (let i = 0; i <= 12; n += c[i] * b[i++]) ;
        if (c[13] != (((n %= 11) < 2) ? 0 : 11 - n))
            return false;

        return true;
    },

    verifyBilletId: function (strBillet) {
        return strBillet.length === 14 && !isNaN(strBillet.substr(0, 9)) && isNaN(strBillet.substr(9, 11)) && !isNaN(strBillet.substr(11, 14));
    },

    verifyCi: function (strCi) {
        let result;
        strCi.length === 7 ? result = true : result = false;
        return result;
        //return ci_node.validate_ci(strCi);
    },

    verifyCpf: function (strCPF) {
        let Soma;
        let Resto;
        Soma = 0;
        let mapCPFs = {
            "00000000000": true,
            "11111111111": true,
            "22222222222": true,
            "33333333333": true,
            "44444444444": true,
            "55555555555": true,
            "66666666666": true,
            "77777777777": true,
            "88888888888": true,
            "99999999999": true,
        };
        if (mapCPFs[strCPF]) return false;

        for (let i = 1; i <= 9; i++) Soma = Soma + parseInt(strCPF.substring(i - 1, i)) * (11 - i);
        Resto = (Soma * 10) % 11;

        if ((Resto == 10) || (Resto == 11)) Resto = 0;
        if (Resto != parseInt(strCPF.substring(9, 10))) return false;

        Soma = 0;
        for (let i = 1; i <= 10; i++) Soma = Soma + parseInt(strCPF.substring(i - 1, i)) * (12 - i);
        Resto = (Soma * 10) % 11;

        if ((Resto == 10) || (Resto == 11)) Resto = 0;
        if (Resto != parseInt(strCPF.substring(10, 11))) return false;
        return true;
    },
    convertMinToHHMMSS: function (minutes) {
        if (!minutes) return "00:01:00";
        let date = new Date(null);
        date.setSeconds(minutes * 60); // specify value for SECONDS here
        return date.toISOString().substr(11, 8);
    },
    verifyAccessAuth: function (user, type, response) {
        if (!user) {
            response.error(Messages().error.ERROR_ACCESS_REQUIRED.code, Messages((user && user.get) ? user.get("language") : undefined).error.ERROR_ACCESS_REQUIRED.message);
            return false;
        }
        let userType = user.get("isDriverApp") ? "driver" : "passenger";
        let denied = (!user || (type && type.indexOf(userType) < 0));
        denied = user.get("isAdmin") ? false : denied; //denied could already be false
        if (denied) {
            response.error(Messages().error.ERROR_ACCESS_REQUIRED.code, Messages(user.get("language")).error.ERROR_ACCESS_REQUIRED.message);
            return false;
        }
        return true;
    },
    formatParams: function (params) {
        let obj = {};
        if (params) {
            for (let key in params) {
                if (key == "password") {
                    obj[key] = params[key];
                    continue;
                }
                let a = key.replace("[]", "");
                obj[a] = (key.indexOf("[]") >= 0 && typeof params[key] == "string") ? params[key].split('\"') : Utils.tryJsonParse(params[key]);
            }
        }
        return obj;
    },
    padWithZeros: function (number, length) {
        let my_string = '' + number;
        while (my_string.length < length) {
            my_string = '0' + my_string;
        }

        return my_string;

    },
    generateMapImage: function (originLatitude, originLongitude, destinationLatitude, destinationLongitude) {
        let bigMap = 'https://maps.googleapis.com/maps/api/staticmap?key=' + Define.MapsKey + '&size=600x300&maptype=roadmap&markers=color:green%7Clabel:I%7C' +
            originLatitude + ',' + originLongitude + '&markers=color:red%7Clabel:F%7C' + destinationLatitude + ',' + destinationLongitude;
        return Utils.saveImageFromUrl(bigMap);
    },
    capitalizeFirstLetter: function (string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    },
    tryJsonParse: function (variable, returnJsonInFail) {
        try {
            return JSON.parse(variable);
        } catch (e) {
            return returnJsonInFail ? {} : variable;
        }
    },
    verify: function verify(listElements, listFields) {
        let wrongFields = [];
        for (let k in listElements) {
            if (listFields.indexOf(k) < 0 && (listElements[k] && (!listElements[k].__op || listElements[k].__op !== "Delete"))) {
                wrongFields.push(k);
            }
        }
        return wrongFields;
    },
    formatDayOfWeek: function (date, offset) {
        date = date || new Date();
        date = new Date(date.setMinutes(date.getMinutes() + offset));
        let days = ["Dom", "Seg", "Ter", "Qua", "Qui", 'Sex', "Sab"];
        return days[date.getDay()];
    },
    formatPFObjectInJson: function (object, fields) {
        if (!object) return {};
        let json = {};
        for (let i = 0; i < fields.length; i++) {
            if (object.get(fields[i]) !== undefined) {
                json[fields[i]] = object.get(fields[i]);
                if (fields[i] === "email" || fields[i] === "phone") {
                    json[fields[i]] = Utils.hideInformation(json[fields[i]]);
                }
            }
        }
        json.objectId = object.id;
        delete json.createdAt;
        delete json.updatedAt;
        return json;
    },
    readHtml: function (file, data) {
        data = data || {};
        let filepath = './mails/' + file + ".html";
        let promise = new Promise((resolve, reject) => {
            fs.readFile(filepath, "utf8", function (err, htmlBody) {
                if (err) {
                    reject(err);
                }
                for (let key in data) {
                    htmlBody = htmlBody.replace(new RegExp("{{" + key + "}}", "g"), data[key]);
                }
                resolve(htmlBody);
            });
        });

        return promise;
    },
    readHtmlFromDatabase: function (body, data) {
        data = data || {};
        for (let key in data) {
            body = body.replace(new RegExp("{{" + key + "}}", "g"), data[key]);
        }
        return body;
    },
    readHtmlMultipleTimes: function (file, users) {
        let filepath = './mails/' + file + ".html";
        let promise = new Promise((resolve, reject) => {
            fs.readFile(filepath, "utf8", function (err, htmlBody) {
                if (err) {
                    reject(err);
                }
                for (let i = 0; i < users.length; i++) {
                    let html = htmlBody.repeat(1);
                    for (let key in users[i].data) {
                        html = html.replace("{{" + key + "}}", users[i].data[key]);
                    }
                    users[i].html = html;
                }
                resolve(users);
            });
        });

        return promise;
    },
    verifyPatternOfPlate: function (plate) {
        if (!plate) return false;
        const platePattern = RegExp('([a-zA-Z]{3}[0-9]{4})|(^[a-zA-Z]{3}[0-9][a-zA-Z][0-9]{2})');
        return platePattern.test(plate);
    },
    verifyPatternOfPlateBolivia: function (plate) {
        if (!plate) return false;
        const platePattern = RegExp('([0-9]{4}[a-zA-Z]{3})');
        return platePattern.test(plate);
    },
    verifyPatternOfPlateAngola: function (plate) {
        if (!plate) return false;
        const platePattern = RegExp('([a-zA-Z]{2}[0-9]{4}[a-zA-Z]{2})');
        return platePattern.test(plate);
    },
    convertHtmlToImage: function (rawHtml) {
        let pdfPath = "html2pdf.pdf";
        let imgPath = "pdf2png.png";
        let options = {
            format: "Tabloid",//A2
            border: "2cm"
        };
        let promise = new Promise((resolve, reject) => {
            try {
                html2pdf.create(rawHtml, options).toFile(pdfPath, function (err, res) {
                    if (err) reject(err);
                    else {
                        pdf2png.convert(pdfPath, {quality: 300}, function (resp) {
                            if (!resp.success) {
                                reject(resp.error);
                                return
                            }
                            fs.writeFile(imgPath, resp.data, function (err) {
                                if (err) {
                                    reject(err);
                                } else {
                                    //remover o pdf
                                    fs.unlink(pdfPath, function (err) {
                                        if (err) reject(err);
                                        else {
                                            let buffer = new Buffer(resp.data);
                                            let base64File = buffer.toString('base64');
                                            let file = new Parse.File("receipt.png", {base64: base64File});
                                            return file.save().then(function (newFile) {
                                                fs.unlink(imgPath, function (err) {
                                                    if (err) reject(err);
                                                    else {
                                                        resolve(newFile.url());
                                                    }
                                                });
                                            })
                                        }
                                    });
                                }
                            });
                        });
                    }
                });
            } catch (e) {
                reject({code: 400, message: "Não foi possivel gerar seu recibo no momento."});
            }
        });

        return promise;
    },
    saveImageFromUrl: function (url) {
        return Parse.Cloud.httpRequest({url: url}).then(function (response) {
            let data = "data:" + response.headers["content-type"] + ";base64," + new Buffer(response.buffer).toString('base64');
            return new Parse.File("image", {base64: data}).save();
        }).then(function (file) {
            return Promise.resolve(file ? file.url() : null);
        }, function (error) {
            return Promise.resolve();
        });
    },
    getDistanceInformation: function (originLat, originLng, destLat, destLng, attempt) {
        attempt = attempt || 0;
        if (attempt == 3) return Promise.resolve({});
        let origin = originLat + "," + originLng;
        let destiny = destLat + "," + destLng;
        let url = "https://maps.googleapis.com/maps/api/distancematrix/json?origins=" + origin + "&destinations=" + destiny + "&key=" + Define.MapsKey;
        return Parse.Cloud.httpRequest({url: url}).then(function (httpResponse) {
            let data = httpResponse.data;
            if (data.status === "OVER_QUERY_LIMIT" || data.error_message) {
                return Promise.resolve({});
            }
            if (data && data.rows && data.rows.length > 0 && data.rows[0].elements && data.rows[0].elements.length > 0) {
                return Promise.resolve({
                    distance: data.rows[0].elements[0].distance.value / 1000,
                    time: parseFloat(data.rows[0].elements[0].duration.value / 60)
                });
            } else {
                return Utils.getLocationInformation(originLat, originLng, destLat, destLng, ++attempt);
            }
        })
    },
    getCityByLatLng: function (lat, lng) {
        if (!lat || !lng) return Promise.resolve({});
        return Parse.Cloud.httpRequest({url: "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + lat + "," + lng + "&sensor=true&key=" + Define.MapsKey}).then(function (httpResponse) {
            if (httpResponse.data && httpResponse.data.error_message) {
                console.log(httpResponse.data.error_message);
            }
            let json = {city: null, state: null}, hasCity, hasState;
            for (let i = 0; i < httpResponse.data.results.length; i++) {
                let address_components = httpResponse.data.results[i].address_components;
                for (let j = 0; j < address_components.length; j++) {
                    let types = address_components[j].types;
                    for (let k = 0; k < types.length; k++) {
                        if (types[k] == "administrative_area_level_2") {
                            json.city = address_components[j].long_name;
                            hasCity = true;
                        }
                        if (types[k] == "administrative_area_level_1") {
                            json.state = address_components[j].long_name;
                            hasState = true;
                        }
                        if (hasState && hasCity) return Promise.resolve(json);
                    }
                }
            }
            return Promise.resolve(json);

        });
    },
    getLocationInformation: function (lat, lng, attempt) {
        attempt = attempt || 0;
        if (attempt == 3) return Promise.resolve({});
        let promise = new Promise((resolve, reject) => {
            if (!lat || !lng) {
                resolve({});
            }

            let url = "https://maps.googleapis.com/maps/api/geocode/json?key=" + Define.MapsKey + "&address=";
            Parse.Cloud.httpRequest({url: url + lat + "," + lng}).then(function (httpResponse) {
                let data = httpResponse.data;
                if (data.error_message) {
                    return Utils.getLocationInformation(lat, lng, ++attempt); //pending for too long without api key
                    // reject(data.error_message);
                } else {
                    if (data && data.results.length > 0 && data.results[0].formatted_address) {
                        let formatted_address = data.results[0].formatted_address;
                        let indexOfHifen = formatted_address.indexOf(',');
                        formatted_address = formatted_address.substring(0, indexOfHifen);
                        let auxIndex = formatted_address.indexOf('-');
                        indexOfHifen = auxIndex >= 0 ? auxIndex : indexOfHifen;
                        let street = formatted_address.substring(0, indexOfHifen);

                        formatted_address = formatted_address.substring(indexOfHifen + 1);
                        resolve({
                            street: street.trim(),
                            number: formatted_address.substring(0, formatted_address.indexOf('-')).trim()
                        });
                    } else {
                        resolve({});
                    }
                }
            });
        });

        return promise;
    },
    formatDateCalendar: function (date) {
        return date.getDate() + ' ' + date.getMonth() + 1 + ' ' + date.getFullYear();
    },
    formatDateCalendarUSA: function (date) {
        return date.getMonth() + 1 + ' ' + date.getDate() + ' ' + date.getFullYear();
    },
    formatTime: function (seconds) {
        return Math.floor(seconds / 60) + ":" + ((Math.floor(seconds % 60) < 10) ? "0" : "") + Math.floor(seconds % 60);
    },
    diffTimeinMinutes: function (date, endDate) {
        let now = endDate || new Date();
        let diffMs = (now - date);
        return Math.abs((diffMs / 1000) / 60);
    },
    convertTextToSearchText: function (text) {
        if (!text || text.length == 0)
            return "";
        let _ = require('../node_modules/underscore/underscore.js');
        let toLowerCase = function (w) {
            return w.toLowerCase();
        };
        return Utils.replaceSpecialChars(text).toLowerCase();
    },
    formatCurrencyToFloat: function (currency) {
        try {
            return Number(currency.replace(".", "").replace(",", ".").replace(/[^0-9.-]+/g, ""));
        } catch (e) {
            return parseFloat(currency.split(" ")[1].replace(",", ".").replace(/[^0-9.-]+/g, ""));
        }
    },
    replaceSpecialChars: function (palavra) {
        let com_acento = 'åáàãâäéèêëíìîïóòõôöúùûüçÅÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÖÔÚÙÛÜÇ';
        let sem_acento = 'aaaaaaeeeeiiiiooooouuuucAAAAAAEEEEIIIIOOOOOUUUUC';
        let nova = '';
        for (let i = 0; i < palavra.length; i++) {
            if (com_acento.indexOf(palavra.substr(i, 1)) >= 0) {
                nova += sem_acento.substr(com_acento.indexOf(palavra.substr(i, 1)), 1);
            } else {
                nova += palavra.substr(i, 1);
            }
        }
        return nova;
    },
    convertTextToSearchArray: function (text) {
        if (!text || text.length == 0)
            return [];
        let _ = require('../node_modules/underscore/underscore.js');
        let toLowerCase = function (w) {
            return w.toLowerCase();
        };

        let stopWords = ["e", "o", "a", "i", "u"];
        let words = Utils.replaceSpecialChars(text).split(/\b/);
        words = _.map(words, toLowerCase);
        words = _.filter(words, function (w) {
            return w.match(/^\w+$/) && !_.contains(stopWords, w);
        });
        return words;
    },
    convertTimestampToDateTime: function (date) {
        // Hours part from the timestamp
        let hours = date.getHours();
        // Minutes part from the timestamp
        let minutes = "0" + date.getMinutes();
        // Seconds part from the timestamp
        let seconds = "0" + date.getSeconds();
        // Will display time in 10:30:23 format
        return date.getDay() + "/" + date.getMonth() + "/" + date.getYear() + " " + hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
    },
    formatHour: function (date, offset) {
        if (offset) {
            date = new Date(date.setMinutes(date.getMinutes() + offset));
        }

        let hours = "0" + date.getHours();
        let minutes = "0" + date.getMinutes();
        return hours.substr(-2) + ':' + minutes.substr(-2);
    },
    formatMinutsToHour: function formatMinutsToHour(minutes) {
        let hoursStr = "0" + parseInt(minutes / 60);
        let minutesStr = "0" + (minutes - (hoursStr * 60));
        return hoursStr.substr(-2) + ':' + minutesStr.substr(-2);
    },
    createOrQuery: (querys) => {
        return Parse.Query.or(...querys);
    },
    createQuery: ({Class, conditions, matches, exists, matchesQuery, order, skip, limit, greatherThan, lessThan, select, contained}) => {
        let query = new Parse.Query(Class);
        if (conditions) {
            Object.keys(conditions).forEach((key) => {
                query.equalTo(key, conditions[key])
            });
        }
        if (contained) {
            Object.keys(contained).forEach((key) => {
                query.containedIn(key, contained[key])
            });
        }
        if (select) {
            query.select(select)
        }
        if (greatherThan) {
            Object.keys(greatherThan).forEach((key) => {
                query.greaterThan(key, greatherThan[key])
            });
        }
        if (lessThan) {
            Object.keys(lessThan).forEach((key) => {
                query.lessThan(key, lessThan[key])
            });
        }
        if (matches) {
            Object.keys(matches).forEach((key) => {
                query.matches(key, matches[key])
            });
        }
        if (exists) {
            Object.keys(exists).forEach((key) => {
                query.exists(key, exists[key])
            });
        }
        if (matchesQuery) {
            Object.keys(matchesQuery).forEach((key) => {
                query.matchesQuery(key, matchesQuery[key])
            });
        }
        return query;

    },
    toFloat: function (value, decimals) {
        if (value === undefined) return 0;
        decimals = decimals || 2;
        return parseFloat(value.toFixed(2));
    },
    verifyDateIsThisWeek: function (date) {
        date = date || new Date();

        let dateDiff = date.getDay() || 7;
        let startDate = new Date(date.setDate(date.getDate() - dateDiff + 1));
        startDate = new Date(startDate.setHours(0, 0, 0, 0));

        dateDiff = date.getDay() ? 7 - date.getDay() : 6;
        let endDate = new Date(date.setDate(date.getDate() + dateDiff));
        endDate = new Date(endDate.setHours(23, 59, 50, 0));

        let now = new Date();
        return startDate.getTime() <= now.getTime() && now.getTime() <= endDate.getTime();
    },
    formatDate: function (date, verifyIfNull) {
        if (verifyIfNull && !date) return null;
        date = date || new Date(date);
        let day = date.getDate();
        let month = date.getMonth() + 1;
        return (day < 10 ? "0" + day : day) + "/" + (month < 10 ? "0" + month : month) + "/" + date.getFullYear();
    },
    styleTitle: function (title, markers) {
        if (!title) return "";
        if (!markers || markers.length == 0) return title;

        let text = "";
        let j = 0;
        for (let i = 0; i < title.length; i++) {
            if (j < markers.length && i == markers[j]) {
                if (j++ % 2 == 0) text += "<span style='color: red;'>";
                else text += "</span>";
            }
            text += title.charAt(i);
        }
        return text;
    },
    checkIfJsonIsEmpty: function (json) {
        return JSON.stringify(json) === JSON.stringify({})
    },
    validateEmail: function (email) {
        let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
    },
    compareContent: function (a, b) {
        return JSON.stringify(a) === JSON.stringify(b)
    },
    convertParseObjectToJsonObject: function (array) {
        let objects = [];
        for (let i = 0; i < array.length; i++) {
            objects.push(array[i].toJSON());
        }
        return objects;
    },
    formatErrorsList: function (error) {
        if (!Array.isArray(error)) return error;
        for (let i = 0; i < error.length; i++) {
            if (error[i]) {
                return error[i];
            }
        }
        return error;
    },
    verifyUser: function (user, userType) {
        return new Promise(function (resolve, reject) {
            if (user != null) {
                let query = new Parse.Query(Parse.User);
                query.get(user.id, {
                    success: function (userAgain) {
                        // Check if userType is "user", other usertypes can't create campaigns
                        if (userAgain.get("userType") != userType) {
                            reject("User do not have permission.");
                        } else {
                            resolve();
                        }
                    }
                });
            } else {
                reject("Access unauthorized");
            }
        });
    },
    exitsValueInArray: function (array, value) {
        for (let i = 0; i < array.length; i++) {
            if (array[i].username && array[i].username == value) {
                return i;
            }
        }
        return -1;
    },
    isArrayOrJson: function (variable) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return Array.isArray((variable))
        }
    },
    formatListInJson: function (array, fields) {
        let objects = [];
        for (let i = 0; i < array.length; i++) {
            objects.push(Utils.formatObjectToJson(array[i], fields));
        }
        return objects;
    },
    randomString: function (size) {
        let _crypto = require('crypto');

        if (size === 0) {
            throw new Error('Zero-length randomString is useless.');
        }
        let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + 'abcdefghijklmnopqrstuvwxyz' + '0123456789';
        let objectId = '';
        let bytes = (0, _crypto.randomBytes)(size);
        for (let i = 0; i < bytes.length; ++i) {
            objectId += chars[bytes.readUInt8(i) % chars.length];
        }
        return objectId;
    },
    hexOctet: function () {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    },
    generateId: function () {
        return Utils.hexOctet() + Utils.hexOctet() + '-' + Utils.hexOctet() + '-' + Utils.hexOctet() + '-' + Utils.hexOctet() + '-' + Utils.hexOctet() + Utils.hexOctet() + Utils.hexOctet();
    },

    GenerateUrlComponent: function (title) {
        title = title.toLowerCase().trim();
        title = Utils.removeDiacritics(title);
        title = title.replace(/\s+/g, "-");
        title = title.replace(/[^a-zA-Z0-9-]/g, "-");
        title = title.replace(/[-]+/g, "-");
        return title.replace(/(^-)|(-$)/g, "");
    },
    verifyExisting: function (prefix, limit, step) {
        let stepString = step.toString();
        if (prefix.length + stepString.length <= limit)
            return prefix + stepString;
        else {
            let length = prefix.length - stepString.length + 1;
            if (length <= 0) // Ignorar por enquanto
                ;
            return prefix.substring(0, prefix.length - stepString.length + 1) + stepString;
        }
    },
    formatUrlTitle: function (className, id, title, limit) {
        limit = limit || 80;
        let step = 0;
        title = Utils.GenerateUrlComponent(title);
        let query = new Parse.Query(className);
        query.startsWith("link", title.substring(0, title.length - 5));
        if (id) {
            query.notEqualTo("objectId", id);
            query.limit(1000);
        }
        return query.find().then(function (objects) {
            let mapObjects = {};
            for (let i = 0; i < objects.length; i++) {
                mapObjects[objects[i].get("link")] = true;
            }
            let url = title;
            while (mapObjects[url]) {
                url = Utils.verifyExisting(title, limit, step++);
            }
            return Promise.resolve(url);
        });

    },
    hideInformation: function (info) {
        if (info) info = conf.hidePersonInformation ? "******" : info;
        return info;
    },
    formatObjectToJson: function (object, fields) {
        if (!object) return {};
        let json = {};
        for (let i = 0; i < fields.length; i++) {
            json[fields[i]] = object.get(fields[i]);
        }
        json.createdAt = object.createdAt;
        json.updatedAt = object.updatedAt;
        json.objectId = object.id;
        return json;
    },
    formatObjectArrayToJson: function (array, fields, createdAt) {
        let objects = [];
        for (let i = 0; i < array.length; i++) {
            let obj = Utils.formatPFObjectInJson(array[i], fields);
            if (createdAt) obj.createdAt = array[i].createdAt;
            objects.push(obj);
        }
        return objects;
    },
    formatUserFields: function (user) {
        let userJson = {
            objectId: user.id,
            name: user.get("name"),
            username: user.get("isSocial") ? user.get("authUser") : user.get("username"),
            profileImage: user.get("profileImage"),
            languages: user.get("languages"),
            language: user.get("language"),
            lastName: user.get("lastName"),
            email: user.get("email"),
            picture: user.get("picture"),
            userType: user.get("userType"),
            isAdmin: user.get("isAdmin"),
            config: user.get("config"),
            isSocial: user.get("isSocial"),
            isCompleted: user.get("isCompleted"),
            sessionToken: user.getSessionToken()
        };
        return userJson;
    },
    cleanStringUTF8: function (input) {
        let output = "";
        for (let i = 0; i < input.length; i++) {
            if (input.charCodeAt(i) <= 127) {
                output += input.charAt(i);
            }
        }
        return output;
    },
    removeDiacritics: function (str) {
        let diacriticsMap = {
            A: /[\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F]/g,
            AA: /[\uA732]/g,
            AE: /[\u00C6\u01FC\u01E2]/g,
            AO: /[\uA734]/g,
            AU: /[\uA736]/g,
            AV: /[\uA738\uA73A]/g,
            AY: /[\uA73C]/g,
            B: /[\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181]/g,
            C: /[\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E]/g,
            D: /[\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779]/g,
            DZ: /[\u01F1\u01C4]/g,
            Dz: /[\u01F2\u01C5]/g,
            E: /[\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E]/g,
            F: /[\u0046\u24BB\uFF26\u1E1E\u0191\uA77B]/g,
            G: /[\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E]/g,
            H: /[\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D]/g,
            I: /[\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197]/g,
            J: /[\u004A\u24BF\uFF2A\u0134\u0248]/g,
            K: /[\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2]/g,
            L: /[\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780]/g,
            LJ: /[\u01C7]/g,
            Lj: /[\u01C8]/g,
            M: /[\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C]/g,
            N: /[\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4]/g,
            NJ: /[\u01CA]/g,
            Nj: /[\u01CB]/g,
            O: /[\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C]/g,
            OI: /[\u01A2]/g,
            OO: /[\uA74E]/g,
            OU: /[\u0222]/g,
            P: /[\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754]/g,
            Q: /[\u0051\u24C6\uFF31\uA756\uA758\u024A]/g,
            R: /[\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782]/g,
            S: /[\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784]/g,
            T: /[\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786]/g,
            TZ: /[\uA728]/g,
            U: /[\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244]/g,
            V: /[\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245]/g,
            VY: /[\uA760]/g,
            W: /[\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72]/g,
            X: /[\u0058\u24CD\uFF38\u1E8A\u1E8C]/g,
            Y: /[\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE]/g,
            Z: /[\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762]/g,
            a: /[\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250]/g,
            aa: /[\uA733]/g,
            ae: /[\u00E6\u01FD\u01E3]/g,
            ao: /[\uA735]/g,
            au: /[\uA737]/g,
            av: /[\uA739\uA73B]/g,
            ay: /[\uA73D]/g,
            b: /[\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253]/g,
            c: /[\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184]/g,
            d: /[\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A]/g,
            dz: /[\u01F3\u01C6]/g,
            e: /[\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD]/g,
            f: /[\u0066\u24D5\uFF46\u1E1F\u0192\uA77C]/g,
            g: /[\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F]/g,
            h: /[\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265]/g,
            hv: /[\u0195]/g,
            i: /[\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131]/g,
            j: /[\u006A\u24D9\uFF4A\u0135\u01F0\u0249]/g,
            k: /[\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3]/g,
            l: /[\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747]/g,
            lj: /[\u01C9]/g,
            m: /[\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F]/g,
            n: /[\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5]/g,
            nj: /[\u01CC]/g,
            o: /[\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275]/g,
            oi: /[\u01A3]/g,
            ou: /[\u0223]/g,
            oo: /[\uA74F]/g,
            p: /[\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755]/g,
            q: /[\u0071\u24E0\uFF51\u024B\uA757\uA759]/g,
            r: /[\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783]/g,
            s: /[\u0073\u24E2\uFF53\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B]/g,
            ss: /[\u00DF]/g,
            t: /[\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787]/g,
            tz: /[\uA729]/g,
            u: /[\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289]/g,
            v: /[\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C]/g,
            vy: /[\uA761]/g,
            w: /[\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73]/g,
            x: /[\u0078\u24E7\uFF58\u1E8B\u1E8D]/g,
            y: /[\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF]/g,
            z: /[\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763]/g
        };
        for (let x in diacriticsMap) {
            // Iterate through each keys in the above object and perform a replace
            str = str.replace(diacriticsMap[x], x);
        }
        return str;
    },
    UUID: function () {
        let lut = [];
        for (let i = 0; i < 256; i++) {
            lut[i] = (i < 16 ? '0' : '') + (i).toString(16);
        }

        let d0 = Math.random() * 0xffffffff | 0;
        let d1 = Math.random() * 0xffffffff | 0;
        let d2 = Math.random() * 0xffffffff | 0;
        let d3 = Math.random() * 0xffffffff | 0;
        let token = lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff] + '-' +
            lut[d1 & 0xff] + lut[d1 >> 8 & 0xff] + '-' + lut[d1 >> 16 & 0x0f | 0x40] + lut[d1 >> 24 & 0xff] + '-' +
            lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & 0xff] + '-' + lut[d2 >> 16 & 0xff] + lut[d2 >> 24 & 0xff] +
            lut[d3 & 0xff] + lut[d3 >> 8 & 0xff] + lut[d3 >> 16 & 0xff] + lut[d3 >> 24 & 0xff];

        return token;
    },
    CPULoad: function (avgTime, callback) {
        function cpuAverage() {
            //Initialise sum of idle and time of cores and fetch CPU info
            let totalIdle = 0, totalTick = 0;
            let cpus = os.cpus();

            //Loop through CPU cores
            for (let i = 0, len = cpus.length; i < len; i++) {

                //Select CPU core
                let cpu = cpus[i];

                //Total up the time in the cores tick
                for (type in cpu.times) {
                    totalTick += cpu.times[type];
                }

                //Total up the idle time of the core
                totalIdle += cpu.times.idle;
            }

            //Return the average Idle and Tick times
            return {idle: totalIdle / cpus.length, total: totalTick / cpus.length};
        }

        this.samples = [];
        this.samples[1] = cpuAverage();
        this.refresh = setInterval(() => {
            this.samples[0] = this.samples[1];
            this.samples[1] = cpuAverage();
            var totalDiff = this.samples[1].total - this.samples[0].total;
            var idleDiff = this.samples[1].idle - this.samples[0].idle;
            callback(1 - idleDiff / totalDiff);
        }, avgTime);
    }
};
module.exports = Utils;

