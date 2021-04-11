'use strict';
const {config} = require('../config');
const faker = require('faker/locale/pt_BR');
const appId = config.appId;
const CPF = require('gerador-validador-cpf');

let Faker = {
    createCard1: function () {
        return {
            _ApplicationId: appId,
            name: faker.name.findName(),
            number: "5330 0855 7900 5472",
            date: "0821",
            cpf: CPF.generate(),
            cvv: "323",
            brand: "mastercard"
        };
    }
};
module.exports = Faker;