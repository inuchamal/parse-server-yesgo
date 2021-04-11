'use strict';
const Parse = require('parse/node');
const conf = require('config');
Parse.initialize(conf.appId, 'key', conf.masterKey);
Parse.serverURL = conf.server;
const DefineClass = require('./lib/Define.js');
let utils = require("./lib/Utils.js");
const XLSX = require('xlsx');


const methods = {
    includeCountries: async () => {
        try {
            const countries = require('./countries.json');
            let promises = [];
            for (let i = 0; i < countries.length; i++) {
                let query = await utils.findObject(DefineClass.Country, {"name": countries[i].nome}, true);
                if (!query) {
                    countries[i].fone = "+" + parseInt(countries[i].fone, 10);
                    let country = new DefineClass.Country();
                    country.set("name", countries[i].nome);
                    country.set("searchName", utils.removeDiacritics(countries[i].nome.toLowerCase().trim()));
                    country.set("sigla", countries[i].iso);
                    country.set("ddi", countries[i].fone);
                    country.set("formalName", countries[i].nomeFormal);
                    promises.push(country.save(null));
                }
            }
            await Promise.all(promises);
            console.log("OK");
        } catch (error) {
            console.log(error);
        }
    },
    stateSearchName: async () => {
        let query = new Parse.Query(DefineClass.State);
        query.limit(1000000);
        let promises = [];
        query.equalTo("searchName", undefined);
        let states = await query.find();
        for (let i = 0; i < states.length; i++) {
            states[i].set("searchName", utils.removeDiacritics(states[i].get("name").trim().toLowerCase()));
            promises.push(states[i].save(null, {useMasterKey: true}));
        }
        return Promise.all(promises).then(function () {
            console.log("OK");
        }, function (error) {
            console.log(error);
        });
    },
    citySearchName: async () => {
        let query = new Parse.Query(DefineClass.City);
        query.limit(1000000);
        query.equalTo("searchName", undefined);
        let cities = await query.find();
        for (let i = 0; i < cities.length; i++) {
            cities[i].set("searchName", utils.removeDiacritics(cities[i].get("name").trim().toLowerCase()));
            await cities[i].save(null, {useMasterKey: true});
        }
        console.log("OK");
    },
    codeUppercase: async () => {
        let query = new Parse.Query(DefineClass.Coupon);
        query.limit(1000000);
        let promises = [];
        let coupons = await query.find();
        for (let i = 0; i < coupons.length; i++) {
            coupons[i].set("name", coupons[i].get("name").trim().toUpperCase());
            promises.push(coupons[i].save(null, {useMasterKey: true}));
        }
        return Promise.all(promises).then(function () {
            console.log("OK");
        }, function (error) {
            console.log(error);
        });
    },
    includeAngolaStates: async () => {
        try {
            const states = [{name: "Bengo", sigla: "BGO"}, {name: "Benguela", sigla: "BGU"}, {
                name: "Bié",
                sigla: "BIE"
            }, {name: "Cabinda", sigla: "CAB"}, {name: "Cuando Cubango", sigla: "CCU"}, {
                name: "Kwanza Norte",
                sigla: "CNO"
            }, {name: "Kwanza-Sul", sigla: "CUS"}, {name: "Cunene", sigla: "CNN"}, {
                name: "Huambo",
                sigla: "HUA"
            }, {name: "Huíla", sigla: "HUI"}, {name: "Luanda", sigla: "LUA"}, {
                name: "Lunda Norte",
                sigla: "LNO"
            }, {name: "Lunda-Sul", sigla: "LSU"}, {name: "Malanje", sigla: "MAL"}, {
                name: "Moxico",
                sigla: "MOX"
            }, {name: "Namibe", sigla: "NAM"}, {name: "Uíge", sigla: "UIG"}, {name: "Zaire", sigla: "ZAI"}];
            let promises = [];
            for (let i = 0; i < states.length; i++) {
                let query = await utils.findObject(DefineClass.State, {"name": states[i].name}, true);
                if (!query) {
                    let country = await utils.findObject(DefineClass.Country, {"name": "Angola"}, true);
                    let state = new DefineClass.State();
                    state.set("name", states[i].name);
                    state.set("countryObj", country);
                    state.set("sigla", states[i].sigla);
                    state.set("searchName", utils.removeDiacritics(states[i].name.toLowerCase()));
                    promises.push(state.save(null, {useMasterKey: true}));
                }
            }
            await Promise.all(promises);
            console.log("OK");
        } catch (error) {
            console.log(error);
        }
    },
    includeAngolaCities: async () => {
        try {
            const workbook = XLSX.readFile("Angola.xlsx");
            let promises = [];
            const sheet = XLSX.utils.sheet_to_json(workbook.Sheets["Angola"], {
                header: 1, //forma um array de arrays
                raw: false,
                blankrows: false //pula linhas em branco
            });
            for (let j = 1; j < sheet.length; j++) {
                let data = {
                    city: sheet[j][0],
                    state: sheet[j][1]
                };
                let stateObj = await utils.findObject(DefineClass.State, {"name": data.state}, true);
                let query = await utils.findObject(DefineClass.City, {"name": data.city}, true);
                if (!query) {
                    let cityObj = new DefineClass.City();
                    cityObj.set("name", data.city);
                    cityObj.set("state", stateObj);
                    cityObj.set("searchName", utils.removeDiacritics(data.city.toLowerCase()));
                    promises.push(cityObj.save(null, {useMasterKey: true}));
                }
            }
            await Promise.all(promises);
            console.log("OK");
        } catch (error) {
            console.log(error);
        }
    },

    linkCountryState: async () => {
        try {
            const country = await utils.findObject(DefineClass.Country, {name: "Brasil"}, true);
            let promises = [];
            if (country) {
                let states = await utils.findObject(DefineClass.State, {countryObj: undefined}, false, null, null, null, {country: ["br", undefined, null]});
                for (let i = 0; i < states.length; i++) {
                    states[i].set("countryObj", country);
                    promises.push(states[i].save(null, {useMasterKey: true}));
                }
                await Promise.all(promises);
                console.log("Ok");
            }
        } catch (error) {
            console.log(error);
        }
    },

    linkCountryStateBolivia: async () => {
        try {
            const country = await utils.findObject(DefineClass.Country, {name: "Bolívia"}, true);
            let promises = [];
            if (country) {
                let states = await utils.findObject(DefineClass.State, {countryObj: undefined, country: "bo"}, false);
                for (let i = 0; i < states.length; i++) {
                    states[i].set("countryObj", country);
                    promises.push(states[i].save(null, {useMasterKey: true}));
                }
                await Promise.all(promises);
                console.log("Ok");
            }
        } catch (error) {
            console.log(error);
        }
    }
};

exports.data = methods;