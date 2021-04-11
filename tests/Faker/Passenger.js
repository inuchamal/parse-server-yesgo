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
            let passenge = {
                _ApplicationId: appId,
                installationId: "499F4D1D-6AEA-4FF5-AFE1-924C9D9B8EF3",
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
            passengers.push(passenge);
        }
        return passengers;
    },
};
module.exports = Faker;