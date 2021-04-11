'use strict';
const {config} = require('../config');
const faker = require('faker/locale/pt_BR');
const appId = config.appId;
const CPF = require('gerador-validador-cpf');

let Faker = {
    createPassengers: function (amountPassengers) {
        let passengers = [];
        for (let i=0; i < amountPassengers; i=i+1) {
            let genders = ['f' , 'm'];
            let device = ['android', 'ios'];
            let passenge = {
                _ApplicationId: appId,
                installationId: faker.random.alphaNumeric(36),
                email: faker.internet.email(),
                cpf: CPF.generate(),
                enrollment: faker.random.alphaNumeric(10),
                appIdentifier: "usemobile.com.br.UaiMove",
                phone: faker.phone.phoneNumber(),
                gender: faker.random.arrayElement(genders),
                profileImage: faker.image.imageUrl(),
                password: faker.internet.password(),
                name: faker.name.findName(),
                deviceToken: faker.random.alphaNumeric(64),
                deviceInfo:
                    {
                        "appVersion": "1.0.12",
                        "deviceType": faker.random.arrayElement(device),
                        "model": "iPhone 6s",
                        "manufacturer": "apple",
                        "language": "pt",
                        "version": "iOS"
                    },
            };
            passengers.push(passenge);
        }
        return passengers;
    },
    createDrivers: function (amountDrivers) {
        let drivers = [];
        for (let i=0; i < amountDrivers; i=i+1) {
            let genders = ['f' , 'm'];
            let driver = {
                _ApplicationId: appId,
                installationId: faker.random.alphaNumeric(36),
                email: faker.internet.email(),
                cpf: CPF.generate(),
                enrollment: faker.random.alphaNumeric(10),
                appIdentifier: "usemobile.com.br.UaiMove",
                phone: faker.phone.phoneNumber(),
                gender: faker.random.arrayElement(genders),
                profileImage: faker.image.imageUrl(),
                password: faker.internet.password(),
                name: faker.name.findName(),
                deviceToken: faker.random.alphaNumeric(64),
                deviceInfo:
                    {
                        "appVersion": "1.0.12",
                        "deviceType": "ios",
                        "model": "iPhone 6s",
                        "manufacturer": "apple",
                        "language": "pt",
                        "version": "iOS"
                    },
            };
            drivers.push(driver);
        }
        return drivers;
    },
    createCode: function(){
        return faker.random.alphaNumeric(5);
    },
    createCPF: function(){
        return CPF.generate();
    },
    createEmail: function(){
        return faker.internet.email()
    },
    createName: function(){
        return faker.name.findName()
    },

    createLastName: function(){
        return faker.name.lastName()
    }
};
module.exports = Faker;
